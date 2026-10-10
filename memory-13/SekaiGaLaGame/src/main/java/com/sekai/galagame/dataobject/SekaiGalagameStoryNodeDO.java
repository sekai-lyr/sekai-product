package com.sekai.galagame.dataobject;

public class SekaiGalagameStoryNodeDO {
    private Long id;
    private String nodeKey;
    private String labelName;
    private Integer chapterNo;
    private String nodeType;
    private Integer seqNo;
    private String speakerKey;
    private String speakerName;
    private String text;
    private String bgImage;
    private String sprites;
    private String setVar;
    private String setValue;
    private String nextKey;
    private String endingKey;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNodeKey() { return nodeKey; }
    public void setNodeKey(String nodeKey) { this.nodeKey = nodeKey; }
    public String getLabelName() { return labelName; }
    public void setLabelName(String labelName) { this.labelName = labelName; }
    public Integer getChapterNo() { return chapterNo; }
    public void setChapterNo(Integer chapterNo) { this.chapterNo = chapterNo; }
    public String getNodeType() { return nodeType; }
    public void setNodeType(String nodeType) { this.nodeType = nodeType; }
    public Integer getSeqNo() { return seqNo; }
    public void setSeqNo(Integer seqNo) { this.seqNo = seqNo; }
    public String getSpeakerKey() { return speakerKey; }
    public void setSpeakerKey(String speakerKey) { this.speakerKey = speakerKey; }
    public String getSpeakerName() { return speakerName; }
    public void setSpeakerName(String speakerName) { this.speakerName = speakerName; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getBgImage() { return bgImage; }
    public void setBgImage(String bgImage) { this.bgImage = bgImage; }
    public String getSprites() { return sprites; }
    public void setSprites(String sprites) { this.sprites = sprites; }
    public String getSetVar() { return setVar; }
    public void setSetVar(String setVar) { this.setVar = setVar; }
    public String getSetValue() { return setValue; }
    public void setSetValue(String setValue) { this.setValue = setValue; }
    public String getNextKey() { return nextKey; }
    public void setNextKey(String nextKey) { this.nextKey = nextKey; }
    public String getEndingKey() { return endingKey; }
    public void setEndingKey(String endingKey) { this.endingKey = endingKey; }
}
