package com.sekai.world.simulation.model;

import java.time.LocalDate;

public class SimulationTick {
    private Long id; private Long branchId; private String tickKey; private LocalDate fromDate; private LocalDate toDate; private String resultJson;
    public SimulationTick() {} public SimulationTick(Long id,Long branchId,String tickKey,LocalDate fromDate,LocalDate toDate,String resultJson){this.id=id;this.branchId=branchId;this.tickKey=tickKey;this.fromDate=fromDate;this.toDate=toDate;this.resultJson=resultJson;}
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getBranchId(){return branchId;} public void setBranchId(Long v){branchId=v;} public String getTickKey(){return tickKey;} public void setTickKey(String v){tickKey=v;} public LocalDate getFromDate(){return fromDate;} public void setFromDate(LocalDate v){fromDate=v;} public LocalDate getToDate(){return toDate;} public void setToDate(LocalDate v){toDate=v;} public String getResultJson(){return resultJson;} public void setResultJson(String v){resultJson=v;}
    public Long id(){return id;} public Long branchId(){return branchId;} public String tickKey(){return tickKey;} public LocalDate fromDate(){return fromDate;} public LocalDate toDate(){return toDate;} public String resultJson(){return resultJson;}
}
