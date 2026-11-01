package com.ykd.claw.agent;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/** One-shot handoff of generated media from tools to CLI/WeChat delivery. */
@Component
public final class GeneratedArtifacts {
    private static final String DEFAULT_SCOPE = "default";
    private final InheritableThreadLocal<String> currentScope = new InheritableThreadLocal<>();
    private final ConcurrentMap<String, String> images = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> videos = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> audios = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> documents = new ConcurrentHashMap<>();

    public void beginScope(String scope) {
        String normalized = normalize(scope);
        clear(normalized);
        currentScope.set(normalized);
    }
    public void endScope() { currentScope.remove(); }

    public void image(String path) { put(images, path); }
    public void video(String path) { put(videos, path); }
    public void audio(String path) { put(audios, path); }
    public void document(String path) { put(documents, path); }

    public String consumeImage() { return consumeImage(DEFAULT_SCOPE); }
    public String consumeVideo() { return consumeVideo(DEFAULT_SCOPE); }
    public String consumeAudio() { return consumeAudio(DEFAULT_SCOPE); }
    public String consumeDocument() { return consumeDocument(DEFAULT_SCOPE); }

    public String consumeImage(String scope) { return images.remove(normalize(scope)); }
    public String consumeVideo(String scope) { return videos.remove(normalize(scope)); }
    public String consumeAudio(String scope) { return audios.remove(normalize(scope)); }
    public String consumeDocument(String scope) { return documents.remove(normalize(scope)); }

    private void put(ConcurrentMap<String, String> target, String path) {
        if (path != null) target.put(scope(), path);
    }

    private void clear(String scope) {
        images.remove(scope);
        videos.remove(scope);
        audios.remove(scope);
        documents.remove(scope);
    }

    private String scope() {
        return normalize(currentScope.get());
    }

    private static String normalize(String scope) {
        return scope == null || scope.isBlank() ? DEFAULT_SCOPE : scope;
    }
}
