package com.sekai.world.world.model;

import java.time.LocalDateTime;

public class WorldBranch {
    private Long id; private Long worldId; private Long parentBranchId; private Long forkSnapshotId; private String name; private String status; private LocalDateTime createdAt;
    public WorldBranch() {}
    public WorldBranch(Long id, Long worldId, Long parentBranchId, Long forkSnapshotId, String name, String status, LocalDateTime createdAt) { this.id=id; this.worldId=worldId; this.parentBranchId=parentBranchId; this.forkSnapshotId=forkSnapshotId; this.name=name; this.status=status; this.createdAt=createdAt; }
    public Long getId(){return id;} public void setId(Long v){id=v;} public Long getWorldId(){return worldId;} public void setWorldId(Long v){worldId=v;} public Long getParentBranchId(){return parentBranchId;} public void setParentBranchId(Long v){parentBranchId=v;} public Long getForkSnapshotId(){return forkSnapshotId;} public void setForkSnapshotId(Long v){forkSnapshotId=v;} public String getName(){return name;} public void setName(String v){name=v;} public String getStatus(){return status;} public void setStatus(String v){status=v;} public LocalDateTime getCreatedAt(){return createdAt;} public void setCreatedAt(LocalDateTime v){createdAt=v;}
    public Long id(){return id;} public Long worldId(){return worldId;} public Long parentBranchId(){return parentBranchId;} public Long forkSnapshotId(){return forkSnapshotId;} public String name(){return name;} public String status(){return status;} public LocalDateTime createdAt(){return createdAt;}
}
