package com.sekai.song.config;

import com.sekai.song.service.DeviceRelay;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@ConditionalOnProperty(name="sekai.deviceSharing.enabled",havingValue="true")
public class DeviceChannelConfig implements WebSocketConfigurer {
    private final DeviceRelay relay;
    public DeviceChannelConfig(DeviceRelay relay){this.relay=relay;}
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Native client sends no browser Origin. Browser clients remain same-origin restricted.
        registry.addHandler(relay,"/api/device-sharing/channel");
    }
}
