package com.sekai.world.actor.controller;

import com.sekai.world.actor.model.Actor;
import com.sekai.world.actor.service.ActorService;
import com.sekai.world.common.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/worlds/{worldId}/actors")
@CrossOrigin(origins = "http://localhost:5173")
public class ActorController {
    private final ActorService actorService;

    public ActorController(ActorService actorService) { this.actorService = actorService; }

    @GetMapping
    public List<Actor> list(@PathVariable Long worldId, @RequestParam(required = false) Long branchId, HttpServletRequest request) {
        return actorService.list(worldId, CurrentUser.require(request).id(), branchId);
    }

    @GetMapping("/{actorId}")
    public ActorService.ActorDetails detail(@PathVariable Long worldId, @PathVariable Long actorId,
                                            @RequestParam(required = false) Long branchId, HttpServletRequest request) {
        return actorService.detail(worldId, actorId, CurrentUser.require(request).id(), branchId);
    }

    @GetMapping("/{actorId}/relationships")
    public List<com.sekai.world.relationship.model.Relationship> relationships(@PathVariable Long worldId, @PathVariable Long actorId, HttpServletRequest request) {
        return actorService.detail(worldId, actorId, CurrentUser.require(request).id(), null).relationships();
    }
}
