package com.sekai.draw.lots.model;

public class Achievement {
    private String code;
    private String title;
    private String description;
    private String tier;
    private Integer progress;
    private Integer target;
    private boolean unlocked;
    private String hint;

    public Achievement() {
    }

    public Achievement(String code, String title, String description, String tier, Integer progress, Integer target, String hint) {
        this.code = code;
        this.title = title;
        this.description = description;
        this.tier = tier;
        this.progress = progress;
        this.target = target;
        this.unlocked = progress != null && target != null && progress >= target;
        this.hint = hint;
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTier() { return tier; }
    public void setTier(String tier) { this.tier = tier; }
    public Integer getProgress() { return progress; }
    public void setProgress(Integer progress) { this.progress = progress; }
    public Integer getTarget() { return target; }
    public void setTarget(Integer target) { this.target = target; }
    public boolean isUnlocked() { return unlocked; }
    public void setUnlocked(boolean unlocked) { this.unlocked = unlocked; }
    public String getHint() { return hint; }
    public void setHint(String hint) { this.hint = hint; }

    public int getProgressPercent() {
        if (progress == null || target == null || target <= 0) {
            return 0;
        }
        return Math.min(100, Math.round(progress * 100f / target));
    }
}
