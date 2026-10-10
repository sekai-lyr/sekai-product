package com.sekai.world.location.model;

public class Faction {
    private Long id; private Long worldId; private String name; private String description;
    public Faction() {} public Faction(Long id,Long worldId,String name,String description){this.id=id;this.worldId=worldId;this.name=name;this.description=description;}
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getWorldId(){return worldId;} public void setWorldId(Long v){worldId=v;} public String getName(){return name;} public void setName(String v){name=v;} public String getDescription(){return description;} public void setDescription(String v){description=v;}
    public Long id(){return id;} public Long worldId(){return worldId;} public String name(){return name;} public String description(){return description;}
}
