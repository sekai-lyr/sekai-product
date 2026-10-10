package com.sekai.world.world.service;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class SeedWorldCatalog {
    public String cityName() { return "星港市"; }
    public String cityDescription() { return "一座由潮汐电网、旧城区和夜间集市共同维系的海湾城市。"; }

    public List<LocationSeed> locations() {
        return List.of(
                new LocationSeed("潮汐广场", "CIVIC", 500, "城市的公共心脏，潮汐钟每天在这里报时。"),
                new LocationSeed("雾灯车站", "TRANSIT", 300, "连接旧城区与港口的高架车站。"),
                new LocationSeed("灰杉档案馆", "ARCHIVE", 120, "保存城市契约、旧地图和失效的世界规则。"),
                new LocationSeed("蓝穹温室", "GARDEN", 180, "由废弃水塔改造的社区温室。"),
                new LocationSeed("回声码头", "HARBOR", 260, "商船、修理艇和匿名消息在这里交换。")
        );
    }

    public List<FactionSeed> factions() {
        return List.of(
                new FactionSeed("潮汐议会", "管理城市水、电与公共秩序的自治组织。"),
                new FactionSeed("雾灯行会", "掌握交通、信使和夜间护航路线的行业联盟。"),
                new FactionSeed("种子守望者", "维护温室、粮食和城市生态记忆的民间团体。")
        );
    }

    public List<ActorSeed> actors() {
        String[][] values = {
                {"林澈", "潮汐钟维护员", "0", "0"}, {"岑遥", "议会记录官", "0", "2"},
                {"周野", "水网调度员", "0", "4"}, {"白榆", "车站领航员", "1", "1"},
                {"迟墨", "夜间信使", "1", "4"}, {"苏芮", "路线修补师", "1", "3"},
                {"叶弦", "温室培育师", "2", "3"}, {"唐栖", "种子 archivist", "2", "2"},
                {"闻舟", "潮汐厨师", "2", "0"}, {"宁灯", "自由地图师", "-1", "1"},
                {"容川", "码头谈判者", "1", "4"}, {"简星", "街头观测者", "-1", "0"}
        };
        return java.util.Arrays.stream(values)
                .map(value -> new ActorSeed(value[0], value[1], Integer.parseInt(value[2]), Integer.parseInt(value[3])))
                .toList();
    }

    public List<RuleSeed> rules() {
        return List.of(
                new RuleSeed("rest-when-tired", "疲劳时恢复", "ENERGY_BELOW", 35, "MOOD_DELTA", 4),
                new RuleSeed("calm-morning", "清晨平静", "ALWAYS", 0, "MOOD_DELTA", 1),
                new RuleSeed("water-reminder", "潮汐供水提醒", "ALWAYS", 0, "MOOD_DELTA", 1),
                new RuleSeed("archive-focus", "档案专注", "ENERGY_BELOW", 25, "MOOD_DELTA", 2),
                new RuleSeed("greenhouse-breath", "温室呼吸", "ALWAYS", 0, "MOOD_DELTA", 1),
                new RuleSeed("night-fatigue", "夜间疲劳", "ENERGY_BELOW", 20, "MOOD_DELTA", 2),
                new RuleSeed("market-rumor", "集市传闻", "ALWAYS", 0, "MOOD_DELTA", 1),
                new RuleSeed("harbor-wind", "码头风讯", "ALWAYS", 0, "MOOD_DELTA", 1),
                new RuleSeed("station-rhythm", "车站节奏", "ALWAYS", 0, "MOOD_DELTA", 1),
                new RuleSeed("city-memory", "城市记忆", "ALWAYS", 0, "MOOD_DELTA", 1)
        );
    }

    public List<TemplateSeed> templates() {
        return java.util.stream.IntStream.rangeClosed(1, 20)
                .mapToObj(index -> new TemplateSeed(
                        "signal-" + String.format("%02d", index), "第 " + index + " 号潮汐信号",
                        "城市某处出现了一段需要被理解的潮汐信号。",
                        index == 1 ? 100 : 35 + (index % 4) * 10, 100 - index,
                        "前往调查", 5, "暂时记录", -2))
                .toList();
    }

    public record LocationSeed(String name, String kind, int capacity, String description) {}
    public record FactionSeed(String name, String description) {}
    public record ActorSeed(String name, String role, int factionIndex, int locationIndex) {}
    public record RuleSeed(String code, String name, String conditionType, int thresholdValue, String effectType, int effectValue) {}
    public record TemplateSeed(String code, String name, String description, int probabilityPercent, int priority,
                               String positiveLabel, int positiveMoodDelta, String negativeLabel, int negativeMoodDelta) {}
}
