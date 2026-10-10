package com.sekai.world.story.controller;

import com.sekai.world.common.auth.CurrentUser;
import com.sekai.world.story.model.WorldEvent;
import com.sekai.world.story.service.EventService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/worlds/{worldId}/events")
@CrossOrigin(origins = "http://localhost:5173")
public class EventController {
    private final EventService eventService;

    public EventController(EventService eventService) { this.eventService = eventService; }

    @GetMapping
    public List<WorldEvent> list(@PathVariable Long worldId, @RequestParam Long branchId, HttpServletRequest request) {
        return eventService.list(worldId, branchId, CurrentUser.require(request).id());
    }

    @GetMapping("/{eventId}")
    public EventService.EventDetails detail(@PathVariable Long worldId, @PathVariable Long eventId,
                                            @RequestParam Long branchId, HttpServletRequest request) {
        return eventService.detail(worldId, branchId, eventId, CurrentUser.require(request).id());
    }

    @PostMapping("/{eventId}/choices")
    public EventService.ChoiceResult choose(@PathVariable Long worldId, @PathVariable Long eventId,
                                            @RequestParam Long branchId, @RequestBody ChoiceRequest body, HttpServletRequest request) {
        return eventService.choose(worldId, branchId, eventId, body.choiceCode(), CurrentUser.require(request).id());
    }

    public record ChoiceRequest(String choiceCode) {}
}
