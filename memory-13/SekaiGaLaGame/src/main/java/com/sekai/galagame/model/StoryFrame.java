package com.sekai.galagame.model;

import java.util.List;
import java.util.Map;

public class StoryFrame {
    private String nodeKey;
    private String nodeType;
    private String speakerName;
    private String speakerColor;
    private String text;
    private String bgImage;
    private String bgUrl;
    private List<Map<String, String>> sprites;
    private Map<String, String> flags;
    private List<ChoiceVO> choices;
    private boolean menu;
    private boolean end;
    private EndingVO ending;
    private int chapterNo;
    private String chapterTitle;
    private String labelName;

    public String getNodeKey() { return nodeKey; }
    public void setNodeKey(String nodeKey) { this.nodeKey = nodeKey; }
    public String getNodeType() { return nodeType; }
    public void setNodeType(String nodeType) { this.nodeType = nodeType; }
    public String getSpeakerName() { return speakerName; }
    public void setSpeakerName(String speakerName) { this.speakerName = speakerName; }
    public String getSpeakerColor() { return speakerColor; }
    public void setSpeakerColor(String speakerColor) { this.speakerColor = speakerColor; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getBgImage() { return bgImage; }
    public void setBgImage(String bgImage) { this.bgImage = bgImage; }
    public String getBgUrl() { return bgUrl; }
    public void setBgUrl(String bgUrl) { this.bgUrl = bgUrl; }
    public List<Map<String, String>> getSprites() { return sprites; }
    public void setSprites(List<Map<String, String>> sprites) { this.sprites = sprites; }
    public Map<String, String> getFlags() { return flags; }
    public void setFlags(Map<String, String> flags) { this.flags = flags; }
    public List<ChoiceVO> getChoices() { return choices; }
    public void setChoices(List<ChoiceVO> choices) { this.choices = choices; }
    public boolean isMenu() { return menu; }
    public void setMenu(boolean menu) { this.menu = menu; }
    public boolean isEnd() { return end; }
    public void setEnd(boolean end) { this.end = end; }
    public EndingVO getEnding() { return ending; }
    public void setEnding(EndingVO ending) { this.ending = ending; }
    public int getChapterNo() { return chapterNo; }
    public void setChapterNo(int chapterNo) { this.chapterNo = chapterNo; }
    public String getChapterTitle() { return chapterTitle; }
    public void setChapterTitle(String chapterTitle) { this.chapterTitle = chapterTitle; }
    public String getLabelName() { return labelName; }
    public void setLabelName(String labelName) { this.labelName = labelName; }
}
