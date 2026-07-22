package com.sekai.draw.lots.model;

public class ReportPoint {
    private String label;
    private Integer score;
    private String characterName;
    private String wishTopic;

    public ReportPoint() {
    }

    public ReportPoint(String label, Integer score, String characterName, String wishTopic) {
        this.label = label;
        this.score = score;
        this.characterName = characterName;
        this.wishTopic = wishTopic;
    }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }
    public String getCharacterName() { return characterName; }
    public void setCharacterName(String characterName) { this.characterName = characterName; }
    public String getWishTopic() { return wishTopic; }
    public void setWishTopic(String wishTopic) { this.wishTopic = wishTopic; }
}
