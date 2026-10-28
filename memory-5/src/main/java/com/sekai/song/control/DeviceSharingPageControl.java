package com.sekai.song.control;

import com.sekai.song.model.User;
import jakarta.servlet.http.HttpSession;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@ConditionalOnProperty(name="sekai.deviceSharing.enabled",havingValue="true")
public class DeviceSharingPageControl {
    @GetMapping("/device-sharing")
    public String page(HttpSession session,Model model) {
        if(!(session.getAttribute("loginUser") instanceof User user))return "redirect:/login";
        model.addAttribute("loginUser",user);return "device-sharing";
    }
}
