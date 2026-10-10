package com.sekai.world.story.model;

import java.time.LocalDate;

public class WorldEvent {
    private Long id; private Long branchId; private Long templateId; private LocalDate occurredOn; private String status; private String title; private String description; private String payloadJson; private String idempotencyKey;
    public WorldEvent() {} public WorldEvent(Long id,Long branchId,Long templateId,LocalDate occurredOn,String status,String title,String description,String payloadJson,String idempotencyKey){this.id=id;this.branchId=branchId;this.templateId=templateId;this.occurredOn=occurredOn;this.status=status;this.title=title;this.description=description;this.payloadJson=payloadJson;this.idempotencyKey=idempotencyKey;}
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getBranchId(){return branchId;} public void setBranchId(Long v){branchId=v;} public Long getTemplateId(){return templateId;} public void setTemplateId(Long v){templateId=v;} public LocalDate getOccurredOn(){return occurredOn;} public void setOccurredOn(LocalDate v){occurredOn=v;} public String getStatus(){return status;} public void setStatus(String v){status=v;} public String getTitle(){return title;} public void setTitle(String v){title=v;} public String getDescription(){return description;} public void setDescription(String v){description=v;} public String getPayloadJson(){return payloadJson;} public void setPayloadJson(String v){payloadJson=v;} public String getIdempotencyKey(){return idempotencyKey;} public void setIdempotencyKey(String v){idempotencyKey=v;}
    public Long id(){return id;} public Long branchId(){return branchId;} public Long templateId(){return templateId;} public LocalDate occurredOn(){return occurredOn;} public String status(){return status;} public String title(){return title;} public String description(){return description;} public String payloadJson(){return payloadJson;} public String idempotencyKey(){return idempotencyKey;}
}
