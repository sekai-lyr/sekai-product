package com.sekai.song.control;

import com.sekai.song.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @Transactional
class FeedbackIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.sekai.song.service.WebsiteFeedbackService service;
    private final ObjectMapper json=new ObjectMapper();
    @Test void pendingFeedbackOnlyBecomesPublicAfterAdminApproval() throws Exception {
        var user=session(31L);var admin=session(3L);
        mvc.perform(get("/admin/overview").session(user)).andExpect(status().isForbidden());
        mvc.perform(post("/api/feedback").contentType("application/json").content(review())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/feedback").session(user).contentType("application/json").content(review())).andExpect(status().isForbidden());
        mvc.perform(get("/api/feedback").session(user)).andExpect(status().isOk());
        String token=(String)user.getAttribute("feedbackCsrf");
        String saved=mvc.perform(post("/api/feedback").session(user).header("X-Feedback-CSRF",token).contentType("application/json").content(review()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id=json.readTree(saved).get("id").asLong();
        String pending=mvc.perform(get("/api/feedback")).andReturn().getResponse().getContentAsString();assertFalse(pending.contains("事务测试评价"));
        mvc.perform(post("/api/feedback").session(user).header("X-Feedback-CSRF",token).contentType("application/json").content(review())).andExpect(status().isTooManyRequests());
        mvc.perform(get("/api/admin/overview").session(admin)).andExpect(status().isOk());
        String adminToken=(String)admin.getAttribute("feedbackCsrf");
        mvc.perform(post("/api/admin/feedback/"+id).session(user).header("X-Feedback-CSRF",token).contentType("application/json").content("{\"status\":\"approved\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/feedback/"+id).session(admin).header("X-Feedback-CSRF",adminToken).contentType("application/json").content("{\"status\":\"approved\"}")).andExpect(status().isOk());
        String approved=mvc.perform(get("/api/feedback")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();assertTrue(approved.contains("事务测试评价"));
        mvc.perform(get("/api/admin/feedback/export").session(user)).andExpect(status().isForbidden());
        String csv=mvc.perform(get("/api/admin/feedback/export").session(admin)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();assertTrue(csv.contains("事务测试评价"));
    }
    private String review(){return "{\"content\":\"事务测试评价：页面好用，建议优化移动端\"}";}
    @Test void repliesAndLikesRespectApprovalAndLikesAreIdempotent() throws Exception {
        var user=session(31L);mvc.perform(get("/api/feedback").session(user));String token=(String)user.getAttribute("feedbackCsrf");
        mvc.perform(post("/api/feedback").session(user).header("X-Feedback-CSRF",token).contentType("application/json")
                .content("{\"content\":\"回复不存在的评论\",\"parentId\":999999999}"))
                .andExpect(status().isNotFound());
        String saved=mvc.perform(post("/api/feedback").session(user).header("X-Feedback-CSRF",token).contentType("application/json").content(review())).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long root=json.readTree(saved).get("id").asLong();
        mvc.perform(post("/api/feedback/"+root+"/like").session(user).header("X-Feedback-CSRF",token).contentType("application/json").content("{\"liked\":true}")).andExpect(status().isNotFound());
        service.moderate(root,"approved");
        mvc.perform(post("/api/feedback/"+root+"/like").contentType("application/json").content("{\"liked\":true}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/feedback/"+root+"/like").session(user).contentType("application/json").content("{\"liked\":true}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/feedback").session(user).header("X-Feedback-CSRF",token).contentType("application/json")
                .content("{\"content\":\"跨楼回复测试\",\"parentId\":"+root+",\"replyToId\":999999999}")).andExpect(status().isNotFound());
        for(int i=0;i<2;i++)mvc.perform(post("/api/feedback/"+root+"/like").session(user).header("X-Feedback-CSRF",token).contentType("application/json").content("{\"liked\":true}")).andExpect(status().isOk());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_feedback_like WHERE feedback_id=?",Integer.class,root));
        jdbc.update("UPDATE sekai_song_feedback SET created_ms=? WHERE id=?",System.currentTimeMillis()-61000,root);
        String reply=mvc.perform(post("/api/feedback").session(user).header("X-Feedback-CSRF",token).contentType("application/json")
                .content("{\"content\":\"楼中楼回复测试\",\"parentId\":"+root+"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long replyId=json.readTree(reply).get("id").asLong();
        String pending=mvc.perform(get("/api/feedback/"+root+"/replies")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();assertFalse(pending.contains("楼中楼回复测试"));
        service.moderate(replyId,"approved");
        String approved=mvc.perform(get("/api/feedback/"+root+"/replies")).andReturn().getResponse().getContentAsString();assertTrue(approved.contains("楼中楼回复测试"));
        String roots=mvc.perform(get("/api/feedback").param("sort","hot")).andReturn().getResponse().getContentAsString();
        assertFalse(roots.contains("楼中楼回复测试"));assertTrue(roots.contains("likeCount"));
        service.moderate(root,"rejected");mvc.perform(get("/api/feedback/"+root+"/replies")).andExpect(status().isNotFound());
    }
    @Test void shortPlainCommentNeedsNoRatingAndCsvCannotExecuteFormula() throws Exception {
        var user=session(31L);mvc.perform(get("/api/feedback").session(user));
        String body=mvc.perform(post("/api/feedback").session(user).header("X-Feedback-CSRF",user.getAttribute("feedbackCsrf"))
                .contentType("application/json").content("{\"content\":\"好用\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id=json.readTree(body).get("id").asLong();
        assertNull(jdbc.queryForObject("SELECT usability FROM sekai_song_feedback WHERE id=?",Integer.class,id));
        jdbc.update("UPDATE sekai_song_feedback SET content=? WHERE id=?","=SUM(1,2)\n测试",id);
        String csv=service.export();assertTrue(csv.contains("'="));
    }
    @Test void playbackReportsAreOwnedIdempotentAndBoundedByElapsedTime() throws Exception {
        var session=session(31L);mvc.perform(get("/api/listening/token").session(session)).andExpect(status().isOk());
        String token=(String)session.getAttribute("feedbackCsrf");
        Long songId=jdbc.queryForObject("SELECT id FROM sekai_song_track WHERE user_id=31 ORDER BY id LIMIT 1",Long.class);
        String start=mvc.perform(post("/api/listening/start").session(session).header("X-Feedback-CSRF",token).contentType("application/json")
                .content("{\"songId\":"+songId+",\"stage\":\"disc\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String id=json.readTree(start).get("id").asText();
        jdbc.update("UPDATE sekai_song_listen_session SET last_ms=? WHERE id=?",System.currentTimeMillis()-10000,id);
        String body="{\"cumulativeMs\":9000,\"stage\":\"disc\"}";
        String accepted=mvc.perform(post("/api/listening/"+id).session(session).header("X-Feedback-CSRF",token).contentType("application/json").content(body)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(9000,json.readTree(accepted).get("acceptedMs").asLong());
        String duplicate=mvc.perform(post("/api/listening/"+id).session(session).header("X-Feedback-CSRF",token).contentType("application/json").content(body)).andReturn().getResponse().getContentAsString();
        assertEquals(0,json.readTree(duplicate).get("acceptedMs").asLong());
        jdbc.update("UPDATE sekai_song_listen_session SET last_ms=? WHERE id=?",System.currentTimeMillis()-1000,id);
        String forged=mvc.perform(post("/api/listening/"+id).session(session).header("X-Feedback-CSRF",token).contentType("application/json").content("{\"cumulativeMs\":1000000,\"stage\":\"folia\"}")).andReturn().getResponse().getContentAsString();
        assertTrue(json.readTree(forged).get("acceptedMs").asLong()<3000);
        mvc.perform(get("/api/listening/token").session(session(3L))).andExpect(status().isOk());
        var other=session(3L);mvc.perform(get("/api/listening/token").session(other));
        mvc.perform(post("/api/listening/"+id).session(other).header("X-Feedback-CSRF",other.getAttribute("feedbackCsrf")).contentType("application/json").content(body)).andExpect(status().isNotFound());
        service.login(31L);service.login(31L);
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_login_daily WHERE user_id=31 AND day=?",Integer.class,java.time.LocalDate.now(java.time.ZoneId.of("Asia/Shanghai"))));
    }
    private MockHttpSession session(Long id){var s=new MockHttpSession();var u=new User();u.setId(id);u.setNickName("测试");s.setAttribute("loginUser",u);return s;}
}
