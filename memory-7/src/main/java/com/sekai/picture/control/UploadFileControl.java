package com.sekai.picture.control;

import com.sekai.picture.mapper.SekaiPictureWallpaperMapper;
import com.sekai.picture.model.User;
import com.sekai.picture.service.ImageStorage;
import jakarta.servlet.http.HttpSession;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;

@Controller
public class UploadFileControl {
    private final SekaiPictureWallpaperMapper wallpapers;
    private final ImageStorage storage;
    public UploadFileControl(SekaiPictureWallpaperMapper wallpapers, ImageStorage storage) {
        this.wallpapers = wallpapers; this.storage = storage;
    }
    @GetMapping({"/uploads/{*filePath}", "/wallpaper-image/{*filePath}"})
    public ResponseEntity<Resource> legacyPath() { return ResponseEntity.notFound().build(); }
    @GetMapping("/media/{id}")
    public ResponseEntity<Resource> original(@PathVariable Long id, HttpSession session) throws IOException {
        return serve(id, session, false);
    }
    @GetMapping("/media/{id}/thumbnail")
    public ResponseEntity<Resource> thumbnail(@PathVariable Long id, HttpSession session) throws IOException {
        return serve(id, session, true);
    }
    private ResponseEntity<Resource> serve(Long id, HttpSession session, boolean thumbnail) throws IOException {
        if (!(session.getAttribute("loginUser") instanceof User user)) return ResponseEntity.status(401).build();
        var wallpaper = wallpapers.findOwned(id, user.getId());
        if (wallpaper == null) return ResponseEntity.notFound().build();
        var file = storage.resolve(wallpaper.getImageUrl());
        if (file == null) {
            URI remote;
            try { remote = URI.create(wallpaper.getImageUrl()); }
            catch (IllegalArgumentException e) { return ResponseEntity.notFound().build(); }
            if (!"https".equalsIgnoreCase(remote.getScheme()) || remote.getHost() == null) return ResponseEntity.notFound().build();
            return ResponseEntity.status(302).location(remote).header("Cache-Control", "private, no-store").build();
        }
        if (!Files.isRegularFile(file)) return ResponseEntity.notFound().build();
        if (thumbnail) {
            try { file = storage.thumbnail(id, file); }
            catch (IOException e) { return ResponseEntity.status(422).build(); }
        }
        String type = Files.probeContentType(file);
        if (type == null || !java.util.Set.of("image/jpeg", "image/png", "image/gif", "image/webp").contains(type))
            return ResponseEntity.status(422).build();
        return ResponseEntity.ok().header("Content-Type", type).header("Cache-Control", "private, no-store")
                .header("X-Content-Type-Options", "nosniff").body(new UrlResource(file.toUri()));
    }
}
