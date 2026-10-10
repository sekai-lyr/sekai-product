package com.sekai.world.world.controller;

import com.sekai.world.actor.model.Actor;
import com.sekai.world.common.auth.CurrentUser;
import com.sekai.world.simulation.service.SimulationService;
import com.sekai.world.story.model.WorldEvent;
import com.sekai.world.timeline.model.TimelineEvent;
import com.sekai.world.world.model.World;
import com.sekai.world.world.service.WorldService;
import com.sekai.world.world.service.WorldStateService;
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
@RequestMapping("/api/worlds")
@CrossOrigin(origins = "http://localhost:5173")
public class WorldController {
    private final WorldService worldService;
    private final WorldStateService stateService;
    private final SimulationService simulationService;

    public WorldController(WorldService worldService, WorldStateService stateService, SimulationService simulationService) {
        this.worldService = worldService;
        this.stateService = stateService;
        this.simulationService = simulationService;
    }

    @GetMapping
    public List<World> list(HttpServletRequest request) {
        return worldService.listOwned(CurrentUser.require(request).id());
    }

    @PostMapping
    public World create(@RequestBody CreateWorldRequest body, HttpServletRequest request) {
        return worldService.createSeedWorld(CurrentUser.require(request).id(), body.name(), body.seed());
    }

    @GetMapping("/{worldId}")
    public WorldService.WorldOverview detail(@PathVariable Long worldId, HttpServletRequest request) {
        return worldService.overview(worldId, CurrentUser.require(request).id());
    }

    @PostMapping("/{worldId}/advance")
    public SimulationService.AdvanceResponse advance(@PathVariable Long worldId, @RequestBody AdvanceRequest body, HttpServletRequest request) {
        return simulationService.advance(worldId, body.branchId(), CurrentUser.require(request).id(), body.idempotencyKey());
    }

    @GetMapping("/{worldId}/state")
    public WorldStateService.WorldState state(@PathVariable Long worldId, @RequestParam(required = false) Long branchId, HttpServletRequest request) {
        return stateService.state(worldId, CurrentUser.require(request).id(), branchId);
    }

    @GetMapping("/{worldId}/timeline")
    public List<TimelineEvent> timeline(@PathVariable Long worldId, @RequestParam(required = false) Long branchId, HttpServletRequest request) {
        return stateService.state(worldId, CurrentUser.require(request).id(), branchId).timeline();
    }

    public record CreateWorldRequest(String name, Long seed) {}
    public record AdvanceRequest(Long branchId, String idempotencyKey) {}
}
