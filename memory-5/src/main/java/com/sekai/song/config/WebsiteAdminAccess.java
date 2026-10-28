package com.sekai.song.config;

import com.sekai.song.model.User;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

@Component
public class WebsiteAdminAccess {
    @Value("${sekai.website.admin-user-id:3}") private Long adminId;
    public boolean allowed(User user){return user!=null && adminId!=null && adminId.equals(user.getId());}

    @ControllerAdvice
    public static class Navigation {
        private final WebsiteAdminAccess admin;
        public Navigation(WebsiteAdminAccess admin){this.admin=admin;}
        @ModelAttribute("websiteAdmin")
        public boolean websiteAdmin(HttpSession session){return session.getAttribute("loginUser") instanceof User user && admin.allowed(user);}
    }
}
