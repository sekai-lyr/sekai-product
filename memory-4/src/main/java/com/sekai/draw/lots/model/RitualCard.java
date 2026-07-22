package com.sekai.draw.lots.model;

public class RitualCard {
    private String position;
    private String theme;
    private DrawRecord record;

    public RitualCard() {
    }

    public RitualCard(String position, String theme, DrawRecord record) {
        this.position = position;
        this.theme = theme;
        this.record = record;
    }

    public String getPosition() { return position; }
    public void setPosition(String position) { this.position = position; }
    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }
    public DrawRecord getRecord() { return record; }
    public void setRecord(DrawRecord record) { this.record = record; }
}
