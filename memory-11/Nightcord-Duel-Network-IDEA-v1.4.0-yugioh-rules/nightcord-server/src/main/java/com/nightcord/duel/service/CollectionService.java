package com.nightcord.duel.service;

import com.nightcord.duel.entity.Card;
import com.nightcord.duel.entity.UserCard;
import com.nightcord.duel.repository.CardRepository;
import com.nightcord.duel.repository.UserCardRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CollectionService {

    @Autowired
    private UserCardRepository userCardRepository;

    @Autowired
    private CardRepository cardRepository;

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
        List<Card> pool = cardRepository.findBySeriesAndEnabledTrue("nightcord");
        if (pool.isEmpty()) {
            return Map.of("success", false, "reason", "卡池为空");
        }

        Map<String, Double> rates = Map.of(
            "N", 0.55, "R", 0.30, "SR", 0.12, "UR", 0.03
        );

        List<Card> pulledCards = new ArrayList<>();
        Random random = new Random();

        for (int i = 0; i < count; i++) {
            double roll = random.nextDouble();
            String rarity;
            if (roll < rates.get("UR")) rarity = "UR";
            else if (roll < rates.get("UR") + rates.get("SR")) rarity = "SR";
            else if (roll < rates.get("UR") + rates.get("SR") + rates.get("R")) rarity = "R";
            else rarity = "N";

            List<Card> rarityPool = pool.stream()
                .filter(c -> c.getRarity().equals(rarity))
                .toList();
            if (rarityPool.isEmpty()) rarityPool = pool;

            pulledCards.add(rarityPool.get(random.nextInt(rarityPool.size())));
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (Card card : pulledCards) {
            addCardToUser(userId, card.getId(), 1);
            Map<String, Object> map = new HashMap<>();
            map.put("id", card.getId());
            map.put("name", card.getName());
            map.put("rarity", card.getRarity());
            map.put("type", card.getType());
            results.add(map);
        }

        return Map.of("success", true, "cards", results);
    }

    @Transactional
    public UserCard addCardToUser(Long userId, String cardId, int count) {
        Optional<UserCard> existing = userCardRepository.findByUserIdAndCardId(userId, cardId);
        if (existing.isPresent()) {
            UserCard uc = existing.get();
            uc.setCount(Math.min(uc.getCount() + count, 3));
            return userCardRepository.save(uc);
        } else {
            UserCard uc = new UserCard();
            com.nightcord.duel.entity.User user = new com.nightcord.duel.entity.User();
            user.setId(userId);
            uc.setUser(user);
            uc.setCard(new Card(cardId));
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
}
