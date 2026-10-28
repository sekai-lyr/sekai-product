package com.sekai.song.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

@ControllerAdvice
public class DeviceSharingNavigation {
    @Value("${sekai.deviceSharing.enabled:false}") private boolean enabled;
    @ModelAttribute("deviceSharingEnabled") public boolean enabled(){return enabled;}
}
