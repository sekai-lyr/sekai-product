package com.sekai.world.actor.model;

import java.time.LocalTime;

public class ActorSchedule {
    private Long id; private Long actorId; private Integer dayOfWeek; private LocalTime startTime; private Long locationId; private String activity; private Integer priority; private Integer energyDelta; private Integer moodDelta;
    public ActorSchedule() {} public ActorSchedule(Long id,Long actorId,Integer dayOfWeek,LocalTime startTime,Long locationId,String activity,Integer priority,Integer energyDelta,Integer moodDelta){this.id=id;this.actorId=actorId;this.dayOfWeek=dayOfWeek;this.startTime=startTime;this.locationId=locationId;this.activity=activity;this.priority=priority;this.energyDelta=energyDelta;this.moodDelta=moodDelta;}
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getActorId(){return actorId;} public void setActorId(Long v){actorId=v;} public Integer getDayOfWeek(){return dayOfWeek;} public void setDayOfWeek(Integer v){dayOfWeek=v;} public LocalTime getStartTime(){return startTime;} public void setStartTime(LocalTime v){startTime=v;} public Long getLocationId(){return locationId;} public void setLocationId(Long v){locationId=v;} public String getActivity(){return activity;} public void setActivity(String v){activity=v;} public Integer getPriority(){return priority;} public void setPriority(Integer v){priority=v;} public Integer getEnergyDelta(){return energyDelta;} public void setEnergyDelta(Integer v){energyDelta=v;} public Integer getMoodDelta(){return moodDelta;} public void setMoodDelta(Integer v){moodDelta=v;}
    public Long id(){return id;} public Long actorId(){return actorId;} public Integer dayOfWeek(){return dayOfWeek;} public LocalTime startTime(){return startTime;} public Long locationId(){return locationId;} public String activity(){return activity;} public Integer priority(){return priority;} public Integer energyDelta(){return energyDelta;} public Integer moodDelta(){return moodDelta;}
}
