package com.sekai.world.story.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.sekai.world.actor.mapper.ActorMapper;
import com.sekai.world.actor.model.Actor;
import com.sekai.world.common.api.ApiException;
import com.sekai.world.story.mapper.EventMapper;
import com.sekai.world.story.model.EventChoice;
import com.sekai.world.story.model.WorldEvent;
import com.sekai.world.timeline.mapper.TimelineMapper;
import com.sekai.world.world.mapper.WorldMapper;
import com.sekai.world.world.model.WorldBranch;
import com.sekai.world.world.model.WorldClock;
import com.sekai.world.world.service.WorldService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EventService {
    private final WorldService worldService;
    private final EventMapper eventMapper;
    private final ActorMapper actorMapper;
    private final TimelineMapper timelineMapper;
    private final WorldMapper worldMapper;
    private final ObjectMapper objectMapper;

    public EventService(WorldService worldService, EventMapper eventMapper, ActorMapper actorMapper,
                        TimelineMapper timelineMapper, WorldMapper worldMapper, ObjectMapper objectMapper) {
        this.worldService = worldService;
        this.eventMapper = eventMapper;
        this.actorMapper = actorMapper;
        this.timelineMapper = timelineMapper;
        this.worldMapper = worldMapper;
        this.objectMapper = objectMapper;
    }

    public List<WorldEvent> list(Long worldId, Long branchId, Long ownerId) {
        worldService.requireBranch(worldId, branchId, ownerId);
        return eventMapper.list(worldId, branchId);
    }

    public EventDetails detail(Long worldId, Long branchId, Long eventId, Long ownerId) {
        worldService.requireBranch(worldId, branchId, ownerId);
        WorldEvent event = requireEvent(branchId, eventId);
        return new EventDetails(event, eventMapper.listChoices(eventId));
    }

    @Transactional
    public ChoiceResult choose(Long worldId, Long branchId, Long eventId, String choiceCode, Long ownerId) {
        WorldBranch branch = worldService.requireBranch(worldId, branchId, ownerId);
        WorldEvent event = requireEvent(branch.id(), eventId);
        if (!"PENDING".equals(event.status())) {
            throw ApiException.conflict("EVENT_ALREADY_HANDLED", "Event has already been handled");
        }
        EventChoice choice = eventMapper.findChoice(eventId, choiceCode);
        if (choice == null) throw ApiException.badRequest("CHOICE_NOT_FOUND", "Choice is not available for this event");
        JsonNode payload = readTree(event.payloadJson());
        Long targetActorId = payload.hasNonNull("targetActorId") ? payload.get("targetActorId").asLong() : null;
        Actor actor = targetActorId == null ? null : actorMapper.listByBranch(worldId, branch.id()).stream().filter(item -> item.id().equals(targetActorId)).findFirst().orElse(null);
        if (actor != null && actor.mood() < choice.requiredMoodMin()) {
            throw ApiException.conflict("CHOICE_CONDITION_FAILED", "Actor mood is too low for this choice");
        }
        Actor updated = actor;
        if (actor != null) {
            int mood = Math.max(0, Math.min(100, actor.mood() + choice.moodDelta()));
            String status = mood >= 75 ? "INSPIRED" : mood <= 35 ? "UNSETTLED" : "CALM";
            String stateJson = writeJson(new StatePayload(actor.locationId(), actor.energy(), mood, status));
            actorMapper.updateBranchState(branch.id(), actor.id(), actor.locationId(), actor.energy(), mood, status, stateJson);
            updated = new Actor(actor.id(), actor.worldId(), actor.factionId(), actor.locationId(), actor.name(), actor.role(), actor.profileJson(), stateJson, actor.energy(), mood, status);
        }
        if (eventMapper.markHandled(event.id(), "RESOLVED") == 0) {
            throw ApiException.conflict("EVENT_ALREADY_HANDLED", "Event has already been handled");
        }
        event.setStatus("RESOLVED");
        String payloadJson = writeJson(new ChoicePayload(choice.code(), choice.label(), targetActorId));
        TimelineMapper.TimelineDraft timeline = new TimelineMapper.TimelineDraft(branch.id(), null, event.id(), "CHOICE_APPLIED", "选择：" + choice.label(), payloadJson, event.occurredOn());
        timelineMapper.insertTimeline(timeline);
        if (actor != null) {
            timelineMapper.insertChange(new TimelineMapper.ChangeDraft(timeline.getId(), "ACTOR", actor.id(), "mood", String.valueOf(actor.mood()), String.valueOf(updated.mood())));
            timelineMapper.insertChange(new TimelineMapper.ChangeDraft(timeline.getId(), "ACTOR", actor.id(), "status", actor.status(), updated.status()));
        }
        WorldClock clock = worldMapper.findClock(branch.id());
        if (updated != null) {
            timelineMapper.insertSnapshot(new TimelineMapper.SnapshotDraft(branch.id(), timeline.getId(), writeJson(new SnapshotState(clock.currentDate(), clock.worldSeed(), actorMapper.listByBranch(worldId, branch.id()).stream().map(item -> new SnapshotActor(item.id(), item.locationId(), item.energy(), item.mood(), item.status())).toList()))));
        }
        return new ChoiceResult(event, choice, updated);
    }

    private WorldEvent requireEvent(Long branchId, Long eventId) {
        WorldEvent event = eventMapper.find(eventId, branchId);
        if (event == null) throw ApiException.notFound("Event not found");
        return event;
    }

    private JsonNode readTree(String json) {
        try { return objectMapper.readTree(json); }
        catch (Exception exception) { throw new IllegalStateException("Stored event payload is invalid", exception); }
    }

    private String writeJson(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception exception) { throw new IllegalStateException("Unable to serialize event data", exception); }
    }

    public record EventDetails(WorldEvent event, List<EventChoice> choices) {}
    public record ChoiceResult(WorldEvent event, EventChoice choice, Actor actor) {}
    public record ChoicePayload(String choiceCode, String label, Long targetActorId) {}
    public record StatePayload(Long locationId, int energy, int mood, String status) {}
    public record SnapshotState(java.time.LocalDate currentDate, long worldSeed, List<SnapshotActor> actors) {}
    public record SnapshotActor(Long actorId, Long locationId, int energy, int mood, String status) {}
}
