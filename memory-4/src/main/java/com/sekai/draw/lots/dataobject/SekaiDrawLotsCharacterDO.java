package com.sekai.draw.lots.dataobject;

import com.sekai.draw.lots.model.AnimeCharacter;
import org.springframework.beans.BeanUtils;

import java.time.LocalDateTime;

public class SekaiDrawLotsCharacterDO {
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

    public AnimeCharacter convertToCharacter() {
        AnimeCharacter character = new AnimeCharacter();
        BeanUtils.copyProperties(this, character);
        return character;
    }

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
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
