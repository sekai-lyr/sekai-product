package com.sekai.world.simulation.service;

import tools.jackson.databind.ObjectMapper;
import com.sekai.world.actor.mapper.ActorMapper;
import com.sekai.world.actor.model.Actor;
import com.sekai.world.actor.model.ActorSchedule;
import com.sekai.world.common.api.ApiException;
import com.sekai.world.simulation.domain.DeterministicSimulationEngine;
import com.sekai.world.simulation.mapper.SimulationMapper;
import com.sekai.world.simulation.model.EventTemplate;
import com.sekai.world.simulation.model.SimulationInput;
import com.sekai.world.simulation.model.SimulationResult;
import com.sekai.world.simulation.model.SimulationTick;
import com.sekai.world.simulation.model.WorldRule;
import com.sekai.world.timeline.mapper.TimelineMapper;
import com.sekai.world.world.mapper.WorldMapper;
import com.sekai.world.world.model.WorldBranch;
import com.sekai.world.world.model.WorldClock;
import com.sekai.world.world.service.WorldService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SimulationService {
    private final WorldService worldService;
    private final WorldMapper worldMapper;
    private final ActorMapper actorMapper;
    private final SimulationMapper simulationMapper;
    private final com.sekai.world.story.mapper.EventMapper eventMapper;
    private final TimelineMapper timelineMapper;
    private final DeterministicSimulationEngine engine;
    private final ObjectMapper objectMapper;

    public SimulationService(WorldService worldService, WorldMapper worldMapper, ActorMapper actorMapper,
                             SimulationMapper simulationMapper, com.sekai.world.story.mapper.EventMapper eventMapper, TimelineMapper timelineMapper,
                             DeterministicSimulationEngine engine, ObjectMapper objectMapper) {
        this.worldService = worldService;
        this.worldMapper = worldMapper;
        this.actorMapper = actorMapper;
        this.simulationMapper = simulationMapper;
        this.eventMapper = eventMapper;
        this.timelineMapper = timelineMapper;
        this.engine = engine;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AdvanceResponse advance(Long worldId, Long branchId, Long ownerId, String tickKey) {
        if (tickKey == null || tickKey.isBlank()) {
            throw ApiException.badRequest("TICK_KEY_REQUIRED", "idempotencyKey is required");
        }
        WorldBranch branch = worldService.requireBranch(worldId, branchId, ownerId);
        SimulationTick existing = simulationMapper.findTick(branch.id(), tickKey.trim());
        if (existing != null) {
            return new AdvanceResponse(true, existing, readResult(existing.resultJson()));
        }
        WorldClock clock = worldMapper.findClock(branch.id());
        if (clock == null) {
            throw ApiException.notFound("World clock not found");
        }
        List<Actor> actors = actorMapper.listByBranch(worldId, branch.id());
        List<ActorSchedule> schedules = actorMapper.listSchedules(worldId);
        List<WorldRule> rules = simulationMapper.listRules(worldId);
        List<EventTemplate> templates = simulationMapper.listTemplates(worldId);
        SimulationInput input = new SimulationInput(clock.currentDate(), clock.worldSeed(), tickKey.trim(),
                actors.stream().map(actor -> new SimulationInput.ActorState(actor.id(), actor.name(), actor.locationId(), actor.energy(), actor.mood(), actor.status())).toList(),
                schedules.stream().map(schedule -> new SimulationInput.ScheduleState(schedule.actorId(), schedule.dayOfWeek(), schedule.locationId(), schedule.activity(), schedule.energyDelta(), schedule.moodDelta())).toList(),
                rules.stream().map(rule -> new SimulationInput.RuleState(rule.code(), rule.conditionType(), rule.thresholdValue(), rule.effectType(), rule.effectValue(), rule.priority())).toList(),
                templates.stream().map(template -> new SimulationInput.TemplateState(template.id(), template.code(), template.name(), template.description(), template.probabilityPercent(), template.priority(), template.choicePositiveLabel(), template.choicePositiveMoodDelta(), template.choiceNegativeLabel(), template.choiceNegativeMoodDelta())).toList());
        SimulationResult result = engine.simulate(input);
        String resultJson = writeJson(result);
        SimulationMapper.TickDraft tickDraft = new SimulationMapper.TickDraft(branch.id(), tickKey.trim(), result.fromDate(), result.toDate(), resultJson);
        simulationMapper.insertTick(tickDraft);

        for (SimulationResult.ActorChange change : result.actorChanges()) {
            String stateJson = writeJson(new ActorStatePayload(change.afterLocationId(), change.afterEnergy(), change.afterMood(), change.afterStatus()));
            actorMapper.updateBranchState(branch.id(), change.actorId(), change.afterLocationId(), change.afterEnergy(), change.afterMood(), change.afterStatus(), stateJson);
        }
        TimelineMapper.TimelineDraft tickTimeline = new TimelineMapper.TimelineDraft(branch.id(), tickDraft.getId(), null, "SIMULATION_TICK", result.summary(), resultJson, result.toDate());
        timelineMapper.insertTimeline(tickTimeline);
        for (SimulationResult.ActorChange change : result.actorChanges()) {
            timelineMapper.insertChange(new TimelineMapper.ChangeDraft(tickTimeline.getId(), "ACTOR", change.actorId(), "locationId", String.valueOf(change.beforeLocationId()), String.valueOf(change.afterLocationId())));
            timelineMapper.insertChange(new TimelineMapper.ChangeDraft(tickTimeline.getId(), "ACTOR", change.actorId(), "energy", String.valueOf(change.beforeEnergy()), String.valueOf(change.afterEnergy())));
            timelineMapper.insertChange(new TimelineMapper.ChangeDraft(tickTimeline.getId(), "ACTOR", change.actorId(), "mood", String.valueOf(change.beforeMood()), String.valueOf(change.afterMood())));
            timelineMapper.insertChange(new TimelineMapper.ChangeDraft(tickTimeline.getId(), "ACTOR", change.actorId(), "status", change.beforeStatus(), change.afterStatus()));
        }

        for (SimulationResult.GeneratedEvent event : result.events()) {
            String payload = writeJson(new EventPayload(event.targetActorId(), event.templateCode()));
            com.sekai.world.story.mapper.EventMapper.EventDraft eventDraft = new com.sekai.world.story.mapper.EventMapper.EventDraft(
                    branch.id(), event.templateId(), result.toDate(), "PENDING", event.title(), event.description(), payload, tickKey.trim() + ":" + event.templateCode());
            eventMapper.insert(eventDraft);
            eventMapper.insertChoice(new com.sekai.world.story.mapper.EventMapper.ChoiceDraft(eventDraft.getId(), "ACT", event.positiveChoiceLabel(), 0, event.positiveMoodDelta(), "{\"minMood\":0}", "{\"type\":\"MOOD_DELTA\",\"amount\":" + event.positiveMoodDelta() + "}", 1));
            eventMapper.insertChoice(new com.sekai.world.story.mapper.EventMapper.ChoiceDraft(eventDraft.getId(), "WAIT", event.negativeChoiceLabel(), 0, event.negativeMoodDelta(), "{\"minMood\":0}", "{\"type\":\"MOOD_DELTA\",\"amount\":" + event.negativeMoodDelta() + "}", 2));
            timelineMapper.insertTimeline(new TimelineMapper.TimelineDraft(branch.id(), tickDraft.getId(), eventDraft.getId(), "WORLD_EVENT", event.title(), payload, result.toDate()));
        }

        List<SnapshotActor> snapshotActors = new ArrayList<>();
        for (Actor actor : actors) {
            SimulationResult.ActorChange change = result.actorChanges().stream().filter(item -> item.actorId().equals(actor.id())).findFirst().orElse(null);
            snapshotActors.add(new SnapshotActor(actor.id(), change == null ? actor.locationId() : change.afterLocationId(), change == null ? actor.energy() : change.afterEnergy(), change == null ? actor.mood() : change.afterMood(), change == null ? actor.status() : change.afterStatus()));
        }
        timelineMapper.insertSnapshot(new TimelineMapper.SnapshotDraft(branch.id(), tickTimeline.getId(), writeJson(new BranchSnapshot(result.toDate(), clock.worldSeed(), snapshotActors))));
        if (worldMapper.updateClock(branch.id(), result.toDate(), tickKey.trim(), clock.version()) == 0) {
            throw ApiException.conflict("CLOCK_CHANGED", "World advanced concurrently; retry with a new idempotency key");
        }
        return new AdvanceResponse(false, new SimulationTick(tickDraft.getId(), branch.id(), tickKey.trim(), result.fromDate(), result.toDate(), resultJson), result);
    }

    private SimulationResult readResult(String json) {
        try {
            return objectMapper.readValue(json, SimulationResult.class);
        } catch (Exception exception) {
            throw new IllegalStateException("Stored simulation result is invalid", exception);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to serialize simulation data", exception);
        }
    }

    public record AdvanceResponse(boolean idempotent, SimulationTick tick, SimulationResult result) {}
    public record ActorStatePayload(Long locationId, int energy, int mood, String status) {}
    public record EventPayload(Long targetActorId, String templateCode) {}
    public record SnapshotActor(Long actorId, Long locationId, int energy, int mood, String status) {}
    public record BranchSnapshot(LocalDate currentDate, long worldSeed, List<SnapshotActor> actors) {}
}
