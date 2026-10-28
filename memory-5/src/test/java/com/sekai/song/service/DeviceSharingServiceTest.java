package com.sekai.song.service;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties="sekai.deviceSharing.enabled=true")
@Transactional
class DeviceSharingServiceTest {
    @Autowired DeviceSharingService service;
    @Autowired JdbcTemplate jdbc;

    @BeforeAll static void schema(@Autowired javax.sql.DataSource source) {
        new ResourceDatabasePopulator(new ClassPathResource("db/device-sharing.sql")).execute(source);
    }
    @Test void pairingIsSingleUseAndDeviceStartsPrivate() {
        var pair=service.createPairing(31L);
        var credentials=service.pair(pair.code(),"我的电脑");
        assertEquals(31L,service.authenticate(credentials.deviceId(),credentials.token()));
        var device=service.list(31L).stream().filter(d->d.id().equals(credentials.deviceId())).findFirst().orElseThrow();
        assertFalse(device.sharing());
        assertFalse(device.online());
        assertThrows(ResponseStatusException.class,()->service.pair(pair.code(),"重放"));
        String hash=jdbc.queryForObject("SELECT token_hash FROM sekai_song_device WHERE id=?",String.class,credentials.deviceId());
        assertNotEquals(credentials.token(),hash);
        assertEquals(64,hash.length());
    }
    @Test void expirationAndRevocationRejectAccessWithoutTouchingOtherAccounts() {
        var expired=service.createPairing(31L);
        jdbc.update("UPDATE sekai_song_device_pairing SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE user_id=31");
        assertThrows(ResponseStatusException.class,()->service.pair(expired.code(),"过期"));
        var credentials=service.pair(service.createPairing(31L).code(),"有效");
        assertTrue(service.list(3L).stream().noneMatch(d->d.id().equals(credentials.deviceId())));
        assertThrows(ResponseStatusException.class,()->service.revoke(3L,credentials.deviceId()));
        assertThrows(ResponseStatusException.class,()->service.authenticate(credentials.deviceId(),"wrong"));
        service.revoke(31L,credentials.deviceId());
        assertThrows(ResponseStatusException.class,()->service.authenticate(credentials.deviceId(),credentials.token()));
    }
    @Test void disabledFeatureFailsClosedAndInvalidInputIsRejected() {
        var disabled=new DeviceSharingService(jdbc,false);
        assertThrows(ResponseStatusException.class,()->disabled.createPairing(31L));
        assertThrows(ResponseStatusException.class,()->disabled.list(31L));
        assertThrows(ResponseStatusException.class,()->service.pair("short","设备"));
        assertThrows(ResponseStatusException.class,()->service.pair(service.createPairing(31L).code()," "));
    }
    @Test void pairingCreationHasAnAccountLimit() {
        for(int i=0;i<5;i++)service.createPairing(31L);
        var error=assertThrows(ResponseStatusException.class,()->service.createPairing(31L));
        assertEquals(429,error.getStatusCode().value());
    }
}
