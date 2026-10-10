package com.sekai.world.world.service;

import tools.jackson.databind.ObjectMapper;
import com.sekai.world.actor.mapper.ActorMapper;
import com.sekai.world.common.api.ApiException;
import com.sekai.world.simulation.service.SimulationService;
import com.sekai.world.timeline.mapper.TimelineMapper;
import com.sekai.world.timeline.model.TimelineEvent;
import com.sekai.world.world.mapper.WorldMapper;
import com.sekai.world.world.model.WorldBranch;
import com.sekai.world.world.model.WorldClock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BranchService {
    private final WorldService worldService;
    private final WorldMapper worldMapper;
    private final ActorMapper actorMapper;
    private final TimelineMapper timelineMapper;
    private final ObjectMapper objectMapper;

    public BranchService(WorldService worldService, WorldMapper worldMapper, ActorMapper actorMapper,
                         TimelineMapper timelineMapper, ObjectMapper objectMapper) {
        this.worldService = worldService;
        this.worldMapper = worldMapper;
        this.actorMapper = actorMapper;
        this.timelineMapper = timelineMapper;
        this.objectMapper = objectMapper;
    }

    public List<WorldBranch> list(Long worldId, Long ownerId) {
        worldService.findOwned(worldId, ownerId);
        return worldMapper.listBranches(worldId);
    }

    @Transactional
    public ForkResult fork(Long worldId, Long sourceBranchId, Long timelineEventId, String requestedName, Long ownerId) {
        WorldBranch source = worldService.requireBranch(worldId, sourceBranchId, ownerId);
        TimelineEvent timelineEvent = timelineMapper.find(source.id(), timelineEventId);
        if (timelineEvent == null) throw ApiException.notFound("Timeline node not found");
        TimelineMapper.SnapshotRow snapshot = timelineMapper.findLatestSnapshot(source.id(), timelineEventId);
        if (snapshot == null) throw ApiException.conflict("SNAPSHOT_REQUIRED", "This history node has no recoverable snapshot yet");
        SimulationService.BranchSnapshot state = readSnapshot(snapshot.stateJson());
        String name = requestedName == null || requestedName.isBlank() ? source.name() + " / 分支" : requestedName.trim();
        WorldMapper.BranchDraft branchDraft = new WorldMapper.BranchDraft(worldId, source.id(), snapshot.id(), name, "ACTIVE");
        worldMapper.insertBranch(branchDraft);
        worldMapper.insertClock(new WorldMapper.ClockDraft(branchDraft.getId(), state.currentDate(), null, state.worldSeed()));
        for (SimulationService.SnapshotActor actor : state.actors()) {
            String stateJson = writeJson(new ActorState(actor.locationId(), actor.energy(), actor.mood(), actor.status()));
            actorMapper.insertBranchState(new ActorMapper.BranchStateDraft(branchDraft.getId(), actor.actorId(), actor.locationId(), actor.energy(), actor.mood(), actor.status(), stateJson));
        }
        WorldBranch branch = worldMapper.findBranch(worldId, branchDraft.getId());
        return new ForkResult(branch, worldMapper.findClock(branch.id()), snapshot.id());
    }

    public BranchComparison compare(Long worldId, Long branchId, Long otherBranchId, Long ownerId) {
        WorldBranch left = worldService.requireBranch(worldId, branchId, ownerId);
        WorldBranch right = worldService.requireBranch(worldId, otherBranchId, ownerId);
        return new BranchComparison(left, right, timelineMapper.list(left.id()).size(), timelineMapper.list(right.id()).size());
    }

    private SimulationService.BranchSnapshot readSnapshot(String json) {
        try { return objectMapper.readValue(json, SimulationService.BranchSnapshot.class); }
        catch (Exception exception) { throw new IllegalStateException("Stored snapshot is invalid", exception); }
    }

    private String writeJson(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception exception) { throw new IllegalStateException("Unable to serialize branch data", exception); }
    }

    public record ActorState(Long locationId, int energy, int mood, String status) {}
    public record ForkResult(WorldBranch branch, WorldClock clock, Long sourceSnapshotId) {}
    public record BranchComparison(WorldBranch left, WorldBranch right, int leftTimelineEvents, int rightTimelineEvents) {}
}
