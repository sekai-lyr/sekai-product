package com.nightcord.duel.controller;

import com.nightcord.duel.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/{userId}")
    public ResponseEntity<?> getUser(@PathVariable Long userId) {
        return userService.getUserById(userId)
            .map(user -> ResponseEntity.ok((Object) Map.of(
                "userId", user.getId(),
                "username", user.getUsername(),
                "nickname", user.getNickname(),
                "duelCoins", user.getDuelCoins(),
                "packsOpened", user.getPacksOpened(),
                "duelsPlayed", user.getDuelsPlayed(),
                "wins", user.getWins(),
                "losses", user.getLosses(),
                "draws", user.getDraws()
            )))
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable Long userId, @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(userService.updateUser(userId, body));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }

    @GetMapping("/{userId}/stats")
    public ResponseEntity<?> getUserStats(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(userService.getUserStats(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }

    @GetMapping("/{userId}/cards")
    public ResponseEntity<?> getUserCards(@PathVariable Long userId) {
        return ResponseEntity.ok(userService.getUserCards(userId));
    }

    @PostMapping("/{userId}/coins")
    public ResponseEntity<?> updateCoins(@PathVariable Long userId, @RequestBody Map<String, Integer> body) {
        try {
            int delta = body.getOrDefault("delta", 0);
            return ResponseEntity.ok(userService.updateDuelCoins(userId, delta));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }
}
