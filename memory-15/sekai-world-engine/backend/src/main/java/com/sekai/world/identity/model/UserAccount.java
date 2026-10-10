package com.sekai.world.identity.model;

public record UserAccount(Long id, String email, String passwordHash, String displayName) {
}
