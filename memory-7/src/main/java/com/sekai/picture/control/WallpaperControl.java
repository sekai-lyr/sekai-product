package com.sekai.picture.control;

import com.sekai.picture.model.Category;
import com.sekai.picture.model.Result;
import com.sekai.picture.model.User;
import com.sekai.picture.model.Wallpaper;
import com.sekai.picture.service.CategoryService;
import com.sekai.picture.service.FavoriteService;
import com.sekai.picture.service.WallpaperService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Controller
public class WallpaperControl {

    @Resource
    private com.sekai.picture.service.ImageStorage storage;

    @Resource
    private WallpaperService wallpaperService;

    @Resource
    private CategoryService categoryService;

    @Resource
    private FavoriteService favoriteService;

    @PostMapping("/wallpaper/upload")
    public String upload(@ModelAttribute Wallpaper wallpaper,
                         @RequestParam("file") MultipartFile file,
                         HttpSession session,
                         RedirectAttributes redirectAttributes,
                         @RequestParam(value="returnTo", required=false) String returnTo) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        wallpaper.setUserId(user.getId());
        Result<Wallpaper> result = wallpaperService.upload(wallpaper, file);
        redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return result.isSuccess() ? "redirect:/home" : "redirect:/upload";
    }

    @PostMapping("/category/create")
    public String createCategory(@ModelAttribute Category category,
                                 HttpSession session,
                                 RedirectAttributes redirectAttributes,
                         @RequestParam(value="returnTo", required=false) String returnTo) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        category.setUserId(user.getId());
        Result<Category> result = categoryService.create(category);
        redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:/upload";
    }

    @PostMapping("/favorite/{wallpaperId}")
    public String favorite(@PathVariable Long wallpaperId,
                           HttpSession session,
                           RedirectAttributes redirectAttributes,
                         @RequestParam(value="returnTo", required=false) String returnTo) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        Result<Void> result = favoriteService.toggle(user.getId(), wallpaperId);
        redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:" + safeReturn(returnTo);
    }

    @PostMapping("/favorite/batch")
    public String batchFavorite(@RequestParam(value = "wallpaperIds", required = false) List<Long> wallpaperIds,
                                @RequestParam("action") String action,
                                HttpSession session,
                                RedirectAttributes redirectAttributes,
                         @RequestParam(value="returnTo", required=false) String returnTo) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        boolean favorite = "favorite".equals(action);
        Result<Void> result = favoriteService.batchSet(user.getId(), wallpaperIds, favorite);
        redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:" + safeReturn(returnTo);
    }

    @PostMapping("/wallpaper/{wallpaperId}/update")
    public String updateMeta(@PathVariable Long wallpaperId,
                             @ModelAttribute Wallpaper wallpaper,
                             HttpSession session,
                             RedirectAttributes redirectAttributes,
                         @RequestParam(value="returnTo", required=false) String returnTo) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        wallpaper.setId(wallpaperId);
        Result<Wallpaper> result = wallpaperService.updateMeta(user.getId(), wallpaper);
        redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:" + safeReturn(returnTo);
    }

    @PostMapping("/wallpaper/{wallpaperId}/delete")
    public String delete(@PathVariable Long wallpaperId,
                         HttpSession session,
                         RedirectAttributes redirectAttributes,
                         @RequestParam(value="returnTo", required=false) String returnTo) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        Result<Void> result = wallpaperService.delete(user.getId(), wallpaperId);
        redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:" + safeReturn(returnTo);
    }

    @PostMapping("/wallpaper/batch/category")
    public String batchMoveCategory(@RequestParam(value = "wallpaperIds", required = false) List<Long> wallpaperIds,
                                    @RequestParam(value = "categoryId", required = false) Long categoryId,
                                    HttpSession session,
                                    RedirectAttributes redirectAttributes,
                         @RequestParam(value="returnTo", required=false) String returnTo) {
        User user = getLoginUser(session);
        if (user == null) {
            return "redirect:/login";
        }
        Result<Void> result = wallpaperService.batchMoveCategory(user.getId(), wallpaperIds, categoryId);
        redirectAttributes.addFlashAttribute(result.isSuccess() ? "message" : "error", result.getMessage());
        return "redirect:" + safeReturn(returnTo);
    }

    @GetMapping("/download/{wallpaperId}")
    public void download(@PathVariable Long wallpaperId,
                         HttpSession session,
                         HttpServletResponse response) throws IOException {
        User user = getLoginUser(session);
        if (user == null) {
            response.sendRedirect("/login");
            return;
        }
        Wallpaper wallpaper = wallpaperService.getByIdAndUserId(wallpaperId, user.getId());
        if (wallpaper == null) {
            response.sendRedirect("/home");
            return;
        }
        Path localFile = storage.resolve(wallpaper.getImageUrl());
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
            if (target.contains("\r") || target.contains("\n")) return "/home";
            return target;
        } catch (IllegalArgumentException e) { return "/home"; }
    }

    private User getLoginUser(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (loginUser instanceof User user) {
            return user;
        }
        return null;
    }
}
