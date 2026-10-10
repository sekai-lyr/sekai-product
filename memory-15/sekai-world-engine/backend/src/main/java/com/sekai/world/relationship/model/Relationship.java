package com.sekai.world.relationship.model;

public class Relationship {
    private Long id; private Long worldId; private Long fromActorId; private Long toActorId; private Integer affinity; private Integer trust; private Integer hostility; private Integer influence;
    public Relationship() {} public Relationship(Long id,Long worldId,Long fromActorId,Long toActorId,Integer affinity,Integer trust,Integer hostility,Integer influence){this.id=id;this.worldId=worldId;this.fromActorId=fromActorId;this.toActorId=toActorId;this.affinity=affinity;this.trust=trust;this.hostility=hostility;this.influence=influence;}
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getWorldId(){return worldId;} public void setWorldId(Long v){worldId=v;} public Long getFromActorId(){return fromActorId;} public void setFromActorId(Long v){fromActorId=v;} public Long getToActorId(){return toActorId;} public void setToActorId(Long v){toActorId=v;} public Integer getAffinity(){return affinity;} public void setAffinity(Integer v){affinity=v;} public Integer getTrust(){return trust;} public void setTrust(Integer v){trust=v;} public Integer getHostility(){return hostility;} public void setHostility(Integer v){hostility=v;} public Integer getInfluence(){return influence;} public void setInfluence(Integer v){influence=v;}
}
