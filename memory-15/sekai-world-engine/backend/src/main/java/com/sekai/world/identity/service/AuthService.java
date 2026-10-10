package com.sekai.world.identity.service;

import com.sekai.world.common.api.ApiException;
import com.sekai.world.common.auth.CurrentUser;
import com.sekai.world.common.auth.PasswordHasher;
import com.sekai.world.common.auth.TokenService;
import com.sekai.world.identity.mapper.UserMapper;
import com.sekai.world.identity.model.UserAccount;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserMapper userMapper;
    private final PasswordHasher passwordHasher;
    private final TokenService tokenService;

    public AuthService(UserMapper userMapper, PasswordHasher passwordHasher, TokenService tokenService) {
        this.userMapper = userMapper;
        this.passwordHasher = passwordHasher;
        this.tokenService = tokenService;
    }

    @Transactional
    public AuthResult register(String email, String password, String displayName) {
        String normalizedEmail = normalizeEmail(email);
        if (displayName == null || displayName.isBlank()) {
            throw ApiException.badRequest("INVALID_DISPLAY_NAME", "Display name is required");
        }
        if (userMapper.findByEmail(normalizedEmail) != null) {
            throw ApiException.conflict("EMAIL_TAKEN", "Email is already registered");
        }
        UserMapper.UserAccountDraft draft = new UserMapper.UserAccountDraft(
                normalizedEmail, passwordHasher.hash(password), displayName.trim());
        try {
            userMapper.insert(draft);
        } catch (DuplicateKeyException exception) {
            throw ApiException.conflict("EMAIL_TAKEN", "Email is already registered");
        }
        UserAccount user = userMapper.findById(draft.getId());
        return toResult(user);
    }

    public AuthResult login(String email, String password) {
        UserAccount user = userMapper.findByEmail(normalizeEmail(email));
        if (user == null || !passwordHasher.matches(password, user.passwordHash())) {
            throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS", "Email or password is incorrect");
        }
        return toResult(user);
    }

    private AuthResult toResult(UserAccount user) {
        CurrentUser currentUser = new CurrentUser(user.id(), user.email(), user.displayName());
        return new AuthResult(tokenService.issue(currentUser), currentUser);
    }

    private String normalizeEmail(String email) {
        if (email == null || !email.contains("@")) {
            throw ApiException.badRequest("INVALID_EMAIL", "A valid email is required");
        }
        return email.trim().toLowerCase();
    }

    public record AuthResult(String token, CurrentUser user) {
    }
}
