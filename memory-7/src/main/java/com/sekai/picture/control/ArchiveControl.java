package com.sekai.picture.control;

import com.sekai.picture.mapper.SekaiPictureWallpaperMapper;
import com.sekai.picture.model.Result;
import com.sekai.picture.model.User;
import com.sekai.picture.model.Wallpaper;
import com.sekai.picture.service.ArchiveService;
import com.sekai.picture.service.WallpaperService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class ArchiveControl {
    private final SekaiPictureWallpaperMapper wallpapers;
    private final WallpaperService service;
    private final ArchiveService archive;
    public ArchiveControl(SekaiPictureWallpaperMapper wallpapers, WallpaperService service, ArchiveService archive) {
        this.wallpapers = wallpapers; this.service = service; this.archive = archive;
    }
    @PostMapping("/api/wallpapers/upload")
    @ResponseBody
    public ResponseEntity<Result<Wallpaper>> upload(@ModelAttribute Wallpaper picture, @RequestParam("file") MultipartFile file, HttpSession session) {
        if (!(session.getAttribute("loginUser") instanceof User user))
            return ResponseEntity.status(401).body(Result.fail("登录已过期，请重新登录"));
        picture.setUserId(user.getId());
        if (picture.getTitle() == null || picture.getTitle().isBlank()) {
            String name = file.getOriginalFilename() == null ? "未命名壁纸" : file.getOriginalFilename();
            name = name.replace('\\', '/');
            name = name.substring(name.lastIndexOf('/') + 1);
            picture.setTitle(name.substring(0, Math.min(name.length(), 120)));
        }
        return ResponseEntity.ok(service.upload(picture, file));
    }
    @GetMapping("/trash")
    public String trash(HttpSession session, Model model) {
        if (!(session.getAttribute("loginUser") instanceof User user)) return "redirect:/login";
        model.addAttribute("loginUser", user);
        model.addAttribute("wallpapers", wallpapers.listTrash(user.getId()));
        return "trash";
    }
    @PostMapping("/wallpaper/{id}/restore")
    public String restore(@PathVariable Long id, HttpSession session, RedirectAttributes redirect) {
        if (!(session.getAttribute("loginUser") instanceof User user)) return "redirect:/login";
        var result = archive.restore(user.getId(), id);
        redirect.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:/trash";
    }
    @PostMapping("/wallpaper/{id}/purge")
    public String purge(@PathVariable Long id, HttpSession session, RedirectAttributes redirect) {
        if (!(session.getAttribute("loginUser") instanceof User user)) return "redirect:/login";
        var result = archive.purge(user.getId(), id);
        redirect.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:/trash";
    }
}
