package com.sekai.draw.lots.model;

public class CharacterRecommendation {
    private AnimeCharacter character;
    private Integer affinityScore;
    private String reason;
    private String signal;

    public CharacterRecommendation() {
    }

    public CharacterRecommendation(AnimeCharacter character, Integer affinityScore, String reason, String signal) {
        this.character = character;
        this.affinityScore = affinityScore;
        this.reason = reason;
        this.signal = signal;
    }

    public AnimeCharacter getCharacter() { return character; }
    public void setCharacter(AnimeCharacter character) { this.character = character; }
    public Integer getAffinityScore() { return affinityScore; }
    public void setAffinityScore(Integer affinityScore) { this.affinityScore = affinityScore; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getSignal() { return signal; }
    public void setSignal(String signal) { this.signal = signal; }
}
