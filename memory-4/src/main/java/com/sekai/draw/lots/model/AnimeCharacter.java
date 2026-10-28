package com.sekai.draw.lots.model;

import com.sekai.draw.lots.util.CharacterLocalizationUtil;

import java.time.LocalDateTime;

public class AnimeCharacter {
    private boolean enabled = true;

    private Long id;
    private String englishName;
    private String japaneseName;
    private String animeTitle;
    private String archetype;
    private String element;
    private String imageUrl;
    private String quote;
    private Integer popularity;
    private LocalDateTime createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEnglishName() { return englishName; }
    public void setEnglishName(String englishName) { this.englishName = englishName; }
    public String getJapaneseName() { return japaneseName; }
    public void setJapaneseName(String japaneseName) { this.japaneseName = japaneseName; }
    public String getAnimeTitle() { return animeTitle; }
    public void setAnimeTitle(String animeTitle) { this.animeTitle = animeTitle; }
    public String getArchetype() { return archetype; }
    public void setArchetype(String archetype) { this.archetype = archetype; }
    public String getElement() { return element; }
    public void setElement(String element) { this.element = element; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public String getQuote() { return quote; }
    public void setQuote(String quote) { this.quote = quote; }
    public Integer getPopularity() { return popularity; }
    public void setPopularity(Integer popularity) { this.popularity = popularity; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }

    public String getDisplayName() {
        return CharacterLocalizationUtil.displayName(englishName);
    }

    public String getDisplayAnimeTitle() {
        return CharacterLocalizationUtil.displayAnimeTitle(animeTitle);
    }

    public String getDisplayArchetype() {
        return CharacterLocalizationUtil.displayRoleType(archetype);
    }

    public String getDisplayElement() {
        return CharacterLocalizationUtil.displayEnergy(element);
    }

    public String getDisplayQuote() {
        return CharacterLocalizationUtil.displayTags(quote, archetype, element);
    }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
