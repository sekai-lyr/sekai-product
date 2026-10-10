package com.sekai.world.timeline.model;

public class StateChange {
    private Long id; private Long timelineEventId; private String entityType; private Long entityId; private String fieldPath; private String beforeValue; private String afterValue;
    public StateChange() {} public StateChange(Long id,Long timelineEventId,String entityType,Long entityId,String fieldPath,String beforeValue,String afterValue){this.id=id;this.timelineEventId=timelineEventId;this.entityType=entityType;this.entityId=entityId;this.fieldPath=fieldPath;this.beforeValue=beforeValue;this.afterValue=afterValue;}
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getTimelineEventId(){return timelineEventId;} public void setTimelineEventId(Long v){timelineEventId=v;} public String getEntityType(){return entityType;} public void setEntityType(String v){entityType=v;} public Long getEntityId(){return entityId;} public void setEntityId(Long v){entityId=v;} public String getFieldPath(){return fieldPath;} public void setFieldPath(String v){fieldPath=v;} public String getBeforeValue(){return beforeValue;} public void setBeforeValue(String v){beforeValue=v;} public String getAfterValue(){return afterValue;} public void setAfterValue(String v){afterValue=v;}
}
