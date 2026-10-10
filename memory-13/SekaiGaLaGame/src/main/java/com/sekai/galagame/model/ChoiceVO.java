package com.sekai.galagame.model;

public class ChoiceVO {
    private Long id;
    private String text;
    private String nextKey;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getNextKey() { return nextKey; }
    public void setNextKey(String nextKey) { this.nextKey = nextKey; }
}
