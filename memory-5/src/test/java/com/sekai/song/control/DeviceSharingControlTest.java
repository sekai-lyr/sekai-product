package com.sekai.song.control;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sekai.song.model.User;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="sekai.deviceSharing.enabled=true")
@AutoConfigureMockMvc
@Transactional
class DeviceSharingControlTest {
    @Autowired MockMvc mvc;
    private final ObjectMapper json=new ObjectMapper();
    @Autowired com.sekai.song.service.DeviceSharingService identity;
    @Test void browserPairingNeedsSessionAndCsrfAndReusesOnlyOwnDevice() throws Exception {
        mvc.perform(post("/api/device-sharing/browser-device").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/device-sharing/browser-device").session(account(31)).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        var session=account(31);
        var first=json.readTree(mvc.perform(post("/api/device-sharing/browser-device").session(session)
                .header("X-Local-Library-CSRF","csrf-test").contentType("application/json").content("{}"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","private, no-store")).andReturn().getResponse().getContentAsString());
        String body=json.writeValueAsString(java.util.Map.of("deviceId",first.get("deviceId").asText()));
        mvc.perform(post("/api/device-sharing/browser-device").session(account(3)).header("X-Local-Library-CSRF","csrf-test")
                .contentType("application/json").content(body)).andExpect(status().isNotFound());
        var second=json.readTree(mvc.perform(post("/api/device-sharing/browser-device").session(session).header("X-Local-Library-CSRF","csrf-test")
                .contentType("application/json").content(body)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertEquals(first.get("deviceId"),second.get("deviceId"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->identity.authenticate(first.get("deviceId").asText(),first.get("token").asText()));
        assertEquals(31L,identity.authenticate(second.get("deviceId").asText(),second.get("token").asText()));
    }
    @BeforeAll static void schema(@Autowired javax.sql.DataSource source) {
        new ResourceDatabasePopulator(new ClassPathResource("db/device-sharing.sql")).execute(source);
    }
    private MockHttpSession account(long id) {
        var session=new MockHttpSession();var user=new User();user.setId(id);
        session.setAttribute("loginUser",user);session.setAttribute("localLibraryCsrf","csrf-test");return session;
    }
    @Test void authenticationAndCsrfAreRequired() throws Exception {
        mvc.perform(get("/api/device-sharing/devices")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/device-sharing/pairing").session(account(31))).andExpect(status().isForbidden());
        mvc.perform(post("/api/device-sharing/pair").contentType("application/json").content("{\"code\":\"short\",\"name\":\"电脑\"}"))
                .andExpect(status().isBadRequest());
    }
    @Test void credentialsAreReturnedOnceAndNeverAppearInDeviceLists() throws Exception {
        var session=account(31);
        var pair=json.readTree(mvc.perform(post("/api/device-sharing/pairing").session(session).header("X-Local-Library-CSRF","csrf-test"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","private, no-store")).andReturn().getResponse().getContentAsString());
        String input=json.writeValueAsString(java.util.Map.of("code",pair.get("code").asText(),"name","测试电脑"));
        var credentials=json.readTree(mvc.perform(post("/api/device-sharing/pair").contentType("application/json").content(input))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","private, no-store")).andReturn().getResponse().getContentAsString());
        String id=credentials.get("deviceId").asText(),token=credentials.get("token").asText();
        String devices=mvc.perform(get("/api/device-sharing/devices").session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(devices.contains(id));assertFalse(devices.contains(token));assertFalse(devices.contains("token_hash"));
        mvc.perform(post("/api/device-sharing/pair").contentType("application/json").content(input)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/device-sharing/devices/"+id+"/revoke").session(account(3)).header("X-Local-Library-CSRF","csrf-test"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/device-sharing/devices/"+id+"/revoke").session(session).header("X-Local-Library-CSRF","csrf-test"))
                .andExpect(status().isOk());
    }
}
