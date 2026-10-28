package com.sekai.song.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;
import java.util.List;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DeviceRelayTest {
    @Test void connectionStartsOffAndMatchingAcknowledgmentEnablesIt() throws Exception {
        var identity=mock(DeviceSharingService.class);
        when(identity.authenticate("device","token")).thenReturn(3L);
        when(identity.songIds(3L)).thenReturn(Set.of(9L));
        var socket=mock(WebSocketSession.class);when(socket.getId()).thenReturn("socket");when(socket.isOpen()).thenReturn(true);
        try(var relay=new DeviceRelay(identity)) {
            relay.afterConnectionEstablished(socket);
            relay.receive(socket,"{\"type\":\"hello\",\"deviceId\":\"device\",\"token\":\"token\"}");
            relay.receive(socket,"{\"type\":\"catalog\",\"files\":[{\"songId\":9,\"kind\":\"audio\",\"size\":100,\"extension\":\".mp3\"}]}");
            relay.receive(socket,"{\"type\":\"catalog-end\"}");
            assertTrue(relay.online("device"));assertFalse(relay.sharing("device"));
            relay.toggle(3L,"device",true);
            relay.receive(socket,"{\"type\":\"sharing\",\"enabled\":true,\"version\":1}");
            assertTrue(relay.sharing("device"));assertEquals(1,relay.sources(3L).size());
            assertTrue(relay.sources(4L).isEmpty());
            assertThrows(Exception.class,()->relay.toggle(4L,"device",false));
            var first=relay.read(3L,"device",9L,"audio",null,"GET");
            var second=relay.read(3L,"device",9L,"audio",null,"GET");
            assertThrows(Exception.class,()->relay.read(3L,"device",9L,"audio",null,"GET"));
            relay.toggle(3L,"device",false);
            assertFalse(relay.sharing("device"));assertTrue(first.cancelled());assertTrue(second.cancelled());
            assertTrue(relay.sources(3L).isEmpty());
            verify(socket,atLeastOnce()).sendMessage(any(TextMessage.class));
        }
    }
    @Test void rangesAreValidatedIndependentlyOfDeviceResponse() {
        assertEquals(new DeviceRelay.Bounds(206,90,10),DeviceRelay.bounds("bytes=90-",100));
        assertEquals(new DeviceRelay.Bounds(206,92,8),DeviceRelay.bounds("bytes=-8",100));
        assertEquals(416,DeviceRelay.bounds("bytes=100-",100).status());
        assertEquals(416,DeviceRelay.bounds("bytes=1-2,4-5",100).status());
    }
}
