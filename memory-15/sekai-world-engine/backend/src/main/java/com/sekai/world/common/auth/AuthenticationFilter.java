package com.sekai.world.common.auth;

import com.sekai.world.identity.mapper.UserMapper;
import com.sekai.world.identity.model.UserAccount;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class AuthenticationFilter extends OncePerRequestFilter {
    private final TokenService tokenService;
    private final UserMapper userMapper;

    public AuthenticationFilter(TokenService tokenService, UserMapper userMapper) {
        this.tokenService = tokenService;
        this.userMapper = userMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            TokenService.TokenClaims claims = tokenService.verify(header.substring(7));
            if (claims != null) {
                UserAccount user = userMapper.findById(claims.userId());
                if (user != null) {
                    request.setAttribute(CurrentUser.REQUEST_ATTRIBUTE,
                            new CurrentUser(user.id(), user.email(), user.displayName()));
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
