package com.sekai.galagame.dataobject;

public class SekaiGalagameChoiceDO {
    private Long id;
    private String nodeKey;
    private String optionText;
    private String nextKey;
    private Integer orderNo;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNodeKey() { return nodeKey; }
    public void setNodeKey(String nodeKey) { this.nodeKey = nodeKey; }
    public String getOptionText() { return optionText; }
    public void setOptionText(String optionText) { this.optionText = optionText; }
    public String getNextKey() { return nextKey; }
    public void setNextKey(String nextKey) { this.nextKey = nextKey; }
    public Integer getOrderNo() { return orderNo; }
    public void setOrderNo(Integer orderNo) { this.orderNo = orderNo; }
}
