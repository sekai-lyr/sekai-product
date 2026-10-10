package com.sekai.world.location.model;

public class LocationConnection {
    private Long id; private Long fromLocationId; private Long toLocationId; private Integer travelDays;
    public LocationConnection() {} public LocationConnection(Long id,Long fromLocationId,Long toLocationId,Integer travelDays){this.id=id;this.fromLocationId=fromLocationId;this.toLocationId=toLocationId;this.travelDays=travelDays;}
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getFromLocationId(){return fromLocationId;} public void setFromLocationId(Long v){fromLocationId=v;} public Long getToLocationId(){return toLocationId;} public void setToLocationId(Long v){toLocationId=v;} public Integer getTravelDays(){return travelDays;} public void setTravelDays(Integer v){travelDays=v;}
    public Long id(){return id;} public Long fromLocationId(){return fromLocationId;} public Long toLocationId(){return toLocationId;} public Integer travelDays(){return travelDays;}
}
