package com.sekai.world.world.model;

import java.time.LocalDate;

public class WorldClock {
    private Long branchId; private LocalDate currentDate; private String lastTickKey; private Long worldSeed; private Long version;
    public WorldClock() {}
    public WorldClock(Long branchId, LocalDate currentDate, String lastTickKey, Long worldSeed, Long version) { this.branchId=branchId; this.currentDate=currentDate; this.lastTickKey=lastTickKey; this.worldSeed=worldSeed; this.version=version; }
    public Long getBranchId(){return branchId;} public void setBranchId(Long v){branchId=v;} public LocalDate getCurrentDate(){return currentDate;} public void setCurrentDate(LocalDate v){currentDate=v;} public String getLastTickKey(){return lastTickKey;} public void setLastTickKey(String v){lastTickKey=v;} public Long getWorldSeed(){return worldSeed;} public void setWorldSeed(Long v){worldSeed=v;} public Long getVersion(){return version;} public void setVersion(Long v){version=v;}
    public Long branchId(){return branchId;} public LocalDate currentDate(){return currentDate;} public String lastTickKey(){return lastTickKey;} public Long worldSeed(){return worldSeed;} public Long version(){return version;}
}
