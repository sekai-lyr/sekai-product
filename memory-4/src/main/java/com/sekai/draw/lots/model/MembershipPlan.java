package com.sekai.draw.lots.model;

import java.util.List;

public class MembershipPlan {
    private String code;
    private String name;
    private Integer amountCent;
    private Integer days;
    private String tagline;
    private String badge;
    private boolean highlighted;
    private List<String> features;

    public MembershipPlan() {
    }

    public MembershipPlan(String code, String name, Integer amountCent, Integer days, String tagline,
                          String badge, boolean highlighted, List<String> features) {
        this.code = code;
        this.name = name;
        this.amountCent = amountCent;
        this.days = days;
        this.tagline = tagline;
        this.badge = badge;
        this.highlighted = highlighted;
        this.features = features;
    }

    public String getPriceText() {
        if (amountCent == null) {
            return "0.00";
        }
        return String.format("%.2f", amountCent / 100.0);
    }

    public String getDailyPriceText() {
        if (amountCent == null || days == null || days <= 0) {
            return "0.00";
        }
        return String.format("%.2f", amountCent / 100.0 / days);
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getAmountCent() { return amountCent; }
    public void setAmountCent(Integer amountCent) { this.amountCent = amountCent; }
    public Integer getDays() { return days; }
    public void setDays(Integer days) { this.days = days; }
    public String getTagline() { return tagline; }
    public void setTagline(String tagline) { this.tagline = tagline; }
    public String getBadge() { return badge; }
    public void setBadge(String badge) { this.badge = badge; }
    public boolean isHighlighted() { return highlighted; }
    public void setHighlighted(boolean highlighted) { this.highlighted = highlighted; }
    public List<String> getFeatures() { return features; }
    public void setFeatures(List<String> features) { this.features = features; }
}
