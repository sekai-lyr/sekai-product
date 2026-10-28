package com.sekai.song.control;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class DeviceSharingDisabledTest {
    @Autowired MockMvc mvc;
    @Test void deviceEndpointsAreAbsentByDefault() throws Exception {
        mvc.perform(get("/api/device-sharing/devices")).andExpect(status().isNotFound());
        mvc.perform(post("/api/device-sharing/pairing")).andExpect(status().isNotFound());
    }
}
