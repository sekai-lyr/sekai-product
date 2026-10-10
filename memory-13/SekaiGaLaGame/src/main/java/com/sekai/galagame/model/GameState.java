package com.sekai.galagame.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class GameState {
    private String nodeKey;
    private String scene;
    private List<Map<String, String>> sprites = new ArrayList<>();
    private Map<String, String> flags = new LinkedHashMap<>();
    private int chapterNo;
    private String chapterTitle;
    private String labelName;

    public String getNodeKey() { return nodeKey; }
    public void setNodeKey(String nodeKey) { this.nodeKey = nodeKey; }
    public String getScene() { return scene; }
    public void setScene(String scene) { this.scene = scene; }
    public List<Map<String, String>> getSprites() { return sprites; }
    public void setSprites(List<Map<String, String>> sprites) { this.sprites = sprites; }
    public Map<String, String> getFlags() { return flags; }
    public void setFlags(Map<String, String> flags) { this.flags = flags; }
    public int getChapterNo() { return chapterNo; }
    public void setChapterNo(int chapterNo) { this.chapterNo = chapterNo; }
    public String getChapterTitle() { return chapterTitle; }
    public void setChapterTitle(String chapterTitle) { this.chapterTitle = chapterTitle; }
    public String getLabelName() { return labelName; }
    public void setLabelName(String labelName) { this.labelName = labelName; }
}
