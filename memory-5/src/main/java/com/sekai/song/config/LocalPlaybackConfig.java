package com.sekai.song.config;

import com.sekai.song.mapper.SekaiSongTrackMapper;
import com.sekai.song.model.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

@Configuration
public class LocalPlaybackConfig implements WebMvcConfigurer {
    private final SekaiSongTrackMapper songs;

    public LocalPlaybackConfig(SekaiSongTrackMapper songs) {
        this.songs = songs;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler) throws Exception {
                response.setHeader("Cache-Control", "private, no-store");
                if ("POST".equals(request.getMethod()) && request.getContentLengthLong()>65536) {
                    response.sendError(413,"这里只接收歌曲字段，不接收音频数据");return false;
                }
                return true;
            }
        }).addPathPatterns("/local-player/library/**", "/api/feedback", "/api/feedback/**", "/api/admin/**", "/api/listening/**", "/api/device-sharing/**");
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler) throws Exception {
                response.setHeader("Cache-Control", "private, no-store");
                if(request.getContentLengthLong()>9*1024*1024){response.sendError(413,"备份文件过大");return false;}
                return true;
            }
        }).addPathPatterns("/api/library-tools/**");
        registry.addInterceptor(new BrowserLocalOnly()).addPathPatterns(
                "/songs/audio/*", "/songs/video/*", "/songs/cover/*", "/playlists/*/audio-folder", "/playlists/local-audio-folder");
        registry.addInterceptor(new AudioAccess(songs)).addPathPatterns(
                "/uploads/**", "/external-uploads/**", "/bilibili/direct/**", "/bilibili/stream/**",
                "/playlists/*/audio-folder-path", "/playlists/local-audio-folder-path");
    }

    static class BrowserLocalOnly implements HandlerInterceptor {
        @Override
        public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
            response.sendError(410, "音频文件保留在用户设备，请使用 /local-player 打开本地音乐。");
            return false;
        }
    }

    static class AudioAccess implements HandlerInterceptor {
        private final SekaiSongTrackMapper songs;

        AudioAccess(SekaiSongTrackMapper songs) { this.songs = songs; }

        @Override
        public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
            String path = UriUtils.decode(request.getRequestURI().substring(request.getContextPath().length()), StandardCharsets.UTF_8);
            response.setHeader("Cache-Control", "private, no-store");
            if (path.startsWith("/bilibili/") || path.endsWith("audio-folder-path")) {
                response.sendError(410, "请通过浏览器上传本地音频；在线播放和服务器目录扫描已停用");
                return false;
            }
            var session = request.getSession(false);
            Object current = session == null ? null : session.getAttribute("loginUser");
            if (!(current instanceof User user) || user.getId() == null) {
                response.sendError(401);
                return false;
            }
            if (path.matches("^/uploads/video/commons-[^/%\\\\]+\\.mp4$")) {
                if (songs.countOwnedVideo(user.getId(), path) > 0) return true;
                response.sendError(404);
                return false;
            }
            if (path.startsWith("/uploads/video/")) {
                response.sendError(410);
                return false;
            }
            if (path.matches("^/(?:uploads|external-uploads)/covers/[^/%\\\\]+$")) return true;
            if (!path.matches("^/(?:uploads|external-uploads)/audio/[^/%\\\\]+$")
                    || path.endsWith("/.") || path.endsWith("/..") || songs.countOwnedAudio(user.getId(), path) == 0) {
                response.sendError(404);
                return false;
            }
            return true;
        }
    }
}
