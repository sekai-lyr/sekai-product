package com.nightcord.duel.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nightcord.duel.entity.Card;
import com.nightcord.duel.repository.CardRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    @Autowired
    private CardRepository cardRepository;

    @Override
    public void run(String... args) throws Exception {
        if (cardRepository.count() > 0) {
            log.info("数据库已有 {} 张卡牌，跳过初始化", cardRepository.count());
            return;
        }

        log.info("开始初始化卡牌数据...");
        List<Card> cards = loadCardsFromJson();
        if (!cards.isEmpty()) {
            cardRepository.saveAll(cards);
            log.info("成功导入 {} 张卡牌到数据库", cards.size());
        } else {
            log.warn("未找到卡牌数据文件或文件为空");
        }
    }

    private List<Card> loadCardsFromJson() {
        List<Card> cards = new ArrayList<>();
        try {
            ClassPathResource resource = new ClassPathResource("cards.json");
            if (!resource.exists()) {
                log.info("cards.json 不存在，使用内置数据初始化");
                return getBuiltInCards();
            }
            InputStream is = resource.getInputStream();
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(is);
            if (root.isArray()) {
                for (JsonNode node : root) {
                    Card card = parseCardNode(node);
                    if (card != null) cards.add(card);
                }
            }
        } catch (Exception e) {
            log.error("加载 cards.json 失败，使用内置数据: {}", e.getMessage());
            return getBuiltInCards();
        }
        return cards;
    }

    private Card parseCardNode(JsonNode node) {
        try {
            Card card = new Card();
            card.setId(node.get("id").asText());
            card.setName(node.has("name") && !node.get("name").asText().isEmpty()
                ? node.get("name").asText() : node.get("id").asText());
            card.setSeries(node.has("series") && !node.get("series").isNull()
                ? node.get("series").asText() : null);
            card.setMember(node.has("member") && !node.get("member").isNull()
                ? node.get("member").asText() : null);
            card.setType(node.get("type").asText());
            card.setAttribute(node.has("attribute") ? node.get("attribute").asText() : "none");
            card.setLevel(node.has("level") ? node.get("level").asInt() : 0);
            card.setAttack(node.has("attack") ? node.get("attack").asInt() : 0);
            card.setDefense(node.has("defense") ? node.get("defense").asInt() : 0);
            card.setRarity(node.has("rarity") ? node.get("rarity").asText() : "N");
            card.setCost(node.has("cost") ? node.get("cost").asInt() : 0);
            card.setDescription(node.has("description") ? node.get("description").asText() : null);
            card.setImage(node.has("image") ? node.get("image").asText() : null);
            card.setEnabled(node.has("enabled") ? node.get("enabled").asBoolean() : true);

            if (node.has("effects")) {
                card.setEffectsJson(node.get("effects").toString());
            }

            return card;
        } catch (Exception e) {
            log.warn("解析卡牌失败: {}", e.getMessage());
            return null;
        }
    }

    private List<Card> getBuiltInCards() {
        List<Card> cards = new ArrayList<>();

        // ============ 火属性怪兽 (6张) ============
        cards.add(createMonsterCard("fire_001", "fire", 5, 2400, 1800, "SR",
            "召唤时对对方所有怪兽造成300点伤害。"));
        cards.add(createMonsterCard("fire_002", "fire", 3, 1600, 1200, "R",
            "召唤时自身攻击力+300。"));
        cards.add(createMonsterCard("fire_003", "fire", 7, 2800, 2200, "SSR",
            "被破坏时返回手牌。"));
        cards.add(createMonsterCard("fire_004", "fire", 2, 1200, 800, "N", ""));
        cards.add(createMonsterCard("fire_005", "fire", 6, 2000, 2400, "SR",
            "召唤时对对方所有怪兽造成200点伤害。"));
        cards.add(createMonsterCard("fire_006", "fire", 4, 1800, 1200, "R",
            "召唤时自身攻击力+500。"));

        // ============ 水属性怪兽 (6张) ============
        cards.add(createMonsterCard("water_001", "water", 4, 1600, 2000, "R",
            "召唤时自身守备力+500。"));
        cards.add(createMonsterCard("water_002", "water", 4, 1400, 1600, "R",
            "召唤时对方怪兽攻击力-300。"));
        cards.add(createMonsterCard("water_003", "water", 8, 2800, 2600, "SSR",
            "召唤时破坏对方所有怪兽。"));
        cards.add(createMonsterCard("water_004", "water", 2, 800, 1200, "N",
            "召唤时回复500生命值。"));
        cards.add(createMonsterCard("water_005", "water", 5, 1800, 2000, "SR",
            "召唤时对方所有怪兽攻击力-500。"));
        cards.add(createMonsterCard("water_006", "water", 3, 1000, 1800, "N",
            "召唤时自身守备力+400。"));

        // ============ 风属性怪兽 (6张) ============
        cards.add(createMonsterCard("wind_001", "wind", 3, 1400, 1000, "N",
            "召唤时抽1张卡。"));
        cards.add(createMonsterCard("wind_002", "wind", 5, 2000, 1400, "SR",
            "召唤时抽1张卡。"));
        cards.add(createMonsterCard("wind_003", "wind", 6, 2200, 1600, "SR",
            "召唤时对对方所有怪兽造成500点伤害。"));
        cards.add(createMonsterCard("wind_004", "wind", 1, 400, 300, "N",
            "召唤时抽1张卡。"));
        cards.add(createMonsterCard("wind_005", "wind", 6, 2400, 1800, "SR",
            "召唤时抽2张卡。"));
        cards.add(createMonsterCard("wind_006", "wind", 2, 1100, 700, "N",
            "召唤时抽1张卡。"));

        // ============ 地属性怪兽 (6张) ============
        cards.add(createMonsterCard("earth_001", "earth", 6, 1800, 2800, "SR",
            "召唤时自身守备力+800。"));
        cards.add(createMonsterCard("earth_002", "earth", 7, 2000, 3200, "SSR",
            "召唤时自身守备力+1000。"));
        cards.add(createMonsterCard("earth_003", "earth", 4, 1200, 2000, "R",
            "召唤时自身守备力+500。"));
        cards.add(createMonsterCard("earth_004", "earth", 2, 600, 1400, "N",
            "召唤时自身守备力+300。"));
        cards.add(createMonsterCard("earth_005", "earth", 5, 1500, 2400, "SR",
            "受到伤害后反弹500点伤害。"));
        cards.add(createMonsterCard("earth_006", "earth", 3, 900, 1600, "N",
            "受到伤害后反弹300点伤害。"));

        // ============ 光属性怪兽 (6张) ============
        cards.add(createMonsterCard("light_001", "light", 4, 1600, 1400, "R",
            "召唤时回复800生命值。"));
        cards.add(createMonsterCard("light_002", "light", 7, 2600, 2200, "SSR",
            "召唤时回复1500生命值。"));
        cards.add(createMonsterCard("light_003", "light", 2, 800, 1000, "N",
            "召唤时回复500生命值。"));
        cards.add(createMonsterCard("light_004", "light", 5, 1700, 1800, "SR",
            "召唤时回复1000生命值。"));
        cards.add(createMonsterCard("light_005", "light", 8, 3000, 2500, "SSR",
            "召唤时回复所有己方怪兽800生命值。"));
        cards.add(createMonsterCard("light_006", "light", 3, 1200, 1000, "N",
            "召唤时回复400生命值。"));

        // ============ 暗属性怪兽 (5张) ============
        cards.add(createMonsterCard("dark_001", "dark", 3, 1500, 800, "R",
            "召唤时对对方玩家造成500点伤害。"));
        cards.add(createMonsterCard("dark_002", "dark", 5, 2000, 1500, "SR",
            "召唤时选择破坏对方1只怪兽。"));
        cards.add(createMonsterCard("dark_003", "dark", 7, 2800, 2000, "SSR",
            "召唤时选择破坏对方1只怪兽。"));
        cards.add(createMonsterCard("dark_004", "dark", 1, 600, 400, "N",
            "造成伤害后吸取生命值。"));
        cards.add(createMonsterCard("dark_005", "dark", 4, 1600, 1000, "R",
            "造成伤害后吸取生命值。"));

        // ============ Nightcord UR 魔法卡 (9张) ============
        cards.add(createSpellCard("nc_sp_ur_001", "nightcord", "八千年的思念", "UR", 5,
            "从墓地复活1只2回合以内送入墓地的怪兽卡到场上（不限星数）。"));
        cards.add(createSpellCard("nc_sp_ur_002", "nightcord", "薄采序奏", "UR", 4,
            "指定己方1只怪兽，本回合内可以发动两次攻击。"));
        cards.add(createSpellCard("nc_sp_ur_003", "nightcord", "不登校的未来", "UR", 3,
            "指定对方1只怪兽返回手牌。"));
        cards.add(createSpellCard("nc_sp_ur_004", "nightcord", "放学后的茶会", "UR", 3,
            "回复前3个回合内失去的生命值，并抽1张卡。"));
        cards.add(createSpellCard("nc_sp_ur_005", "nightcord", "碎穹", "UR", 6,
            "支付90%当前生命值，破坏对方场上任意2只怪兽卡。"));
        cards.add(createSpellCard("nc_sp_ur_006", "nightcord", "有刺无刺", "UR", 4,
            "对方选择有刺或无刺。猜对：发动者抽1张卡。猜错：双方怪兽区全部破坏。"));
        cards.add(createSpellCard("nc_sp_ur_007", "nightcord", "社恐的焦虑", "UR", 4,
            "交换双方的手牌。"));
        cards.add(createSpellCard("nc_sp_ur_008", "nightcord", "月下传讯", "UR", 4,
            "抽3张卡。"));
        cards.add(createSpellCard("nc_sp_ur_009", "nightcord", "最好的伙伴", "UR", 5,
            "将手牌或场上两只特定怪兽融合，从牌组或手牌特殊召唤融合怪兽。"));

        // ============ Nightcord SSR 魔法卡 (6张) ============
        cards.add(createSpellCard("nc_sp_ss_001", "nightcord", "畸变DNA", "SSR", 4,
            "本回合己方所有怪兽攻击力+400，回合结束时永久-700。"));
        cards.add(createSpellCard("nc_sp_ss_002", "nightcord", "夏风石阶的挚友茶会", "SSR", 3,
            "抽2张卡。"));
        cards.add(createSpellCard("nc_sp_ss_003", "nightcord", "夜刻萦音的永续热忱", "SSR", 4,
            "回复2000生命值，并抽1张卡。"));
        cards.add(createSpellCard("nc_sp_ss_004", "nightcord", "幽蝶旧画的沉郁祈愿", "SSR", 5,
            "随机抽取对方手牌2张。若两张卡类型相同，归还对方；若类型不同，归你所有。"));
        cards.add(createSpellCard("nc_sp_ss_005", "nightcord", "奏响点亮天空", "SSR", 4,
            "将己方所有手牌送入墓地，然后抽取相同数量的卡。"));
        cards.add(createSpellCard("nc_sp_ss_006", "nightcord", "沉睡的蓝调", "SSR", 4,
            "将对方所有手牌送入墓地，然后对方抽取相同数量的卡。"));

        log.info("内置卡牌数据加载完成，共 {} 张", cards.size());
        return cards;
    }

    private Card createMonsterCard(String id, String attribute, int level,
                                    int attack, int defense, String rarity, String description) {
        Card card = new Card();
        card.setId(id);
        card.setName(id);
        card.setType("monster");
        card.setAttribute(attribute);
        card.setLevel(level);
        card.setAttack(attack);
        card.setDefense(defense);
        card.setRarity(rarity);
        card.setEnabled(true);
        card.setDescription(description);
        return card;
    }

    private Card createSpellCard(String id, String series, String name,
                                  String rarity, int cost, String description) {
        Card card = new Card();
        card.setId(id);
        card.setName(name);
        card.setSeries(series);
        card.setType("spell");
        card.setAttribute("dark");
        card.setLevel(0);
        card.setAttack(0);
        card.setDefense(0);
        card.setRarity(rarity);
        card.setCost(cost);
        card.setEnabled(true);
        card.setDescription(description);
        return card;
    }
}
