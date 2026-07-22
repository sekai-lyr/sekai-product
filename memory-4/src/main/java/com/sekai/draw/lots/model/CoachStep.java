package com.sekai.draw.lots.model;

public class CoachStep {
    private Integer dayIndex;
    private String title;
    private String theme;
    private String action;
    private String checkpoint;
    private String energyLabel;

    public CoachStep() {
    }

    public CoachStep(Integer dayIndex, String title, String theme, String action, String checkpoint, String energyLabel) {
        this.dayIndex = dayIndex;
        this.title = title;
        this.theme = theme;
        this.action = action;
        this.checkpoint = checkpoint;
        this.energyLabel = energyLabel;
    }

    public Integer getDayIndex() { return dayIndex; }
    public void setDayIndex(Integer dayIndex) { this.dayIndex = dayIndex; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getCheckpoint() { return checkpoint; }
    public void setCheckpoint(String checkpoint) { this.checkpoint = checkpoint; }
    public String getEnergyLabel() { return energyLabel; }
    public void setEnergyLabel(String energyLabel) { this.energyLabel = energyLabel; }
}
