package com.sekai.dataobject.dataobject;

import com.sekai.dataobject.model.CharacterInfo;
import org.springframework.beans.BeanUtils;

import java.time.LocalDateTime;

public class SekaiDataObjectCharacterDO {

    private Long id;

    private Long seriesId;

    private String name;

    private String originalName;

    private String role;

    private String voiceActor;

    private String description;

    private String imageUrl;

    private LocalDateTime createTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSeriesId() {
        return seriesId;
    }

    public void setSeriesId(Long seriesId) {
        this.seriesId = seriesId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getOriginalName() {
        return originalName;
    }

    public void setOriginalName(String originalName) {
        this.originalName = originalName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getVoiceActor() {
        return voiceActor;
    }

    public void setVoiceActor(String voiceActor) {
        this.voiceActor = voiceActor;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }

    public SekaiDataObjectCharacterDO() {
    }

    public SekaiDataObjectCharacterDO(CharacterInfo characterInfo) {
        BeanUtils.copyProperties(characterInfo, this);
    }

    public CharacterInfo convertToCharacterInfo() {
        CharacterInfo characterInfo = new CharacterInfo();
        BeanUtils.copyProperties(this, characterInfo);
        return characterInfo;
    }
}
