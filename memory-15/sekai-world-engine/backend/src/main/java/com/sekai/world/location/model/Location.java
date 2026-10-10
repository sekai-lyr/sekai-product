package com.sekai.world.location.model;

public class Location {
    private Long id; private Long cityId; private String name; private String kind; private Integer capacity; private String description;
    public Location() {} public Location(Long id,Long cityId,String name,String kind,Integer capacity,String description){this.id=id;this.cityId=cityId;this.name=name;this.kind=kind;this.capacity=capacity;this.description=description;}
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getCityId(){return cityId;} public void setCityId(Long v){cityId=v;} public String getName(){return name;} public void setName(String v){name=v;} public String getKind(){return kind;} public void setKind(String v){kind=v;} public Integer getCapacity(){return capacity;} public void setCapacity(Integer v){capacity=v;} public String getDescription(){return description;} public void setDescription(String v){description=v;}
    public Long id(){return id;} public Long cityId(){return cityId;} public String name(){return name;} public String kind(){return kind;} public Integer capacity(){return capacity;} public String description(){return description;}
}
