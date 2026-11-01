package com.ykd.claw.travel.service;

import com.ykd.claw.memory.MemoryService;
import com.ykd.claw.travel.model.UserProfile;
import com.ykd.claw.user.service.UserService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserProfileService {
    private final MemoryService memoryService;
    private final UserService userService;

    public UserProfileService(MemoryService memoryService, UserService userService) {
        this.memoryService = memoryService;
        this.userService = userService;
    }

    public UserProfile load(String userId, String request) {
        if (userId == null || userId.isBlank()) return new UserProfile(List.of());
        List<String> fromUser = userService.preferences(userId);
        if (!fromUser.isEmpty()) return new UserProfile(fromUser);
        List<String> fromMemory = memoryService.profileMemory(userId, request).stream()
                .map(memory -> memory.content())
                .distinct()
                .toList();
        if (!fromMemory.isEmpty()) {
            userService.mergePreferences(userId, fromMemory);
        }
        return new UserProfile(fromMemory);
    }
}
