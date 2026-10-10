using System;
using UnityEngine;

public enum CreatureElement
{
    Glow,
    Wind,
    Water,
    Fire,
    Stone,
    Star
}

[Serializable]
public sealed class CreatureDefinition
{
    public string Id;
    public string Name;
    public string EnglishName;
    public string Description;
    public string ElementLabel;
    public CreatureElement Element;
    public int Level;
    public int MaxHp;
    public int Attack;
    public Color BodyColor;
    public Color AccentColor;
    public bool IsWild;
    public WorldMap SpawnMap;
    public Vector2 SpawnPosition;

    public CreatureDefinition(
        string id,
        string name,
        string englishName,
        string description,
        string elementLabel,
        CreatureElement element,
        int level,
        int maxHp,
        int attack,
        Color bodyColor,
        Color accentColor,
        bool isWild,
        WorldMap spawnMap = WorldMap.Town,
        Vector2 spawnPosition = default)
    {
        Id = id;
        Name = name;
        EnglishName = englishName;
        Description = description;
        ElementLabel = elementLabel;
        Element = element;
        Level = level;
        MaxHp = maxHp;
        Attack = attack;
        BodyColor = bodyColor;
        AccentColor = accentColor;
        IsWild = isWild;
        SpawnMap = spawnMap;
        SpawnPosition = spawnPosition;
    }
}

public static class CreatureCatalog
{
    public static readonly CreatureDefinition Charmander = new CreatureDefinition(
        "charmander",
        "小火龙",
        "Charmander",
        "尾巴上的火焰代表生命力，温暖而明亮。",
        "火 / 伙伴",
        CreatureElement.Fire,
        5,
        44,
        12,
        new Color(0.95f, 0.36f, 0.12f),
        new Color(1f, 0.82f, 0.38f),
        false);

    public static CreatureDefinition Starter => All[0];

    public static readonly CreatureDefinition[] All =
    {
        new CreatureDefinition("spriglet", "芽芽兽", "Spriglet", "会把清晨露水点成小灯的森林幼兽。", "荧光 / 草地", CreatureElement.Glow, 5, 42, 10, new Color(0.91f, 0.58f, 0.44f), new Color(1f, 0.94f, 0.74f), false),
        new CreatureDefinition("cloud-tail", "云尾兽", "Mistral Pup", "住在风铃树冠之间，尾巴会留下淡淡的云。", "风 / 晴空", CreatureElement.Wind, 6, 32, 8, new Color(0.48f, 0.77f, 0.82f), new Color(0.84f, 0.96f, 0.91f), true, WorldMap.Trail, new Vector2(5.2f, -8f)),
        new CreatureDefinition("tide-ear", "潮耳兽", "Tidekin", "在湖岸寻找会发光的贝壳，喜欢跟着旅人散步。", "水 / 湖岸", CreatureElement.Water, 7, 38, 9, new Color(0.42f, 0.66f, 0.86f), new Color(1f, 0.88f, 0.64f), true, WorldMap.Trail, new Vector2(8.5f, -20f)),
        new CreatureDefinition("ember-mole", "栗角兽", "Cinderhorn", "额角藏着温暖火种，黄昏时最容易遇见它。", "火 / 黄昏", CreatureElement.Fire, 9, 46, 12, new Color(0.83f, 0.49f, 0.37f), new Color(1f, 0.82f, 0.49f), true, WorldMap.Trail, new Vector2(-8.7f, -16f)),
        new CreatureDefinition("stone-sprout", "岩芽兽", "Mossback", "背上的晶石会吸收阳光，性格安静而可靠。", "岩 / 晶石", CreatureElement.Stone, 11, 54, 13, new Color(0.61f, 0.53f, 0.79f), new Color(0.95f, 0.84f, 0.68f), true, WorldMap.Grove, new Vector2(-4.4f, -10f)),
        new CreatureDefinition("star-shell", "星壳兽", "Aster Shell", "会在夜里展开星纹外壳，为迷路者指引方向。", "星 / 夜光", CreatureElement.Star, 13, 62, 15, new Color(0.41f, 0.49f, 0.76f), new Color(0.83f, 0.89f, 1f), true, WorldMap.Grove, new Vector2(7.9f, -19f)),
    };

    public static CreatureDefinition Find(string id)
    {
        var pokemon = PokemonWildlife.Find(id);
        if (pokemon != null) return pokemon;
        if (Charmander.Id == id) return Charmander;

        for (var index = 0; index < All.Length; index++)
        {
            if (All[index].Id == id) return All[index];
        }
        return null;
    }
}
