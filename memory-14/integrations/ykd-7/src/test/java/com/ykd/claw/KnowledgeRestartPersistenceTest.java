package com.ykd.claw;

import com.ykd.claw.knowledge.entity.KnowledgeChunkEntity;
import com.ykd.claw.knowledge.entity.KnowledgeDocumentEntity;
import com.ykd.claw.knowledge.repository.KnowledgeChunkJpaRepository;
import com.ykd.claw.knowledge.repository.KnowledgeDocumentJpaRepository;
import com.ykd.claw.channel.wechat.WechatContextTokenStore;
import com.ykd.claw.skill.entity.SkillTaskEntity;
import com.ykd.claw.skill.repository.SkillTaskJpaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KnowledgeRestartPersistenceTest {
    @TempDir Path directory;

    @Test
    void knowledgeRemainsAfterApplicationContextRestart() {
        String databaseUrl = "jdbc:sqlite:" + directory.resolve("restart.db").toString().replace('\\', '/');
        Long documentId;
        Long skillTaskId;
        try (ConfigurableApplicationContext first = start(databaseUrl)) {
            var documents = first.getBean(KnowledgeDocumentJpaRepository.class);
            var chunks = first.getBean(KnowledgeChunkJpaRepository.class);
            var document = documents.saveAndFlush(
                    new KnowledgeDocumentEntity("guide.txt", "/docs/guide.txt", Instant.now()));
            chunks.saveAndFlush(new KnowledgeChunkEntity(
                    document.getId(), "persistent knowledge", "[1.0,0.0]", 1, Instant.now()));
            first.getBean(WechatContextTokenStore.class).save("wechat-user", "context-token");
            skillTaskId = first.getBean(SkillTaskJpaRepository.class).saveAndFlush(
                    new SkillTaskEntity("travel-user", "travel-conversation", "travel",
                            "杭州三日游", Instant.now())).getId();
            documentId = document.getId();
        }

        try (ConfigurableApplicationContext second = start(databaseUrl)) {
            var documents = second.getBean(KnowledgeDocumentJpaRepository.class);
            var chunks = second.getBean(KnowledgeChunkJpaRepository.class);
            assertTrue(documents.findById(documentId).isPresent());
            assertEquals(1, chunks.findByDocumentIdOrderById(documentId).size());
            assertEquals("context-token",
                    second.getBean(WechatContextTokenStore.class).findAll().get("wechat-user"));
            assertEquals("杭州三日游", second.getBean(SkillTaskJpaRepository.class)
                    .findById(skillTaskId).orElseThrow().getAccumulatedInput());
        }
    }

    private ConfigurableApplicationContext start(String databaseUrl) {
        return new SpringApplicationBuilder(App.class).run(
                "--spring.profiles.active=sqlite",
                "--spring.main.web-application-type=none",
                "--spring.main.banner-mode=off",
                "--spring.ai.deepseek.api-key=test-key",
                "--spring.datasource.url=" + databaseUrl,
                "--spring.jpa.hibernate.ddl-auto=update",
                "--memory.extraction-enabled=false",
                "--app.cli.enabled=false");
    }
}
