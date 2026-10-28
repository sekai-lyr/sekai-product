package com.sekai.picture.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Locale;

/** Additive migration for existing local libraries; never rebuilds existing tables. */
@Component
public class GallerySchemaMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    public GallerySchemaMigration(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection -> {
            var columns = new HashSet<String>();
            String table;
            try (var statement = connection.createStatement();
                 var rows = statement.executeQuery("SELECT * FROM sekai_picture_wallpaper WHERE 1=0")) {
                var meta = rows.getMetaData();
                table = meta.getTableName(1);
                for (int i = 1; i <= meta.getColumnCount(); i++) {
                    columns.add(meta.getColumnName(i).toLowerCase(Locale.ROOT));
                }
            }
            try (var statement = connection.createStatement()) {
                if (!columns.contains("content_hash")) statement.executeUpdate(
                        "ALTER TABLE sekai_picture_wallpaper ADD COLUMN content_hash VARCHAR(64)");
                if (!columns.contains("deleted_at")) statement.executeUpdate(
                        "ALTER TABLE sekai_picture_wallpaper ADD COLUMN deleted_at DATETIME");
                boolean indexed = false;
                try (var indexes = connection.getMetaData().getIndexInfo(connection.getCatalog(), null, table, false, false)) {
                    while (indexes.next()) {
                        if ("uk_picture_user_hash".equalsIgnoreCase(indexes.getString("INDEX_NAME"))) indexed = true;
                    }
                }
                if (!indexed) statement.executeUpdate(
                        "CREATE UNIQUE INDEX uk_picture_user_hash ON sekai_picture_wallpaper (user_id, content_hash)");
            }
            return null;
        });
    }
}
