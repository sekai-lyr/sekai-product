from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
def edit(name, fn):
    p = root / name
    p.write_text(fn(p.read_text(encoding='utf-8-sig')), encoding='utf-8')

base = 'src/main/java/com/sekai/picture/'
for name in ['model/Wallpaper.java', 'dataobject/SekaiPictureWallpaperDO.java']:
    edit(base + name, lambda s: s.replace('    private Long id;', '''    private String contentHash;
    private LocalDateTime deletedAt;
    public String getContentHash() { return contentHash; }
    public void setContentHash(String value) { contentHash = value; }
    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime value) { deletedAt = value; }
    private Long id;'''))

edit(base + 'mapper/SekaiPictureWallpaperMapper.java', lambda s: s.replace('    int insert(', '''    SekaiPictureWallpaperDO findOwned(@Param("id") Long id, @Param("userId") Long userId);
    SekaiPictureWallpaperDO findHash(@Param("userId") Long userId, @Param("hash") String hash);
    List<SekaiPictureWallpaperDO> listTrash(@Param("userId") Long userId);
    List<SekaiPictureWallpaperDO> listUnhashed(@Param("userId") Long userId);
    int setHash(@Param("id") Long id, @Param("hash") String hash);
    int restore(@Param("id") Long id, @Param("userId") Long userId);
    int purge(@Param("id") Long id, @Param("userId") Long userId);
    List<String> listImageUrls();
    com.sekai.picture.model.ArchiveHealth health(@Param("userId") Long userId);
    int insert('''))

xml = 'src/main/resources/com.sekai.picture.mapper/SekaiPictureWallpaperMapper.xml'
def mapper(s):
    s = s.replace('<id property="id"', '<result property="contentHash" column="content_hash"/>\n        <result property="deletedAt" column="deleted_at"/>\n        <id property="id"')
    s = s.replace('w.id, w.user_id,', 'w.content_hash, w.deleted_at, w.id, w.user_id,')
    s = s.replace('color_tone, is_original, download_count\n', 'color_tone, is_original, download_count, content_hash\n')
    s = s.replace('#{colorTone}, #{original}, #{downloadCount}\n', '#{colorTone}, #{original}, #{downloadCount}, #{contentHash}\n')
    s = s.replace('WHERE w.id = #{id} AND w.user_id = #{userId}', 'WHERE w.id = #{id} AND w.user_id = #{userId} AND w.deleted_at IS NULL')
    s = s.replace('WHERE w.user_id = #{userId}', 'WHERE w.user_id = #{userId} AND w.deleted_at IS NULL')
    s = s.replace('WHERE user_id = #{userId}', 'WHERE user_id = #{userId} AND deleted_at IS NULL')
    s = s.replace('WHERE id = #{id} AND user_id = #{userId}', 'WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NULL')
    s = s.replace('DELETE FROM sekai_picture_wallpaper', 'UPDATE sekai_picture_wallpaper SET deleted_at = NOW()')
    s = s.replace('<delete id="deleteByIdAndUserId">', '<update id="deleteByIdAndUserId">').replace('    </delete>', '    </update>')
    extra = '''
    <select id="findOwned" resultMap="BaseResultMap">
        SELECT * FROM sekai_picture_wallpaper WHERE id = #{id} AND user_id = #{userId}
    </select>
    <select id="findHash" resultMap="BaseResultMap">
        SELECT * FROM sekai_picture_wallpaper WHERE user_id = #{userId} AND content_hash = #{hash} LIMIT 1
    </select>
    <select id="listTrash" resultMap="BaseResultMap">
        SELECT * FROM sekai_picture_wallpaper WHERE user_id = #{userId} AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC
    </select>
    <select id="listUnhashed" resultMap="BaseResultMap">
        SELECT * FROM sekai_picture_wallpaper WHERE user_id = #{userId} AND content_hash IS NULL
    </select>
    <update id="setHash">
        UPDATE sekai_picture_wallpaper SET content_hash = #{hash} WHERE id = #{id} AND content_hash IS NULL
    </update>
    <update id="restore">
        UPDATE sekai_picture_wallpaper SET deleted_at = NULL WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NOT NULL
    </update>
    <delete id="purge">
        DELETE FROM sekai_picture_wallpaper WHERE id = #{id} AND user_id = #{userId} AND deleted_at IS NOT NULL
    </delete>
    <select id="listImageUrls" resultType="string">SELECT image_url FROM sekai_picture_wallpaper</select>
    <select id="health" resultType="com.sekai.picture.model.ArchiveHealth">
        SELECT COALESCE(SUM(CASE WHEN deleted_at IS NULL AND category_id IS NULL THEN 1 ELSE 0 END),0) AS uncategorized,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND (tags IS NULL OR TRIM(tags) = '') THEN 1 ELSE 0 END),0) AS untagged,
            COALESCE(SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END),0) AS trash_count,
            COALESCE(SUM(file_size),0) AS stored_bytes,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL THEN download_count ELSE 0 END),0) AS downloads
        FROM sekai_picture_wallpaper WHERE user_id = #{userId}
    </select>
'''
    return s.replace('</mapper>', extra + '</mapper>')
edit(xml, mapper)
edit('build-data/init.sql', lambda s: s.replace('    image_url VARCHAR(500) NOT NULL,', '    image_url VARCHAR(500) NOT NULL,\n    content_hash VARCHAR(64),\n    deleted_at DATETIME,\n    UNIQUE KEY uk_picture_user_hash (user_id, content_hash),'))
edit('pom.xml', lambda s: s.replace('    </dependencies>', '''        <dependency>
            <groupId>com.h2database</groupId><artifactId>h2</artifactId><scope>test</scope>
        </dependency>
    </dependencies>'''))
