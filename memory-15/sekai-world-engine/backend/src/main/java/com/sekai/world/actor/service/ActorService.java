package com.sekai.world.actor.service;

import com.sekai.world.actor.mapper.ActorMapper;
import com.sekai.world.actor.model.Actor;
import com.sekai.world.actor.model.ActorSchedule;
import com.sekai.world.common.api.ApiException;
import com.sekai.world.relationship.mapper.RelationshipMapper;
import com.sekai.world.relationship.model.Relationship;
import com.sekai.world.world.model.WorldBranch;
import com.sekai.world.world.service.WorldService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ActorService {
    private final WorldService worldService;
    private final ActorMapper actorMapper;
    private final RelationshipMapper relationshipMapper;

    public ActorService(WorldService worldService, ActorMapper actorMapper, RelationshipMapper relationshipMapper) {
        this.worldService = worldService;
        this.actorMapper = actorMapper;
        this.relationshipMapper = relationshipMapper;
    }

    public List<Actor> list(Long worldId, Long ownerId, Long branchId) {
        WorldBranch branch = branchId == null ? worldService.overview(worldId, ownerId).branches().get(0) : worldService.requireBranch(worldId, branchId, ownerId);
        return actorMapper.listByBranch(worldId, branch.id());
    }

    public Actor require(Long worldId, Long actorId, Long ownerId, Long branchId) {
        List<Actor> actors = list(worldId, ownerId, branchId);
        return actors.stream().filter(actor -> actor.id().equals(actorId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Actor not found"));
    }

    public ActorDetails detail(Long worldId, Long actorId, Long ownerId, Long branchId) {
        Actor actor = require(worldId, actorId, ownerId, branchId);
        return new ActorDetails(actor, actorMapper.listSchedules(worldId).stream().filter(schedule -> schedule.actorId().equals(actorId)).toList(), relationshipMapper.listByActor(worldId, actorId));
    }

    public record ActorDetails(Actor actor, List<ActorSchedule> schedules, List<Relationship> relationships) {}
}
