package com.sekai.song.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.io.IOException;

@Component
public class SongSchemaMaintenance implements ApplicationRunner {
    private final JdbcTemplate jdbcTemplate;

    public SongSchemaMaintenance(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator(new ClassPathResource("db/library-improvements.sql")).execute(jdbcTemplate.getDataSource());
        ensureColumn("sekai_song_track", "local_audio_url", "VARCHAR(800)");
        ensureColumn("sekai_song_track", "local_video_url", "VARCHAR(800)");
        Integer bindings = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='sekai_song_local_binding'", Integer.class);
        if (bindings == null || bindings == 0) {
            jdbcTemplate.execute(new String(new ClassPathResource("db/local-library.sql").getContentAsByteArray(), StandardCharsets.UTF_8));
        }
        Integer feedback = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('sekai_song_feedback','sekai_song_login_daily','sekai_song_listen_session','sekai_song_listen_daily')", Integer.class);
        Integer likes = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='sekai_song_feedback_like'", Integer.class);
        if (feedback == null || feedback < 4 || likes == null || likes == 0) {
            new org.springframework.jdbc.datasource.init.ResourceDatabasePopulator(new ClassPathResource("db/feedback-overview.sql")).execute(jdbcTemplate.getDataSource());
        }
        ensureIndex("sekai_song_track", "idx_library_recent", "user_id,create_time,id");
        ensureIndex("sekai_song_listen_session", "idx_library_listening", "user_id,song_id,start_day");
        ensureColumn("sekai_song_feedback", "parent_id", "BIGINT NULL");
        ensureColumn("sekai_song_feedback", "reply_to_id", "BIGINT NULL");
        Integer replyIndex = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='sekai_song_feedback' AND index_name='idx_feedback_parent_status'", Integer.class);
        if (replyIndex == null || replyIndex == 0) jdbcTemplate.execute("CREATE INDEX idx_feedback_parent_status ON sekai_song_feedback(parent_id,status,id)");
        for (String column : java.util.List.of("usability", "innovation")) {
            Integer required = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sekai_song_feedback' AND column_name=? AND is_nullable='NO'", Integer.class, column);
            if (required != null && required > 0) jdbcTemplate.execute("ALTER TABLE sekai_song_feedback MODIFY COLUMN " + column + " TINYINT NULL");
        }
    }

    private void ensureIndex(String table, String name, String columns) {
        Integer count=jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=?",Integer.class,table,name);
        if(count==0)jdbcTemplate.execute("CREATE INDEX "+name+" ON "+table+"("+columns+")");
    }

    private void ensureColumn(String tableName, String columnName, String definition) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns " +
                        "WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                Integer.class,
                tableName,
                columnName);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + definition);
    }

}
