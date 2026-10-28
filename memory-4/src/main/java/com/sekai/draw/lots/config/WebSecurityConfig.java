package com.sekai.draw.lots.config;

import com.sekai.draw.lots.mapper.SekaiDrawLotsUserMapper;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.util.PasswordHashUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.support.RequestDataValueProcessor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Set;

@Configuration
public class WebSecurityConfig implements WebMvcConfigurer {
    private final SekaiDrawLotsUserMapper users;
    private static final Set<String> PUBLIC = Set.of("/", "/login", "/register", "/recover", "/user/login", "/user/register", "/user/recovery-token", "/user/reset-password", "/error");

    public WebSecurityConfig(SekaiDrawLotsUserMapper users) { this.users = users; }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
                var session = request.getSession();
                if (session.getAttribute("csrfToken") == null) session.setAttribute("csrfToken", PasswordHashUtil.newToken());
                response.setHeader("X-Content-Type-Options", "nosniff");
                response.setHeader("X-Frame-Options", "DENY");
                response.setHeader("Referrer-Policy", "same-origin");
                response.setHeader("Cache-Control", "no-store");
                if (!Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod())) {
                    String supplied = request.getHeader("X-CSRF-Token");
                    if (supplied == null) supplied = request.getParameter("_csrf");
                    String expected = (String) session.getAttribute("csrfToken");
                    if (supplied == null || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
                        return reject(response, 403, "页面已失效，请刷新后重试");
                    }
                }
                String path = request.getServletPath();
                if (PUBLIC.contains(path)) return true;
                Object stored = session.getAttribute("loginUser");
                if (stored instanceof User user) {
                    var current = users.selectByPrimaryKey(user.getId());
                    if (current != null && current.getSessionVersion() == user.getSessionVersion()) {
                        user.setAdmin(current.isAdmin());
                        if (path.startsWith("/admin") && !user.isAdmin()) return reject(response, 403, "需要管理员权限");
                        return true;
                    }
                    session.invalidate();
                }
                if ("GET".equals(request.getMethod()) && !path.startsWith("/api/") && !path.startsWith("/share/")) {
                    response.sendRedirect("/login");
                    return false;
                }
                return reject(response, 401, "登录已过期，请重新登录");
            }
        }).addPathPatterns("/**").excludePathPatterns("/css/**", "/js/**", "/fonts/**", "/favicon.ico", "/character/image/**");
    }

    private static boolean reject(HttpServletResponse response, int code, String message) throws java.io.IOException {
        response.setStatus(code);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"success\":false,\"message\":\"" + message + "\"}");
        return false;
    }

    @Bean
    RequestDataValueProcessor requestDataValueProcessor() {
        return new RequestDataValueProcessor() {
            public String processAction(HttpServletRequest request, String action, String method) { return action; }
            public String processFormFieldValue(HttpServletRequest request, String name, String value, String type) { return value; }
            public String processUrl(HttpServletRequest request, String url) { return url; }
            public Map<String, String> getExtraHiddenFields(HttpServletRequest request) {
                Object token = request.getSession().getAttribute("csrfToken");
                return token == null ? Map.of() : Map.of("_csrf", token.toString());
            }
        };
    }
}
