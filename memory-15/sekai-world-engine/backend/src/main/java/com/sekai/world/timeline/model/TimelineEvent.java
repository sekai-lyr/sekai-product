package com.sekai.world.timeline.model;

import java.time.LocalDate;

public class TimelineEvent {
    private Long id; private Long branchId; private Long tickId; private Long eventId; private String eventType; private String summary; private String payloadJson; private LocalDate occurredOn;
    public TimelineEvent() {} public TimelineEvent(Long id,Long branchId,Long tickId,Long eventId,String eventType,String summary,String payloadJson,LocalDate occurredOn){this.id=id;this.branchId=branchId;this.tickId=tickId;this.eventId=eventId;this.eventType=eventType;this.summary=summary;this.payloadJson=payloadJson;this.occurredOn=occurredOn;}
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getBranchId(){return branchId;} public void setBranchId(Long v){branchId=v;} public Long getTickId(){return tickId;} public void setTickId(Long v){tickId=v;} public Long getEventId(){return eventId;} public void setEventId(Long v){eventId=v;} public String getEventType(){return eventType;} public void setEventType(String v){eventType=v;} public String getSummary(){return summary;} public void setSummary(String v){summary=v;} public String getPayloadJson(){return payloadJson;} public void setPayloadJson(String v){payloadJson=v;} public LocalDate getOccurredOn(){return occurredOn;} public void setOccurredOn(LocalDate v){occurredOn=v;}
}
