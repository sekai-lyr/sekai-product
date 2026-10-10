package com.sekai.world.world.controller;

import com.sekai.world.common.auth.CurrentUser;
import com.sekai.world.world.model.WorldBranch;
import com.sekai.world.world.service.BranchService;
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
@RequestMapping("/api/worlds/{worldId}/branches")
@CrossOrigin(origins = "http://localhost:5173")
public class BranchController {
    private final BranchService branchService;

    public BranchController(BranchService branchService) { this.branchService = branchService; }

    @GetMapping
    public List<WorldBranch> list(@PathVariable Long worldId, HttpServletRequest request) {
        return branchService.list(worldId, CurrentUser.require(request).id());
    }

    @PostMapping
    public BranchService.ForkResult create(@PathVariable Long worldId, @RequestBody ForkRequest body, HttpServletRequest request) {
        return branchService.fork(worldId, body.sourceBranchId(), body.timelineEventId(), body.name(), CurrentUser.require(request).id());
    }

    @PostMapping("/{branchId}/fork")
    public BranchService.ForkResult fork(@PathVariable Long worldId, @PathVariable Long branchId,
                                         @RequestBody ForkRequest body, HttpServletRequest request) {
        return branchService.fork(worldId, branchId, body.timelineEventId(), body.name(), CurrentUser.require(request).id());
    }

    @GetMapping("/{branchId}/compare")
    public BranchService.BranchComparison compare(@PathVariable Long worldId, @PathVariable Long branchId,
                                                  @RequestParam Long otherBranchId, HttpServletRequest request) {
        return branchService.compare(worldId, branchId, otherBranchId, CurrentUser.require(request).id());
    }

    public record ForkRequest(Long sourceBranchId, Long timelineEventId, String name) {}
}
