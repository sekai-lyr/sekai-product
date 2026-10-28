from pathlib import Path
root = Path(__file__).resolve().parents[1]
def edit(name, fn):
    p=root/name
    p.write_text(fn(p.read_text(encoding='utf-8-sig')),encoding='utf-8')
base='src/main/java/com/sekai/picture/'
def controller(s):
    s=s.replace('    @Resource\n    private WallpaperService', '    @Resource\n    private com.sekai.picture.service.ImageStorage storage;\n\n    @Resource\n    private WallpaperService',1)
    s=s.replace('RedirectAttributes redirectAttributes)', 'RedirectAttributes redirectAttributes,\n                         @RequestParam(value="returnTo", required=false) String returnTo)')
    s=s.replace('return "redirect:/home";', 'return "redirect:" + safeReturn(returnTo);')
    s=s.replace('redirectAttributes.addFlashAttribute("message", result.getMessage());', 'redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());')
    a=s.index('        wallpaperService.increaseDownloadCount(wallpaperId, user.getId());')
    b=s.index('    private User getLoginUser',a)
    s=s[:a]+'''        Path localFile = storage.resolve(wallpaper.getImageUrl());
        if (localFile == null || !Files.isRegularFile(localFile)) {
            response.sendError(404, "原图文件不存在，无法下载");
            return;
        }
        String fileName = wallpaper.getFileName() == null ? "wallpaper-" + wallpaperId + ".jpg" : wallpaper.getFileName();
        String encodedName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
        response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodedName);
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setContentType("application/octet-stream");
        response.setContentLengthLong(Files.size(localFile));
        Files.copy(localFile, response.getOutputStream());
        response.flushBuffer();
        wallpaperService.increaseDownloadCount(wallpaperId, user.getId());
    }

    static String safeReturn(String target) {
        if (target == null || target.length() > 2048) return "/home";
        if (target.equals("/home")) return target;
        if (!target.startsWith("/home?")) return "/home";
        try {
            java.net.URI uri = java.net.URI.create(target);
            if (uri.getFragment() != null || uri.getRawAuthority() != null || !"/home".equals(uri.getPath())) return "/home";
            var allowed = java.util.Set.of("keyword", "categoryId", "orientation", "original", "colorTone", "sort", "favorite", "page", "needs");
            for (String pair : uri.getRawQuery().split("&")) {
                String key = java.net.URLDecoder.decode(pair.split("=", 2)[0], StandardCharsets.UTF_8);
                if (!allowed.contains(key)) return "/home";
            }
            if (target.contains("\\r") || target.contains("\\n")) return "/home";
            return target;
        } catch (IllegalArgumentException e) { return "/home"; }
    }

''' + s[b:]
    return s
edit(base+'control/WallpaperControl.java',controller)
def page(s):
    s=s.replace('    @Resource\n    private CategoryService', '    @Resource\n    private com.sekai.picture.mapper.SekaiPictureWallpaperMapper wallpaperMapper;\n\n    @Resource\n    private CategoryService',1)
    s=s.replace('model.addAttribute("stats", buildStats(user.getId()));', 'model.addAttribute("stats", buildStats(user.getId()));\n        model.addAttribute("health", wallpaperMapper.health(user.getId()));')
    # A dedicated, explicit maintenance filter uses the same paginated gallery.
    s=s.replace('@RequestParam(value = "page", defaultValue = "1") int page)', '@RequestParam(value = "page", defaultValue = "1") int page,\n                       @RequestParam(value = "needs", required = false) String needs)')
    s=s.replace('        int pageSize = 9;', '        if (!java.util.Set.of("uncategorized", "untagged").contains(needs == null ? "" : needs)) needs = null;\n        int pageSize = 12;')
    s=s.replace('        int totalPages =', '        if (needs != null) total = wallpaperMapper.countNeeds(user.getId(), needs);\n        int totalPages =',1)
    s=s.replace('        model.addAttribute("loginUser", user);', '        if (needs != null) wallpapers = wallpaperMapper.listNeeds(user.getId(), needs, (currentPage - 1) * pageSize, pageSize).stream().map(com.sekai.picture.dataobject.SekaiPictureWallpaperDO::convertToWallpaper).toList();\n        model.addAttribute("needs", needs);\n        model.addAttribute("loginUser", user);',1)
    return s
edit(base+'control/PageControl.java',page)
edit(base+'mapper/SekaiPictureWallpaperMapper.java',lambda s:s.replace('    int insert(', '''    int countNeeds(@Param("userId") Long userId, @Param("needs") String needs);
    List<SekaiPictureWallpaperDO> listNeeds(@Param("userId") Long userId, @Param("needs") String needs, @Param("offset") int offset, @Param("limit") int limit);
    int insert('''))
edit('src/main/resources/com.sekai.picture.mapper/SekaiPictureWallpaperMapper.xml',lambda s:s.replace('</mapper>', '''    <sql id="NeedsFilter">
        WHERE w.user_id = #{userId} AND w.deleted_at IS NULL
        <choose><when test="needs == 'uncategorized'">AND w.category_id IS NULL</when>
        <otherwise>AND (w.tags IS NULL OR TRIM(w.tags) = '')</otherwise></choose>
    </sql>
    <select id="countNeeds" resultType="int">SELECT COUNT(1) FROM sekai_picture_wallpaper w <include refid="NeedsFilter"/></select>
    <select id="listNeeds" resultMap="BaseResultMap">
        SELECT <include refid="Joined_Column_List"/> FROM sekai_picture_wallpaper w
        LEFT JOIN sekai_picture_category c ON c.id = w.category_id
        LEFT JOIN sekai_picture_favorite f ON f.wallpaper_id = w.id AND f.user_id = #{userId}
        <include refid="NeedsFilter"/> ORDER BY w.id DESC LIMIT #{limit} OFFSET #{offset}
    </select>
</mapper>'''))
