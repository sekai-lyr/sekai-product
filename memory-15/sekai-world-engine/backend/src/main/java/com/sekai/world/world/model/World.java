package com.sekai.world.world.model;

import java.time.LocalDateTime;

public class World {
    private Long id; private Long ownerId; private String name; private Long seed; private String visibility; private LocalDateTime createdAt;
    public World() {}
    public World(Long id, Long ownerId, String name, Long seed, String visibility, LocalDateTime createdAt) { this.id=id; this.ownerId=ownerId; this.name=name; this.seed=seed; this.visibility=visibility; this.createdAt=createdAt; }
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getOwnerId(){return ownerId;} public void setOwnerId(Long v){ownerId=v;} public String getName(){return name;} public void setName(String v){name=v;} public Long getSeed(){return seed;} public void setSeed(Long v){seed=v;} public String getVisibility(){return visibility;} public void setVisibility(String v){visibility=v;} public LocalDateTime getCreatedAt(){return createdAt;} public void setCreatedAt(LocalDateTime v){createdAt=v;}
    public Long id(){return id;} public Long ownerId(){return ownerId;} public String name(){return name;} public Long seed(){return seed;} public String visibility(){return visibility;} public LocalDateTime createdAt(){return createdAt;}
}
