package com.sekai.world.world.service;

import com.sekai.world.actor.mapper.ActorMapper;
import com.sekai.world.actor.model.Actor;
import com.sekai.world.story.mapper.EventMapper;
import com.sekai.world.story.model.WorldEvent;
import com.sekai.world.timeline.mapper.TimelineMapper;
import com.sekai.world.timeline.model.TimelineEvent;
import com.sekai.world.world.model.WorldBranch;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class WorldStateService {
    private final WorldService worldService;
    private final ActorMapper actorMapper;
    private final EventMapper eventMapper;
    private final TimelineMapper timelineMapper;

    public WorldStateService(WorldService worldService, ActorMapper actorMapper, EventMapper eventMapper, TimelineMapper timelineMapper) {
        this.worldService = worldService;
        this.actorMapper = actorMapper;
        this.eventMapper = eventMapper;
        this.timelineMapper = timelineMapper;
    }

    public WorldState state(Long worldId, Long ownerId, Long requestedBranchId) {
        WorldService.WorldOverview overview = worldService.overview(worldId, ownerId, requestedBranchId);
        WorldBranch branch = requestedBranchId == null
                ? overview.branches().get(0)
                : worldService.requireBranch(worldId, requestedBranchId, ownerId);
        return new WorldState(overview, branch.id(), actorMapper.listByBranch(worldId, branch.id()),
                eventMapper.list(worldId, branch.id()), timelineMapper.list(branch.id()));
    }

    public record WorldState(WorldService.WorldOverview overview, Long branchId, List<Actor> actors,
                             List<WorldEvent> events, List<TimelineEvent> timeline) {}
}
