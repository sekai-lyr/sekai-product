package com.sekai.world.location.controller;

import com.sekai.world.common.auth.CurrentUser;
import com.sekai.world.location.mapper.LocationMapper;
import com.sekai.world.location.model.Location;
import com.sekai.world.world.service.WorldService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/worlds/{worldId}/locations")
@CrossOrigin(origins = "http://localhost:5173")
public class LocationController {
    private final WorldService worldService;
    private final LocationMapper locationMapper;

    public LocationController(WorldService worldService, LocationMapper locationMapper) { this.worldService = worldService; this.locationMapper = locationMapper; }

    @GetMapping
    public List<Location> list(@PathVariable Long worldId, @RequestParam(required = false) Long branchId, HttpServletRequest request) {
        if (branchId != null) worldService.requireBranch(worldId, branchId, CurrentUser.require(request).id());
        else worldService.findOwned(worldId, CurrentUser.require(request).id());
        return locationMapper.listByWorld(worldId);
    }
}
