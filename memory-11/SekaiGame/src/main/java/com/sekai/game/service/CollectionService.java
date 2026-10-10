package com.sekai.game.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sekai.game.entity.Card;
import com.sekai.game.entity.UserCard;
import com.sekai.game.entity.DeckCard;
import com.sekai.game.repository.CardRepository;
import com.sekai.game.repository.DeckCardRepository;
import com.sekai.game.repository.DeckRepository;
import com.sekai.game.repository.UserCardRepository;
import com.sekai.game.repository.UserRepository;
import com.sekai.game.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CollectionService {

    private static final Map<String, Integer> SHARD_VALUES = Map.of("N", 5, "R", 15, "SR", 50, "SSR", 100, "UR", 200);
    private static final Map<String, Integer> CRAFT_COSTS = Map.of("N", 20, "R", 60, "SR", 200, "SSR", 400, "UR", 800);
    private final SecureRandom random = new SecureRandom();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private UserCardRepository userCardRepository;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private DeckCardRepository deckCardRepository;

    @Autowired
    private DeckRepository deckRepository;

    @Autowired
    private UserRepository userRepository;

    @Transactional
    public Map<String, Object> saveCollection(Long userId, Map<String, Object> body) {
        if (body == null) throw new IllegalArgumentException("收藏数据不能为空");
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        Object cardsValue = body.get("cards");
        if (!(cardsValue instanceof Map<?, ?> cards)) {
            throw new IllegalArgumentException("收藏数据格式错误");
        }

        userCardRepository.deleteByUserId(userId);
        userCardRepository.flush();
        List<UserCard> savedCards = new ArrayList<>();
        for (Map.Entry<?, ?> entry : cards.entrySet()) {
            String cardId = String.valueOf(entry.getKey());
            int count = entry.getValue() instanceof Number number ? number.intValue() : 0;
            if (count <= 0) continue;
            if (count > 3) throw new IllegalArgumentException("单张卡牌最多拥有3张");
            Card card = cardRepository.findById(cardId).orElse(null);
            if (card == null || !Boolean.TRUE.equals(card.getEnabled())) continue;
            UserCard owned = new UserCard();
            owned.setUser(user);
            owned.setCard(card);
            owned.setCount(count);
            savedCards.add(owned);
        }
        userCardRepository.saveAll(savedCards);
        return Map.of("success", true, "cards", savedCards.size());
    }

    public List<Map<String, Object>> getUserCollection(Long userId) {
        List<UserCard> userCards = userCardRepository.findByUserId(userId);
        return userCards.stream().map(uc -> {
            Map<String, Object> map = new HashMap<>();
            map.put("cardId", uc.getCard().getId());
            map.put("count", uc.getCount());
            map.put("name", uc.getCard().getName());
            map.put("rarity", uc.getCard().getRarity());
            map.put("type", uc.getCard().getType());
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> openPack(Long userId, String packType, int count) {
        if (!"nightcord".equalsIgnoreCase(packType)) {
            return Map.of("success", false, "reason", "不支持的卡包类型");
        }
        if (count != 1 && count != 10) {
            return Map.of("success", false, "reason", "一次只能单抽或十连");
        }
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        int cost = count == 10 ? 2700 : 300;
        List<Card> pool = cardRepository.findAll().stream()
            .filter(card -> Boolean.TRUE.equals(card.getEnabled()))
            .filter(card -> !StarterDeckService.STARTER_SERIES.equals(card.getSeries()))
            .toList();
        if (pool.isEmpty()) {
            return Map.of("success", false, "reason", "卡池为空");
        }
        // 原子条件扣费：原来的"读余额 → 判断 → 写回"在并发开包时两次请求都会通过
        // 余额检查，导致双花与丢更新。放在卡池校验之后，卡池异常时不会白扣费用。
        if (userRepository.spendDuelCoins(userId, cost) == 0) {
            return Map.of("success", false, "reason", "次元币不足");
        }
        // 原子更新绕过了持久化上下文，必须重新读取实体：否则后续 save(user) 会用
        // 读取时的陈旧余额覆盖掉刚刚扣减的结果。
        user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        List<Card> pulledCards = new ArrayList<>();
        Map<String, Map<String, Integer>> pity = readPity(user);
        Map<String, Integer> packCounter = new HashMap<>(pity.getOrDefault("nightcord_pack_001", Map.of()));
        int packsSinceUr = Math.max(0, packCounter.getOrDefault("packsSinceUR", 0));
        // 需要在抽卡之前就知道"已拥有"的集合，才能做重复保护
        Map<String, Integer> ownedCounts = new HashMap<>();
        for (UserCard owned : userCardRepository.findByUserId(userId)) {
            ownedCounts.put(owned.getCard().getId(), owned.getCount());
        }
        boolean tenPackHasHighRarity = false;
        for (int pack = 0; pack < count; pack++) {
            boolean packHasUr = false;
            for (int slot = 0; slot < 1; slot++) {
                Map<String, Double> rates = effectiveRates(packsSinceUr);
                double roll = random.nextDouble();
                String rarity;
                if (roll < rates.get("UR")) rarity = "UR";
                else if (roll < rates.get("UR") + rates.get("SSR")) rarity = "SSR";
                else if (roll < rates.get("UR") + rates.get("SSR") + rates.get("SR")) rarity = "SR";
                else if (roll < rates.get("UR") + rates.get("SSR") + rates.get("SR") + rates.get("R")) rarity = "R";
                else rarity = "N";

                if (packsSinceUr >= 49 && !packHasUr) rarity = "UR";

                String selectedRarity = rarity;
                List<Card> rarityPool = pool.stream()
                    .filter(c -> selectedRarity.equals(c.getRarity()))
                    .toList();
                if (rarityPool.isEmpty()) rarityPool = pool;

                Card pulled = rarityPool.get(random.nextInt(rarityPool.size()));
                pulledCards.add(pulled);
                if ("UR".equals(pulled.getRarity())) packHasUr = true;
                if ("SR".equals(pulled.getRarity()) || "SSR".equals(pulled.getRarity()) || "UR".equals(pulled.getRarity())) {
                    tenPackHasHighRarity = true;
                }
            }
            packsSinceUr = packHasUr ? 0 : packsSinceUr + 1;
        }
        if (count == 10 && !tenPackHasHighRarity) {
            List<Card> highRarityPool = pool.stream()
                .filter(card -> Set.of("SR", "SSR", "UR").contains(card.getRarity()))
                .toList();
            if (!highRarityPool.isEmpty()) pulledCards.set(0, highRarityPool.get(random.nextInt(highRarityPool.size())));
        }

        // 重复保护：整批一张新卡都没有时，把其中稀有度最低的一张换成尚未拥有的卡。
        // 没有这一步时玩家大约第 30 包就会开出 0 张新卡（实测），收藏进度几乎停滞。
        boolean hasNewCard = pulledCards.stream()
            .anyMatch(card -> ownedCounts.getOrDefault(card.getId(), 0) == 0);
        if (!hasNewCard) {
            List<Card> fresh = pool.stream()
                .filter(card -> ownedCounts.getOrDefault(card.getId(), 0) == 0)
                .toList();
            if (!fresh.isEmpty()) {
                int worstIndex = 0;
                for (int i = 1; i < pulledCards.size(); i++) {
                    if (rarityRank(pulledCards.get(i).getRarity()) < rarityRank(pulledCards.get(worstIndex).getRarity())) {
                        worstIndex = i;
                    }
                }
                String worstRarity = pulledCards.get(worstIndex).getRarity();
                List<Card> sameRarity = fresh.stream().filter(card -> worstRarity.equals(card.getRarity())).toList();
                List<Card> candidates = sameRarity.isEmpty() ? fresh : sameRarity;
                pulledCards.set(worstIndex, candidates.get(random.nextInt(candidates.size())));
            }
        }

        Map<String, Integer> shards = readShards(user);
        List<Map<String, Object>> results = new ArrayList<>();
        for (Card card : pulledCards) {
            int previousCount = ownedCounts.getOrDefault(card.getId(), 0);
            addCardToUser(userId, card.getId(), 1);
            if (previousCount >= 3) {
                String rarity = card.getRarity();
                shards.put(rarity, shards.getOrDefault(rarity, 0) + SHARD_VALUES.getOrDefault(rarity, 5));
            }
            ownedCounts.put(card.getId(), Math.min(3, previousCount + 1));
            Map<String, Object> map = new HashMap<>();
            map.put("id", card.getId());
            map.put("name", card.getName());
            map.put("rarity", card.getRarity());
            map.put("type", card.getType());
            results.add(map);
        }

        user.setPacksOpened((user.getPacksOpened() == null ? 0 : user.getPacksOpened()) + count);
        user.setShardsJson(writeJson(shards));
        packCounter.put("packsSinceUR", packsSinceUr);
        pity.put("nightcord_pack_001", packCounter);
        user.setPityCountersJson(writeJson(pity));
        userRepository.save(user);

        return Map.of(
            "success", true,
            "cards", results,
            "duelCoins", user.getDuelCoins(),
            "packsOpened", user.getPacksOpened(),
            "shards", shards,
            "pityCounters", pity
        );
    }

    @Transactional
    public Map<String, Object> craftCard(Long userId, String cardId) {
        User user = findUser(userId);
        Card card = findEnabledCard(cardId);
        UserCard owned = userCardRepository.findByUserIdAndCardId(userId, cardId).orElse(null);
        if (owned != null && owned.getCount() >= 3) {
            return Map.of("success", false, "reason", "同名卡最多拥有3张");
        }
        String rarity = card.getRarity();
        int cost = CRAFT_COSTS.getOrDefault(rarity, 20);
        Map<String, Integer> shards = readShards(user);
        int available = shards.getOrDefault(rarity, 0);
        if (available < cost) {
            return Map.of("success", false, "reason", "碎片不足", "shards", shards);
        }
        shards.put(rarity, available - cost);
        addCardToUser(userId, cardId, 1);
        user.setShardsJson(writeJson(shards));
        userRepository.save(user);
        int count = userCardRepository.findByUserIdAndCardId(userId, cardId).map(UserCard::getCount).orElse(0);
        return Map.of("success", true, "count", count, "shards", shards);
    }

    @Transactional
    public Map<String, Object> dismantleCard(Long userId, String cardId) {
        User user = findUser(userId);
        UserCard owned = userCardRepository.findByUserIdAndCardId(userId, cardId)
            .orElseThrow(() -> new IllegalArgumentException("没有该卡牌"));
        boolean usedInDeck = deckRepository.findByUserId(userId).stream()
            .flatMap(deck -> deckCardRepository.findByDeckId(deck.getId()).stream())
            .map(DeckCard::getCardId)
            .anyMatch(cardId::equals);
        if (usedInDeck) throw new IllegalArgumentException("请先从卡组移除该卡牌");

        Card card = owned.getCard();
        int shardsEarned = SHARD_VALUES.getOrDefault(card.getRarity(), 5);
        if (owned.getCount() <= 1) userCardRepository.delete(owned);
        else owned.setCount(owned.getCount() - 1);
        Map<String, Integer> shards = readShards(user);
        shards.put(card.getRarity(), shards.getOrDefault(card.getRarity(), 0) + shardsEarned);
        user.setShardsJson(writeJson(shards));
        userRepository.save(user);
        return Map.of("success", true, "shards", shards, "shardsEarned", shardsEarned);
    }

    @Transactional
    public UserCard addCardToUser(Long userId, String cardId, int count) {
        if (count <= 0 || count > 100) throw new IllegalArgumentException("卡牌数量无效");
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        Card card = cardRepository.findById(cardId)
            .filter(item -> Boolean.TRUE.equals(item.getEnabled()))
            .orElseThrow(() -> new IllegalArgumentException("卡牌不存在或已禁用"));
        Optional<UserCard> existing = userCardRepository.findByUserIdAndCardId(userId, cardId);
        if (existing.isPresent()) {
            UserCard uc = existing.get();
            uc.setCount(Math.min(uc.getCount() + count, 3));
            return userCardRepository.save(uc);
        } else {
            UserCard uc = new UserCard();
            uc.setUser(user);
            uc.setCard(card);
            uc.setCount(Math.min(count, 3));
            return userCardRepository.save(uc);
        }
    }

    public Map<String, Object> getCollectionStats(Long userId) {
        List<UserCard> userCards = userCardRepository.findByUserId(userId);
        long totalCards = userCards.stream().mapToLong(UserCard::getCount).sum();
        long uniqueCards = userCards.size();
        Map<String, Long> rarityCount = userCards.stream()
            .collect(Collectors.groupingBy(
                uc -> uc.getCard().getRarity(),
                Collectors.summingLong(UserCard::getCount)
            ));
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCards", totalCards);
        stats.put("uniqueCards", uniqueCards);
        stats.put("rarityDistribution", rarityCount);
        return stats;
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }

    private Card findEnabledCard(String cardId) {
        return cardRepository.findById(cardId)
            .filter(card -> Boolean.TRUE.equals(card.getEnabled()))
            .orElseThrow(() -> new IllegalArgumentException("卡牌不存在或已禁用"));
    }

    /** 稀有度排序，用于挑选"最低稀有度"的卡进行重复保护替换。 */
    private static int rarityRank(String rarity) {
        return switch (rarity == null ? "" : rarity) {
            case "N" -> 0;
            case "R" -> 1;
            case "SR" -> 2;
            case "SSR" -> 3;
            case "UR" -> 4;
            default -> 0;
        };
    }

    /** 与离线抽卡保持一致：35 抽后逐步提高 UR 概率，第 50 抽由主流程硬保底。 */
    private static Map<String, Double> effectiveRates(int pullsSinceUr) {
        if (pullsSinceUr < 35) {
            return Map.of("N", 0.62, "R", 0.25, "SR", 0.09, "SSR", 0.035, "UR", 0.005);
        }
        int capped = Math.min(pullsSinceUr, 48);
        double bonus = (capped - 34) * 0.0332;
        return Map.of(
            "N", Math.max(0, 0.62 - bonus * 0.62),
            "R", Math.max(0, 0.25 - bonus * 0.25),
            "SR", Math.max(0, 0.09 - bonus * 0.09),
            "SSR", Math.max(0, 0.035 - bonus * 0.035),
            "UR", Math.min(1, 0.005 + bonus)
        );
    }

    private Map<String, Integer> readShards(User user) {
        try {
            Map<String, Integer> shards = objectMapper.readValue(
                user.getShardsJson() == null ? "{}" : user.getShardsJson(),
                new TypeReference<>() {}
            );
            return new HashMap<>(shards == null ? Map.of() : shards);
        } catch (Exception exception) {
            throw new IllegalArgumentException("碎片数据损坏");
        }
    }

    private Map<String, Map<String, Integer>> readPity(User user) {
        try {
            Map<String, Map<String, Integer>> pity = objectMapper.readValue(
                user.getPityCountersJson() == null ? "{}" : user.getPityCountersJson(),
                new TypeReference<>() {}
            );
            return new HashMap<>(pity == null ? Map.of() : pity);
        } catch (Exception exception) {
            throw new IllegalArgumentException("保底数据损坏");
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException("经济数据格式错误");
        }
    }
}
