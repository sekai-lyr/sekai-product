from pathlib import Path
root = Path(__file__).resolve().parents[1]
def edit(name, fn):
    p = root / name
    p.write_text(fn(p.read_text(encoding='utf-8-sig')), encoding='utf-8')
base = 'src/main/java/com/sekai/picture/'
def service(s):
    s = s.replace('    private static final Path UPLOAD_DIR = Path.of("uploads", "wallpapers");', '    @Resource\n    private com.sekai.picture.service.ImageStorage storage;')
    a = s.index('    @Override\n    @Transactional\n    public Result<Wallpaper> upload')
    b = s.index('    @Override', a + 30)
    s = s[:a] + '''    @Override
    @Transactional
    public Result<Wallpaper> upload(Wallpaper wallpaper, MultipartFile file) {
        String invalid = validateMetadata(wallpaper);
        if (invalid != null) return Result.fail(invalid);
        if (!canUseCategory(wallpaper.getUserId(), wallpaper.getCategoryId())) return Result.fail("请选择自己的分类");
        if (file == null || file.isEmpty()) return Result.fail("请选择图片");
        if (file.getSize() > com.sekai.picture.service.ImageStorage.MAX_BYTES) return Result.fail("每张图片不能超过 20 MB");
        Path staged = null;
        Path target = null;
        Long savedId = null;
        boolean saved = false;
        try {
            Files.createDirectories(storage.root().resolve(".incoming"));
            staged = Files.createTempFile(storage.root().resolve(".incoming"), "upload-", ".tmp");
            file.transferTo(staged);
            var decoded = storage.decode(staged);
            String hash = storage.hash(staged);
            // Backfill fingerprints for this user's older local images without changing their URLs.
            for (var old : wallpaperMapper.listUnhashed(wallpaper.getUserId())) {
                Path oldFile = storage.resolve(old.getImageUrl());
                if (oldFile == null || !Files.isRegularFile(oldFile)) continue;
                String oldHash = storage.hash(oldFile);
                if (wallpaperMapper.findHash(wallpaper.getUserId(), oldHash) == null) {
                    wallpaperMapper.setHash(old.getId(), oldHash);
                }
            }
            var duplicate = wallpaperMapper.findHash(wallpaper.getUserId(), hash);
            if (duplicate != null) return Result.fail(duplicate.getDeletedAt() == null
                    ? "这张图片已在图库中：" + duplicate.getTitle() : "这张图片已在回收站，请先恢复或彻底删除");
            Path dayDir = storage.root().resolve(LocalDateTime.now().format(DATE_PATH));
            Files.createDirectories(dayDir);
            String storedName = UUID.randomUUID() + "." + decoded.extension();
            target = dayDir.resolve(storedName);
            Files.move(staged, target);
            wallpaper.setWidth(decoded.image().getWidth());
            wallpaper.setHeight(decoded.image().getHeight());
            wallpaper.setTitle(wallpaper.getTitle().trim());
            wallpaper.setImageUrl("/wallpaper-image/" + dayDir.getFileName() + "/" + storedName);
            String originalName = file.getOriginalFilename() == null ? "wallpaper." + decoded.extension() : file.getOriginalFilename();
            originalName = originalName.replace('\\\\', '/');
            originalName = originalName.substring(originalName.lastIndexOf('/') + 1);
            wallpaper.setFileName(originalName.length() > 255 ? storedName : originalName);
            wallpaper.setFileSize(file.getSize());
            wallpaper.setContentHash(hash);
            wallpaper.setDeletedAt(null);
            wallpaper.setDownloadCount(0);
            wallpaper.setOriginal(Boolean.TRUE.equals(wallpaper.getOriginal()));
            var record = new SekaiPictureWallpaperDO(wallpaper);
            wallpaperMapper.insert(record);
            savedId = record.getId();
            storage.thumbnail(savedId, target);
            Path committedFile = target;
            Long committedId = savedId;
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override public void afterCompletion(int status) {
                            if (status != STATUS_COMMITTED) cleanUpload(committedFile, committedId);
                        }
                    });
            saved = true;
            return Result.ok(wallpaperMapper.selectByIdAndUserId(savedId, wallpaper.getUserId()).convertToWallpaper(), "上传成功");
        } catch (org.springframework.dao.DuplicateKeyException e) {
            return Result.fail("这张图片已经上传，请刷新图库查看");
        } catch (IOException e) {
            if (savedId != null) org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            return Result.fail("图片处理失败，请检查格式、大小和图片内容后重试");
        } finally {
            cleanUpload(staged, null);
            if (!saved) cleanUpload(target, savedId);
        }
    }

    private void cleanUpload(Path path, Long id) {
        try {
            if (path != null) Files.deleteIfExists(path);
            if (id != null) Files.deleteIfExists(storage.thumbnailPath(id));
        } catch (IOException e) {
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Unable to clean temporary image", e);
        }
    }

    private String validateMetadata(Wallpaper wallpaper) {
        if (wallpaper == null || trimToNull(wallpaper.getTitle()) == null) return "壁纸标题不能为空";
        if (wallpaper.getTitle().length() > 120) return "标题最多 120 字";
        if (wallpaper.getCharacterName() != null && wallpaper.getCharacterName().length() > 120) return "角色名最多 120 字";
        if (wallpaper.getSourceName() != null && wallpaper.getSourceName().length() > 120) return "来源最多 120 字";
        if (wallpaper.getTags() != null && wallpaper.getTags().length() > 255) return "标签最多 255 字";
        if (wallpaper.getColorTone() != null && wallpaper.getColorTone().length() > 40) return "色调最多 40 字";
        return null;
    }

''' + s[b:]
    s = s.replace('''        if (trimToNull(wallpaper.getTitle()) == null) {
            return Result.fail("壁纸标题不能为空");
        }''', '''        String invalid = validateMetadata(wallpaper);
        if (invalid != null) return Result.fail(invalid);''')
    s = s.replace('        favoriteMapper.deleteByUserIdAndWallpaperId(userId, wallpaperId);\n', '')
    s = s.replace('"已删除壁纸记录"', '"已移入回收站，可以随时恢复"')
    a = s.index('    private void fillImageMeta(')
    b = s.index('    private boolean canUseCategory', a)
    s = s[:a] + s[b:]
    a = s.index('    private String findExtension(')
    b = s.index('    private String trimToNull', a)
    s = s[:a] + s[b:]
    s = s.replace('import javax.imageio.ImageIO;\n','').replace('import java.awt.image.BufferedImage;\n','').replace('import java.util.Locale;\n','')
    return s
edit(base + 'service/impl/WallpaperServiceImpl.java', service)

def favorite(s):
    s = s.replace('    @Override', '''    @Resource
    private com.sekai.picture.mapper.SekaiPictureWallpaperMapper wallpaperMapper;

    @Override''', 1)
    s = s.replace('''        if (favoriteMapper.selectByUserIdAndWallpaperId''', '''        if (wallpaperMapper.selectByIdAndUserId(wallpaperId, userId) == null) return Result.fail("壁纸不存在或没有权限");
        if (favoriteMapper.selectByUserIdAndWallpaperId''', 1)
    s = s.replace('        int changed = 0;', '''        wallpaperIds = wallpaperIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (wallpaperIds.size() > 100) return Result.fail("每次最多处理 100 张图片");
        for (Long id : wallpaperIds) {
            if (wallpaperMapper.selectByIdAndUserId(id, userId) == null) return Result.fail("所选图片不存在或没有权限");
        }
        int changed = 0;''')
    return s
edit(base + 'service/impl/FavoriteServiceImpl.java', favorite)
edit('src/main/resources/com.sekai.picture.mapper/SekaiPictureFavoriteMapper.xml', lambda s: s.replace('SELECT COUNT(1) FROM sekai_picture_favorite WHERE user_id = #{userId}', 'SELECT COUNT(1) FROM sekai_picture_favorite f JOIN sekai_picture_wallpaper w ON w.id = f.wallpaper_id AND w.user_id = f.user_id WHERE f.user_id = #{userId} AND w.deleted_at IS NULL'))
