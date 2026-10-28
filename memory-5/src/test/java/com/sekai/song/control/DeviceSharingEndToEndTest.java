package com.sekai.song.control;

import com.sekai.song.model.User;
import com.sekai.song.service.LocalLibraryService;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.web.bind.annotation.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties="sekai.deviceSharing.enabled=true")
@Import(DeviceSharingEndToEndTest.Fixture.class)
class DeviceSharingEndToEndTest {
    @LocalServerPort int port;
    @Autowired LocalLibraryService library;
    @Autowired JdbcTemplate jdbc;
    @Autowired javax.sql.DataSource dataSource;
    @TestConfiguration static class Fixture {
        @Bean SessionFixture sessionFixture(){return new SessionFixture();}
    }
    // Test-only session creation; this class is never packaged in the application.
    @RestController static class SessionFixture {
        @GetMapping("/__device_qa/session") Map<String,String> session(@RequestParam long owner,HttpSession session){
            if(owner!=31 && owner!=3)throw new IllegalArgumentException();
            var user=new User();user.setId(owner);user.setUserName("device-qa");user.setNickName("Device QA");session.setAttribute("loginUser",user);
            session.setAttribute("localLibraryCsrf","device-e2e");return Map.of("csrf","device-e2e");
        }
    }
    @Test void actualClientStreamsRangesAndRemembersIndexAfterReconnect() throws Exception {
        new ResourceDatabasePopulator(new ClassPathResource("db/device-sharing.sql")).execute(dataSource);
        String name="device-e2e-"+java.util.UUID.randomUUID()+".wav";
        Long song=library.add(31L,new LocalLibraryService.NewSong("Device E2E","QA","QA",
                new LocalLibraryService.FileReference(name,196608L,0L,null)));
        String deviceName="E2E-"+java.util.UUID.randomUUID();
        Process child=null;
        try {
            child=new ProcessBuilder("node","tools/device-sharing/e2e.mjs", "http://127.0.0.1:"+port,
                    song.toString(),name,deviceName).inheritIO().start();
            assertTrue(child.waitFor(180,TimeUnit.SECONDS),"Client exceeded timeout");
            assertEquals(0,child.exitValue(),"Real client / HTTP streaming failed");
        } finally {
            if(child!=null && child.isAlive())child.destroyForcibly();
            jdbc.update("DELETE FROM sekai_song_device WHERE user_id=31 AND name=?",deviceName);
            library.delete(song,31L);
        }
    }
}
