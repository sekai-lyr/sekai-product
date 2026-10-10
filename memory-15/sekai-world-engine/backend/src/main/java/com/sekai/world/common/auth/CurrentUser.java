package com.sekai.world.common.auth;

import com.sekai.world.common.api.ApiException;
import jakarta.servlet.http.HttpServletRequest;

public record CurrentUser(Long id, String email, String displayName) {
    public static final String REQUEST_ATTRIBUTE = CurrentUser.class.getName();

    public static CurrentUser require(HttpServletRequest request) {
        Object value = request.getAttribute(REQUEST_ATTRIBUTE);
        if (value instanceof CurrentUser currentUser) {
            return currentUser;
        }
        throw ApiException.unauthorized();
    }
}
