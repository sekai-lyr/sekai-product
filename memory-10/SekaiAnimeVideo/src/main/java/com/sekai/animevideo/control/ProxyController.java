package com.sekai.animevideo.control;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Cookie;
import okhttp3.ConnectionPool;
import okhttp3.Headers;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.BufferedSink;
import okio.Okio;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Controller
public class ProxyController {

    private static final String PROXY_PATH = "/proxy/";
    private static final String DIRECT_PATH = "/direct/";
    private static final String HOST_COOKIE = "PXHOST";

    private static final Pattern MEDIA_EXTENSIONS = Pattern.compile(
        "\\.(mp4|webm|mkv|avi|mov|flv|wmv|m4v|3gp|ts|mp3|aac|flac|ogg|wav|m4a|opus)(\\?.*)?$",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern HLS_EXTENSIONS = Pattern.compile(
        "\\.m3u8[^a-z]*$",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DIRECT_DOMAINS = Pattern.compile(
        "^(https?:)?//(i\\d+\\.hdslb\\.com|fonts\\.googleapis\\.com|fonts\\.gstatic\\.com|cdnjs\\.cloudflare\\.com|api\\.dicebear\\.com|cdn\\.bootcdn\\.net|cdn\\.jsdelivr\\.net|unpkg\\.com|code\\.jquery\\.com|cdn\\.bdstatic\\.com|ss1\\.bdstatic\\.com|img\\.aliyun\\.com|s1\\.hdslb\\.com|hm\\.baidu\\.com|dn-kylin\\.qbox\\.io|lazyload\\.qbox\\.io|yunqivedio\\.com|cdn\\.yanghuaji\\.com|static\\.fankuhub\\.com|img\\.fankuhub\\.com|ikun\\.fankuhub\\.com|static\\.kanfantv\\.com|cdn\\.fankuhub\\.com|res\\.fankuhub\\.com|pic\\.kanfantv\\.com|image\\.kanfantv\\.com|img\\.kanfantv\\.com|txmov2\\.a\\d+\\.com|m3u8cdn\\.com|m3u8\\.fankuhub\\.com|fengchedmp\\.com)",
        Pattern.CASE_INSENSITIVE
    );

    private static final long CACHE_TTL = 5 * 60 * 1000L;
    private static final long DIRECT_CACHE_TTL = 2 * 60 * 1000L;
    private static final int CACHE_MAX_SIZE = 500;
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CacheEntry> directCache = new ConcurrentHashMap<>();

    private static final long CACHE_TTL_STATIC = 30 * 60 * 1000L;

    private static class CacheEntry {
        final byte[] data;
        final String contentType;
        final long timestamp;
        final long ttl;
        CacheEntry(byte[] data, String contentType, long ttl) {
            this.data = data; this.contentType = contentType; this.timestamp = System.currentTimeMillis(); this.ttl = ttl;
        }
        CacheEntry(byte[] data, String contentType) {
            this(data, contentType, CACHE_TTL);
        }
        boolean isExpired() { return System.currentTimeMillis() - timestamp > ttl; }
    }
    private static final Pattern ATTR_PATTERN = Pattern.compile(
            "(href|src|action|poster|data-src|data-href|data-original|srcset)=(\"[^\"]*\"|'[^']*')",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern SCRIPT_STYLE_CONTENT_PATTERN = Pattern.compile(
            "(?i)(<script[^>]*>)(.*?)(</script\\s*>)|(<style[^>]*>)(.*?)(</style\\s*>)",
            Pattern.DOTALL
    );

    private static final String INJECT_BODY_JS = """
        <script>
        (function(){
            var PROXY_PREFIX = '/proxy/';
            var SITE_HOST = '__SITE_HOST__';
            function proxyUrl(url) {
                if (!url || typeof url !== 'string') return url;
                if (url.indexOf(PROXY_PREFIX) !== -1) return url;
                if (url.indexOf('blob:') === 0 || url.indexOf('data:') === 0 || url.indexOf('javascript:') === 0) return url;
                if (url.indexOf('://') > 0) return PROXY_PREFIX + url;
                if (url.indexOf('//') === 0) return PROXY_PREFIX + 'https:' + url;
                if (url.indexOf('/') === 0) return PROXY_PREFIX + 'https://' + SITE_HOST + url;
                return PROXY_PREFIX + 'https://' + SITE_HOST + '/' + url;
            }
            (function proxyMediaAndImages() {
                function proxyElSrc(el) {
                    if (el.src && el.src.indexOf(PROXY_PREFIX) !== 0 && el.src.indexOf('blob:') !== 0 && el.src.indexOf('data:') !== 0) {
                        el.src = PROXY_PREFIX + el.src;
                    }
                }
                var allMedia = document.querySelectorAll('video, audio, source, img, iframe');
                for (var i = 0; i < allMedia.length; i++) { proxyElSrc(allMedia[i]); }
                new MutationObserver(function(muts) {
                    for (var i = 0; i < muts.length; i++) {
                        var nodes = muts[i].addedNodes;
                        for (var j = 0; j < nodes.length; j++) {
                            if (nodes[j].querySelectorAll) {
                                var found = nodes[j].querySelectorAll('video[src], audio[src], source[src], img[src], iframe[src]');
                                for (var k = 0; k < found.length; k++) { proxyElSrc(found[k]); }
                            } else if (nodes[j].src && nodes[j].tagName) {
                                proxyElSrc(nodes[j]);
                            }
                        }
                    }
                }).observe(document.documentElement, {childList:true, subtree:true});
            })();
            (function proxyIframeSrc() {
                try {
                    var ifd = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
                    if (ifd && ifd.set) {
                        var oIS = ifd.set;
                        Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
                            set: function(v) {
                                if (typeof v === 'string' && v.indexOf(PROXY_PREFIX) !== 0 && v.indexOf('blob:') !== 0 && v.indexOf('data:') !== 0 && v.indexOf('javascript:') !== 0) v = proxyUrl(v);
                                oIS.call(this, v);
                            },
                            get: ifd.get,
                            configurable: true
                        });
                    }
                } catch(e) {}
            })();
            (function preventEscape() {
                var as = document.querySelectorAll('a[target="_blank"], a[target="blank"]');
                for (var i = 0; i < as.length; i++) { as[i].removeAttribute('target'); }
                window.open = function(url, target, features) {
                    if (url && typeof url === 'string' && url.indexOf('javascript:') !== 0) {
                        window.location.href = proxyUrl(url);
                    }
                    return window;
                };
                try {
                    var origAssign = Location.prototype.assign;
                    if (origAssign) {
                        Location.prototype.assign = function(url) {
                            if (typeof url === 'string' && url.indexOf('blob:') !== 0 && url.indexOf('data:') !== 0) {
                                url = proxyUrl(url);
                            }
                            return origAssign.call(this, url);
                        };
                    }
                } catch(e) {}
                try {
                    var origReplace = Location.prototype.replace;
                    if (origReplace) {
                        Location.prototype.replace = function(url) {
                            if (typeof url === 'string' && url.indexOf('blob:') !== 0 && url.indexOf('data:') !== 0) {
                                url = proxyUrl(url);
                            }
                            return origReplace.call(this, url);
                        };
                    }
                } catch(e) {}
                new MutationObserver(function(muts) {
                    for (var i = 0; i < muts.length; i++) {
                        var nodes = muts[i].addedNodes;
                        for (var j = 0; j < nodes.length; j++) {
                            if (nodes[j].querySelectorAll) {
                                var links = nodes[j].querySelectorAll('a[target="_blank"], a[target="blank"]');
                                for (var k = 0; k < links.length; k++) { links[k].removeAttribute('target'); }
                            }
                        }
                    }
                }).observe(document.documentElement, {childList:true, subtree:true});
                document.addEventListener('click', function(e) {
                    var el = e.target;
                    while (el && el !== document.documentElement) {
                        if (el.tagName === 'A' && (el.target === '_blank' || el.target === 'blank')) {
                            e.preventDefault();
                            if (el.href) { window.location.href = proxyUrl(el.href); }
                            return;
                        }
                        el = el.parentElement;
                    }
                }, true);
            })();        })();
        </script>
        """;

    private static final String MINIMAL_INJECT_JS = """
        <script>
        (function(){
            var SITE_HOST = '__SITE_HOST__';
            function preventTarget(el) {
                if (el.target === '_blank' || el.target === 'blank') {
                    el.removeAttribute('target');
                }
            }
            document.addEventListener('click', function(e) {
                var el = e.target;
                while (el && el !== document.documentElement) {
                    if ((el.tagName === 'A' || el.tagName === 'AREA') && (el.target === '_blank' || el.target === 'blank')) {
                        e.preventDefault();
                        if (el.href) { window.location.href = el.href; }
                        return;
                    }
                    el = el.parentElement;
                }
            }, true);
            document.addEventListener('submit', function(e) {
                var el = e.target;
                while (el && el !== document.documentElement) {
                    if (el.tagName === 'FORM' && (el.target === '_blank' || el.target === 'blank')) {
                        e.preventDefault();
                        el.removeAttribute('target');
                        HTMLFormElement.prototype.submit.call(el);
                        return;
                    }
                    el = el.parentElement;
                }
            }, true);
            var q = document.querySelectorAll('a[target="_blank"], a[target="blank"], area[target="_blank"], area[target="blank"], form[target="_blank"], form[target="blank"]');
            for (var i = 0; i < q.length; i++) { q[i].removeAttribute('target'); }
            window.open = function(url, target, features) {
                if (url && typeof url === 'string' && url.indexOf('javascript:') !== 0) {
                    window.location.href = url;
                }
                return window;
            };
            new MutationObserver(function(muts) {
                for (var i = 0; i < muts.length; i++) {
                    var nodes = muts[i].addedNodes;
                    for (var j = 0; j < nodes.length; j++) {
                        if (nodes[j].querySelectorAll) {
                            var el = nodes[j].querySelectorAll('a[target="_blank"], a[target="blank"], area[target="_blank"], area[target="blank"], form[target="_blank"], form[target="blank"]');
                            for (var k = 0; k < el.length; k++) { el[k].removeAttribute('target'); }
                        } else if (nodes[j].tagName && (nodes[j].target === '_blank' || nodes[j].target === 'blank')) {
                            nodes[j].removeAttribute('target');
                        }
                    }
                }
            }).observe(document.documentElement, {childList:true, subtree:true});
        })();
        </script>
        """;

    // ========================================================================
    // 1x1 transparent GIF placeholder - returned when upstream times out
    // ========================================================================
    private static final byte[] PLACEHOLDER_GIF = Base64.getDecoder().decode(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    );

    // ========================================================================
    // Cookie persistence store:  host -> (cookieName -> cookieValue)
    // Stores Set-Cookie values from upstream so subsequent requests carry them
    // automatically, bypassing FluxGate browser-validation challenges.
    // ========================================================================
    private final ConcurrentHashMap<String, ConcurrentHashMap<String, String>> upstreamCookies = new ConcurrentHashMap<>();

    // ========================================================================
    // OkHttp client configuration
    //
    // httpClient       - 6 s connect/read/write timeout for images, HTML, API
    // streamingClient  - long timeout (no read limit) for video/audio streams
    //
    // OkHttp advantages over java.net.http.HttpClient for this use case:
    //   - Separate connect / read / write timeouts
    //   - Built-in connection pooling with keep-alive
    //   - Okio zero-copy streaming (efficient binary transfer)
    //   - Transparent gzip handling (we use identity to keep Content-Length accurate)
    // ========================================================================
    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(6, TimeUnit.SECONDS)
            .readTimeout(6, TimeUnit.SECONDS)
            .writeTimeout(6, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .connectionPool(new ConnectionPool(16, 5, TimeUnit.MINUTES))
            .build();

    private final OkHttpClient streamingClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)   // no read cap - stream can be long
            .writeTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .connectionPool(new ConnectionPool(8, 5, TimeUnit.MINUTES))
            .build();

    // ========================================================================
    // Chrome request headers template - sent with every upstream request
    // to mimic a real browser and pass FluxGate WAF validation.
    // ========================================================================
    private static final String CHROME_USER_AGENT =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        + "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    private static final String CHROME_SEC_CH_UA =
        "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"";

    // ========================================================================
    // Main proxy endpoint
    // ========================================================================
    @RequestMapping({"/proxy/**", "/_nuxt/**", "/_next/**", "/direct/**"})
    public void proxy(HttpServletRequest request, HttpServletResponse response) {
        String fullPath = request.getRequestURI();
        boolean directMode = fullPath.startsWith(DIRECT_PATH);
        String target;

        String siteHost = null;
        String refererHost = getCookie(request, HOST_COOKIE);
        if (directMode) {
            target = fullPath.substring(DIRECT_PATH.length());
            siteHost = extractBase(target);
        } else if (!fullPath.startsWith(PROXY_PATH)) {
            siteHost = getCookie(request, HOST_COOKIE);
            if (siteHost == null) {
                String referer = request.getHeader("Referer");
                if (referer != null) {
                    int pi = referer.indexOf("/proxy/");
                    if (pi >= 0) {
                        try { siteHost = URI.create(referer.substring(pi + 7)).getHost(); }
                        catch (Exception ignored) {}
                    }
                }
                if (siteHost == null) siteHost = "www.fankuhub.com";
                refererHost = siteHost;
            }
            target = "https://" + siteHost + fullPath;
        } else {
            target = fullPath.substring(PROXY_PATH.length());
            siteHost = extractBase(target);
            if (refererHost == null) refererHost = siteHost;
        }

        if (target.isEmpty()) {
            response.setStatus(400);
            return;
        }

        String query = request.getQueryString();
        if (query != null && !query.isEmpty()) {
            target += "?" + query;
        }

        try {
            // Build cookie header: persisted upstream cookies + browser cookies
            String clientCookie = request.getHeader("Cookie");
            String mergedCookie = buildCookieHeader(target, clientCookie);

            // ---- Full Chrome request headers ----
            Headers.Builder hb = new Headers.Builder();
            hb.add("User-Agent", CHROME_USER_AGENT);
            hb.add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,"
                + "image/avif,image/webp,image/apng,*/*;q=0.8,"
                + "application/signed-exchange;v=b3;q=0.7");
            hb.add("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6");
            hb.add("Accept-Encoding", "identity");
            hb.add("Sec-Ch-Ua", CHROME_SEC_CH_UA);
            hb.add("Sec-Ch-Ua-Mobile", "?0");
            hb.add("Sec-Ch-Ua-Platform", "\"Windows\"");
            hb.add("Sec-Fetch-Dest", "document");
            hb.add("Sec-Fetch-Mode", "navigate");
            hb.add("Sec-Fetch-Site", "none");
            hb.add("Sec-Fetch-User", "?1");
            hb.add("Upgrade-Insecure-Requests", "1");
            hb.add("DNT", "1");
            String targetOrigin = extractOrigin(target);
            hb.add("Referer", targetOrigin + "/");
            hb.add("Origin", targetOrigin);
            if (mergedCookie != null && !mergedCookie.isEmpty()) {
                hb.add("Cookie", mergedCookie);
            }

            String method = request.getMethod().toUpperCase();

            // Forward Range / If-Range for streaming support
            String range = request.getHeader("Range");
            boolean hasRange = range != null && !range.isEmpty();
            if (hasRange) {
                hb.add("Range", range);
            }
            String ifRange = request.getHeader("If-Range");
            if (ifRange != null && !ifRange.isEmpty()) {
                hb.add("If-Range", ifRange);
            }

            // ---- Serve from cache for non-Range GETs ----
            if ("GET".equals(method) && !hasRange) {
                CacheEntry cached = cache.get(target);
                if (cached != null && !cached.isExpired()) {
                    response.setContentType(cached.contentType);
                    response.setContentLength(cached.data.length);
                    response.setHeader("Cache-Control", "public, max-age=300");
                    response.getOutputStream().write(cached.data);
                    return;
                }
            }

            // ---- Build OkHttp Request ----
            Request.Builder reqBuilder = new Request.Builder()
                    .url(target)
                    .headers(hb.build());

            RequestBody reqBody = null;
            if ("POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method) || "DELETE".equals(method)) {
                byte[] bodyBytes = request.getInputStream().readAllBytes();
                MediaType mediaType = request.getContentType() != null
                        ? MediaType.parse(request.getContentType()) : null;
                reqBody = RequestBody.create(mediaType, bodyBytes);
            }
            reqBuilder.method(method, reqBody);

            // Select client: streaming for video/audio, regular for everything else
            boolean isMedia = MEDIA_EXTENSIONS.matcher(target).find()
                    || HLS_EXTENSIONS.matcher(target).find();
            OkHttpClient client = isMedia ? streamingClient : httpClient;

            // ---- Execute request ----
            try (Response proxyRes = client.newCall(reqBuilder.build()).execute()) {

                // Persist upstream cookies for subsequent requests
                storeCookiesFromResponse(target, proxyRes.headers());

                String contentType = proxyRes.header("Content-Type", "");
                int statusCode = proxyRes.code();

                // Final URL after redirects
                String effectiveTarget = proxyRes.request().url().toString();

                // Forward upstream status
                response.setStatus(statusCode);

                // Set host tracking cookie
                if (siteHost != null && !siteHost.isEmpty()) {
                    String cookieHost = getCookie(request, HOST_COOKIE);
                    if (cookieHost == null || refererHost == null || refererHost.equals(siteHost)) {
                        Cookie hc = new Cookie(HOST_COOKIE, siteHost);
                        hc.setPath("/");
                        hc.setMaxAge(3600);
                        hc.setHttpOnly(true);
                        response.addCookie(hc);
                    }
                }

                // Forward Set-Cookie headers from upstream
                proxyRes.headers("Set-Cookie").forEach(c -> response.addHeader("Set-Cookie", c));

                // CORS headers
                response.setHeader("Access-Control-Allow-Origin", "*");
                response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                response.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization");

                // Strip frame-blocking CSP and security headers
                String csp = proxyRes.header("Content-Security-Policy");
                if (csp != null) {
                    String cleanCsp = csp.replaceAll("(?i)frame-ancestors\\s+[^;]+;?", "").trim();
                    if (!cleanCsp.isEmpty()) {
                        response.setHeader("Content-Security-Policy", cleanCsp);
                    }
                }
                if (proxyRes.header("Referrer-Policy") != null) {
                    response.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
                }

                // Forward streaming headers
                String contentRange = proxyRes.header("Content-Range");
                if (contentRange != null) response.setHeader("Content-Range", contentRange);
                String acceptRanges = proxyRes.header("Accept-Ranges");
                if (acceptRanges != null) response.setHeader("Accept-Ranges", acceptRanges);
                else if (isMedia) response.setHeader("Accept-Ranges", "bytes");
                String contentLength = proxyRes.header("Content-Length");
                if (contentLength != null) response.setHeader("Content-Length", contentLength);

                // ---- HLS playlists: rewrite as text BEFORE binary check ----
                boolean isHlsByType = contentType.toLowerCase().contains("mpegurl");
                boolean isHlsByUrl = HLS_EXTENSIONS.matcher(effectiveTarget).find();
                if (isHlsByType || isHlsByUrl) {
                    ResponseBody body = proxyRes.body();
                    if (body != null) {
                        String m3u8 = body.string();
                        String baseHost = extractBase(effectiveTarget);
                        String rewritten = rewriteHlsPlaylist(m3u8, effectiveTarget, baseHost);
                        response.setContentType(contentType.isEmpty() ? "application/vnd.apple.mpegurl" : contentType);
                        response.getWriter().write(rewritten);
                    }
                    return;
                }

                // ---- Video/Audio: stream directly via Okio (zero-copy) ----
                if (contentType.startsWith("video/") || contentType.startsWith("audio/") ||
                    (contentType.contains("octet-stream") && MEDIA_EXTENSIONS.matcher(effectiveTarget).find())) {
                    response.setContentType(contentType);
                    if (acceptRanges == null) response.setHeader("Accept-Ranges", "bytes");
                    ResponseBody body = proxyRes.body();
                    if (body != null) {
                        OutputStream os = response.getOutputStream();
                        BufferedSink sink = Okio.buffer(Okio.sink(os));
                        sink.writeAll(body.source());
                        sink.flush();
                    }
                    return;
                }

                boolean isError = statusCode >= 400;

                // ---- HTML: full rewrite with URL proxying + JS injection ----
                if (contentType.contains("text/html")) {
                    ResponseBody body = proxyRes.body();
                    if (body == null) { return; }
                    if (isError) {
                        byte[] errData = body.bytes();
                        response.setContentType(contentType);
                        response.setContentLength(errData.length);
                        response.getOutputStream().write(errData);
                        return;
                    }
                    byte[] rawHtml = body.bytes();
                    String charsetName = extractCharset(contentType);
                    boolean metaOverride = !contentType.toLowerCase().contains("charset=") || charsetName.equalsIgnoreCase("utf-8");
                    if (metaOverride) {
                        String metaCharset = detectCharsetFromMeta(rawHtml);
                        if (metaCharset != null) charsetName = metaCharset;
                    }
                    Charset charset;
                    try { charset = Charset.forName(charsetName); } catch (Exception e) { charset = StandardCharsets.UTF_8; }
                    String html = new String(rawHtml, charset);
                    if (html.indexOf('\uFFFD') > 0) {
                        String[] fallbacks = charset.name().equalsIgnoreCase("UTF-8")
                            ? new String[]{"GBK", "GB2312", "GB18030", "Big5", "EUC-JP", "Shift_JIS", "ISO-8859-1", "windows-1252"}
                            : new String[]{"UTF-8", "GBK", "GB2312", "GB18030", "Big5", "EUC-JP", "Shift_JIS", "ISO-8859-1", "windows-1252"};
                        for (String fb : fallbacks) {
                            if (fb.equalsIgnoreCase(charset.name())) continue;
                            try {
                                Charset fbCharset = Charset.forName(fb);
                                String test = new String(rawHtml, fbCharset);
                                if (test.indexOf('\uFFFD') < 0) {
                                    charset = fbCharset;
                                    html = test;
                                    break;
                                }
                            } catch (Exception ignored) {}
                        }
                    }

                    siteHost = extractBase(effectiveTarget);
                    if (siteHost == null) siteHost = "www.fankuhub.com";

                    if (directMode) {
                        CacheEntry cached = directCache.get(target);
                        if (cached != null && !cached.isExpired()) {
                            response.setContentType("text/html;charset=UTF-8");
                            response.setCharacterEncoding("UTF-8");
                            response.getOutputStream().write(cached.data);
                            return;
                        }
                        String minimalJs = MINIMAL_INJECT_JS.replace("__SITE_HOST__", siteHost);
                        int bodyEnd = html.lastIndexOf("</body>");
                        if (bodyEnd > 0) {
                            html = html.substring(0, bodyEnd) + minimalJs + html.substring(bodyEnd);
                        }
                        html = rewriteDirectHtml(html, effectiveTarget, siteHost);
                        if ("GET".equals(method) && directCache.size() < CACHE_MAX_SIZE) {
                            directCache.put(target, new CacheEntry(html.getBytes(StandardCharsets.UTF_8), "text/html;charset=UTF-8", DIRECT_CACHE_TTL));
                        }
                    } else {
                        String bodyJs = INJECT_BODY_JS.replace("__SITE_HOST__", siteHost);

                        int headStartTag = html.indexOf("<head");
                        int headTagClose = html.indexOf(">", headStartTag);
                        if (headStartTag >= 0 && headTagClose > headStartTag) {
                            String siteHostForJs = siteHost != null ? siteHost : "www.fankuhub.com";
                            String criticalJs = "<script>(function(){try{Object.defineProperty(window,'top',{get:function(){return window;},configurable:false});}catch(e){}try{Object.defineProperty(window,'parent',{get:function(){return window;},configurable:false});}catch(e){}var _si=window.setInterval;window.setInterval=function(fn,d){var s=String(fn);if(s.indexOf('top')>-1&&(s.indexOf('location')>-1||s.indexOf('self')>-1))return 0;return _si.call(window,fn,d);};var _st=window.setTimeout;window.setTimeout=function(fn,d){var s=String(fn);if(s.indexOf('top')>-1&&(s.indexOf('location')>-1||s.indexOf('self')>-1))return 0;return _st.call(window,fn,d);};})();</script>"
                                + "<script>(function(){var P='/proxy/',H='__SITE_HOST__';function p(u){if(!u||typeof u!=='string')return u;if(u.indexOf(P)!==-1)return u;if(u.indexOf('blob:')===0||u.indexOf('data:')===0||u.indexOf('javascript:')===0)return u;if(u.indexOf('://')>0)return P+u;if(u.indexOf('//')===0)return P+'https:'+u;if(u.indexOf('/')===0)return P+'https://'+H+u;return P+'https://'+H+'/'+u;}var oF=window.fetch;window.fetch=function(i,n){if(typeof i==='string'){if(i.indexOf('blob:')===0||i.indexOf('data:')===0)return oF.call(window,i,n);i=p(i);}else if(i&&i.url&&typeof i.url==='string'){if(i.url.indexOf('blob:')===0||i.url.indexOf('data:')===0)return oF.call(window,i,n);var nu=p(i.url);if(nu!==i.url){try{i=new Request(nu,i);}catch(e){}}}return oF.call(window,i,n);};var X=window.XMLHttpRequest,oO=X.prototype.open;X.prototype.open=function(m,u,a,us,pa){if(typeof u==='string'&&(u.indexOf('blob:')===0||u.indexOf('data:')===0))return oO.call(this,m,u,a,us,pa);u=typeof u==='string'?p(u):u;return oO.call(this,m,u,a,us,pa);};var md=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');if(md&&md.set){var oS=md.set;Object.defineProperty(HTMLMediaElement.prototype,'src',{set:function(v){if(typeof v==='string'&&v.indexOf(P)!==0&&v.indexOf('blob:')!==0&&v.indexOf('data:')!==0)v=p(v);oS.call(this,v);},get:md.get,configurable:true});}var id=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');if(id&&id.set){var oI=id.set;Object.defineProperty(HTMLImageElement.prototype,'src',{set:function(v){if(typeof v==='string'&&v.indexOf(P)!==0&&v.indexOf('blob:')!==0&&v.indexOf('data:')!==0)v=p(v);oI.call(this,v);},get:id.get,configurable:true});}var sd=Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype,'src');if(sd&&sd.set){var oSS=sd.set;Object.defineProperty(HTMLSourceElement.prototype,'src',{set:function(v){if(typeof v==='string'&&v.indexOf(P)!==0&&v.indexOf('blob:')!==0&&v.indexOf('data:')!==0)v=p(v);oSS.call(this,v);},get:sd.get,configurable:true});})();</script>";
                            html = html.substring(0, headTagClose + 1) + criticalJs + html.substring(headTagClose + 1);
                        }
                        int bodyEnd = html.lastIndexOf("</body>");
                        if (bodyEnd > 0) {
                            html = html.substring(0, bodyEnd) + bodyJs + html.substring(bodyEnd);
                        }
                        html = html.replaceAll("(?i)<meta\\s+http-equiv\\s*=\\s*[\"']?Content-Security-Policy[\"']?[^>]*>", "");
                        html = html.replaceAll("\\s+integrity\\s*=\\s*\"[^\"]*\"", "");
                        html = rewriteUrls(html, effectiveTarget, charset);

                        // Replace external resource site banners with FankuHub
                        html = rewriteResourceSites(html);

                        String baseHrefUrl = effectiveTarget;
                        int baseLastSlash = effectiveTarget.lastIndexOf('/');
                        if (baseLastSlash > effectiveTarget.indexOf("://") + 2) {
                            baseHrefUrl = effectiveTarget.substring(0, baseLastSlash + 1);
                        } else {
                            baseHrefUrl = effectiveTarget + "/";
                        }
                        String baseTag = "<base href=\"" + PROXY_PATH + baseHrefUrl + "\">";
                        int headTagEnd = html.indexOf(">", html.indexOf("<head"));
                        if (headTagEnd > 0) {
                            html = html.substring(0, headTagEnd + 1) + baseTag + html.substring(headTagEnd + 1);
                        }
                    }

                    response.setContentType("text/html;charset=UTF-8");
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write(html);

                } else if (contentType.contains("text/css")) {
                    ResponseBody body = proxyRes.body();
                    if (body == null) { return; }
                    String css = body.string();
                    css = rewriteCssUrls(css, effectiveTarget, extractBase(effectiveTarget));
                    response.setContentType(contentType);
                    response.getWriter().write(css);

                } else if (contentType.contains("text/") || contentType.contains("javascript") || contentType.contains("json")) {
                    ResponseBody body = proxyRes.body();
                    if (body == null) { return; }
                    byte[] data = body.bytes();
                    if ("GET".equals(method) && cache.size() < CACHE_MAX_SIZE) {
                        cache.put(target, new CacheEntry(data, contentType));
                    }
                    response.setContentType(contentType);
                    response.setContentLength(data.length);
                    response.getOutputStream().write(data);

                } else {
                    // Binary (images, fonts, etc.) - buffer + cache
                    ResponseBody body = proxyRes.body();
                    if (body == null) { return; }
                    byte[] data = body.bytes();
                    // Detect undetected HLS playlist by body signature
                    if (data.length > 7) {
                        String bodyStart = new String(data, 0, Math.min(data.length, 10), StandardCharsets.US_ASCII);
                        if (bodyStart.startsWith("#EXTM3U")) {
                            String baseHost = extractBase(effectiveTarget);
                            String rewritten = rewriteHlsPlaylist(new String(data, StandardCharsets.UTF_8), effectiveTarget, baseHost);
                            response.setContentType("application/vnd.apple.mpegurl");
                            response.getWriter().write(rewritten);
                            return;
                        }
                    }
                    response.setContentType(contentType);
                    if ("GET".equals(method) && data.length < 2_000_000 && cache.size() < CACHE_MAX_SIZE) {
                        cache.put(target, new CacheEntry(data, contentType, CACHE_TTL_STATIC));
                    }
                    response.setContentLength(data.length);
                    response.getOutputStream().write(data);
                }
            } // end try-with-resources(Response)

        } catch (java.net.SocketTimeoutException e) {
            // ---- 6-second timeout: return placeholder instead of blocking Tomcat thread ----
            System.err.println("[Proxy TIMEOUT] " + target);
            if (!response.isCommitted()) {
                boolean imageRequest = MEDIA_EXTENSIONS.matcher(target).find()
                        || (request.getHeader("Accept") != null && request.getHeader("Accept").contains("image"));
                if (imageRequest) {
                    response.setStatus(504);
                    response.setContentType("image/gif");
                    response.setContentLength(PLACEHOLDER_GIF.length);
                    try { response.getOutputStream().write(PLACEHOLDER_GIF); } catch (Exception ignored) {}
                } else {
                    response.setStatus(504);
                    response.setContentType("text/plain;charset=UTF-8");
                    try { response.getWriter().write("Gateway Timeout"); } catch (Exception ignored) {}
                }
            }

        } catch (Exception e) {
            // ---- ClientAbortException / AsyncRequestNotUsableException: silent ----
            // These occur when the browser disconnects before the server finishes writing.
            // No need to log or return an error - just bail out quietly.
            if (isClientAbortException(e)) {
                return;
            }

            System.err.println("[Proxy ERROR] " + target + " - " + e.getClass().getSimpleName() + ": " + e.getMessage());
            e.printStackTrace(System.err);
            if (!response.isCommitted()) {
                try {
                    response.setStatus(502);
                    response.setContentType("text/plain;charset=UTF-8");
                    response.getWriter().write("Proxy error: " + e.getMessage());
                } catch (Exception ignored2) {}
            }
        }
    }

    // ========================================================================
    // Cookie persistence helpers
    // ========================================================================

    /**
     * Parse Set-Cookie headers from upstream and store them in the
     * ConcurrentHashMap so future requests to the same host (or subdomains)
     * automatically carry these cookies.
     */
    private void storeCookiesFromResponse(String targetUrl, Headers responseHeaders) {
        String host = extractHost(targetUrl);
        if (host == null) return;

        List<String> setCookies = responseHeaders.values("Set-Cookie");
        if (setCookies.isEmpty()) return;

        ConcurrentHashMap<String, String> hostCookies =
                upstreamCookies.computeIfAbsent(host, k -> new ConcurrentHashMap<>());

        for (String sc : setCookies) {
            String[] parts = sc.split(";", 2);
            String nameValue = parts[0].trim();
            int eq = nameValue.indexOf('=');
            if (eq <= 0) continue;

            String name = nameValue.substring(0, eq).trim();
            String value = nameValue.substring(eq + 1).trim();

            // Check Max-Age=0 or Expires in the past -> remove cookie
            boolean expired = false;
            if (parts.length > 1) {
                String attrs = parts[1].toLowerCase();
                if (attrs.contains("max-age=0")) expired = true;
            }

            if (expired) {
                hostCookies.remove(name);
            } else {
                hostCookies.put(name, value);
            }
        }
    }

    /**
     * Build the Cookie header value by merging persisted upstream cookies
     * with the browser's cookies. Browser cookies take precedence.
     */
    private String buildCookieHeader(String targetUrl, String clientCookie) {
        String host = extractHost(targetUrl);

        LinkedHashMap<String, String> merged = new LinkedHashMap<>();

        // 1. Persisted upstream cookies (exact match + parent domain match)
        if (host != null) {
            for (Map.Entry<String, ConcurrentHashMap<String, String>> entry : upstreamCookies.entrySet()) {
                String storedHost = entry.getKey();
                if (host.equals(storedHost) || host.endsWith("." + storedHost)) {
                    merged.putAll(entry.getValue());
                }
            }
        }

        // 2. Browser cookies override stored values
        if (clientCookie != null && !clientCookie.isEmpty()) {
            for (String pair : clientCookie.split(";")) {
                String trimmed = pair.trim();
                int eq = trimmed.indexOf('=');
                if (eq > 0) {
                    merged.put(trimmed.substring(0, eq).trim(), trimmed.substring(eq + 1).trim());
                }
            }
        }

        if (merged.isEmpty()) return null;
        StringBuilder sb = new StringBuilder();
        merged.forEach((k, v) -> {
            if (sb.length() > 0) sb.append("; ");
            sb.append(k).append("=").append(v);
        });
        return sb.toString();
    }

    /**
     * Extract just the hostname (no port, no scheme) from a URL string.
     */
    private String extractHost(String url) {
        try {
            URI uri = URI.create(url);
            return uri.getHost();
        } catch (Exception e) {
            return null;
        }
    }

    // ========================================================================
    // ClientAbortException detection (checks both direct type and cause chain)
    // ========================================================================
    private static boolean isClientAbortException(Throwable t) {
        for (Throwable ex = t; ex != null; ex = ex.getCause()) {
            String name = ex.getClass().getSimpleName();
            if (name.contains("Abort") || name.contains("NotUsable")
                    || name.contains("BrokenPipe") || name.contains("Reset")) {
                return true;
            }
            // Match by full class name for jakarta.servlet & org.apache.catalina types
            String fullName = ex.getClass().getName();
            if (fullName.contains("ClientAbortException")
                    || fullName.contains("AsyncRequestNotUsableException")) {
                return true;
            }
        }
        return false;
    }

    // ========================================================================
    // Existing helper methods (unchanged)
    // ========================================================================

    private String extractCharset(String contentType) {
        Pattern p = Pattern.compile("charset\\s*=\\s*([^;\\s]+)", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(contentType);
        return m.find() ? m.group(1).trim() : "UTF-8";
    }

    private String getCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (name.equals(c.getName())) return c.getValue();
            }
        }
        return null;
    }

    private String detectCharsetFromMeta(byte[] htmlBytes) {
        String head = new String(htmlBytes, 0, Math.min(htmlBytes.length, 8192), StandardCharsets.ISO_8859_1);
        Pattern metaCharset = Pattern.compile(
            "<meta[^>]+charset\\s*=\\s*['\"]?([a-zA-Z0-9\\-_]+)['\"]?",
            Pattern.CASE_INSENSITIVE
        );
        Matcher m = metaCharset.matcher(head);
        if (m.find()) {
            return m.group(1).trim();
        }
        Pattern metaHttpEquiv = Pattern.compile(
            "<meta[^>]+http-equiv\\s*=\\s*['\"]?content-type['\"]?[^>]+content\\s*=\\s*['\"][^'\"]*charset=([a-zA-Z0-9\\-_]+)",
            Pattern.CASE_INSENSITIVE
        );
        m = metaHttpEquiv.matcher(head);
        if (m.find()) {
            return m.group(1).trim();
        }
        return null;
    }

    private static final Pattern NAV_ATTR = Pattern.compile(
        "(?i)(href|action)=(\"[^\"]*\"|'[^']*')"
    );
    private static final Pattern RES_ATTR = Pattern.compile(
        "(?i)(src|poster|data-src|data-href|data-original|srcset)=(\"[^\"]*\"|'[^']*')"
    );

    private String rewriteDirectHtml(String html, String baseUrl, String baseHost) {
        if (baseHost == null) return html;
        // 1. Navigation: <a href>, <form action> → go through /direct/ for popup protection
        StringBuffer sb = new StringBuffer();
        Matcher m = NAV_ATTR.matcher(html);
        while (m.find()) {
            String attr = m.group(1);
            String val = m.group(2);
            String url = val.substring(1, val.length() - 1);
            String rewritten = rewriteNavUrl(url, baseUrl, baseHost);
            if (rewritten != null) {
                m.appendReplacement(sb, Matcher.quoteReplacement(attr + "=\"" + rewritten + "\""));
            }
        }
        m.appendTail(sb);
        html = sb.toString();
        // 2. Resources: <script src>, <img src>, <link href>, <video poster> → load from original site directly
        StringBuffer sb2 = new StringBuffer();
        Matcher m2 = RES_ATTR.matcher(html);
        while (m2.find()) {
            String attr = m2.group(1);
            String val = m2.group(2);
            String url = val.substring(1, val.length() - 1);
            String rewritten = rewriteResUrl(url, baseUrl, baseHost);
            if (rewritten != null) {
                m2.appendReplacement(sb2, Matcher.quoteReplacement(attr + "=\"" + rewritten + "\""));
            }
        }
        m2.appendTail(sb2);
        // 3. Also rewrite <link href> for stylesheets (resource, not navigation)
        return rewriteLinkHrefToDirect(sb2.toString(), baseUrl, baseHost);
    }

    private String rewriteNavUrl(String url, String baseUrl, String baseHost) {
        String abs = resolveUrl(url, baseUrl, baseHost);
        if (abs == null) return null;
        return DIRECT_PATH + abs;
    }

    private String rewriteResUrl(String url, String baseUrl, String baseHost) {
        return resolveUrl(url, baseUrl, baseHost);
    }

    private String rewriteLinkHrefToDirect(String html, String baseUrl, String baseHost) {
        StringBuffer sb = new StringBuffer();
        Matcher m = Pattern.compile("(?i)<link\\s[^>]*?href=\"([^\"]+)\"[^>]*>").matcher(html);
        while (m.find()) {
            String oldHref = m.group(1);
            String resolved = resolveUrl(oldHref, baseUrl, baseHost);
            if (resolved != null && !resolved.isEmpty()) {
                m.appendReplacement(sb, Matcher.quoteReplacement(m.group(0).replace("href=\"" + oldHref + "\"", "href=\"" + resolved + "\"")));
            }
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String resolveUrl(String url, String baseUrl, String baseHost) {
        if (url.isEmpty() || url.startsWith("#") || url.startsWith("javascript:") || url.startsWith("data:") || url.startsWith("mailto:")) {
            return null;
        }
        String trimmed = url.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        if (trimmed.startsWith("//")) {
            return "https:" + trimmed;
        }
        try {
            if (trimmed.startsWith("/")) {
                URI base = URI.create(baseUrl);
                return base.getScheme() + "://" + base.getAuthority() + trimmed;
            } else {
                String baseDir = baseUrl;
                int lastSlash = baseUrl.lastIndexOf('/');
                if (lastSlash > baseUrl.indexOf("://") + 2) {
                    baseDir = baseUrl.substring(0, lastSlash + 1);
                }
                // Handle relative paths like "path/to/file.js" or "../file.js"
                try {
                    URI base = new URI(baseDir);
                    URI resolved = base.resolve(trimmed);
                    return resolved.toString();
                } catch (Exception e) {
                    return baseDir + trimmed;
                }
            }
        } catch (Exception e) {
            return null;
        }
    }

    private String rewriteUrls(String html, String baseUrl, Charset charset) {
        String baseHost = extractBase(baseUrl);
        if (baseHost == null) return html;

        List<String> innerBlocks = new ArrayList<>();
        StringBuffer sb = new StringBuffer();
        Matcher sm = SCRIPT_STYLE_CONTENT_PATTERN.matcher(html);
        while (sm.find()) {
            String tagOpen = sm.group(1) != null ? sm.group(1) : sm.group(4);
            String inner = sm.group(2) != null ? sm.group(2) : sm.group(5);
            String tagClose = sm.group(3) != null ? sm.group(3) : sm.group(6);
            innerBlocks.add(inner);
            sm.appendReplacement(sb, Matcher.quoteReplacement(tagOpen + "<<<BLOCK" + (innerBlocks.size() - 1) + ">>>" + tagClose));
        }
        sm.appendTail(sb);
        String body = sb.toString();

        body = rewriteAttrUrls(body, baseUrl, baseHost);
        body = rewriteCssUrls(body, baseUrl, baseHost);

        for (int i = 0; i < innerBlocks.size(); i++) {
            body = body.replace("<<<BLOCK" + i + ">>>", innerBlocks.get(i));
        }
        return body;
    }

    private String rewriteAttrUrls(String html, String baseUrl, String baseHost) {
        StringBuffer sb = new StringBuffer();
        Matcher m = ATTR_PATTERN.matcher(html);
        while (m.find()) {
            String attr = m.group(1);
            String val = m.group(2);
            String url = val.substring(1, val.length() - 1);
            String rewritten = rewriteSingleUrl(url, baseUrl, baseHost);
            if (rewritten != null) {
                m.appendReplacement(sb, Matcher.quoteReplacement(attr + "=\"" + rewritten + "\""));
            }
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String rewriteCssUrls(String html, String baseUrl, String baseHost) {
        StringBuffer sb = new StringBuffer();
        Pattern p = Pattern.compile("url\\(['\"]?([^)'\"]+)['\"]?\\)", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(html);
        while (m.find()) {
            String url = m.group(1);
            if (url.startsWith("data:") || url.startsWith("#")) continue;
            String rewritten = rewriteSingleUrl(url, baseUrl, baseHost);
            if (rewritten != null) {
                m.appendReplacement(sb, Matcher.quoteReplacement("url(" + rewritten + ")"));
            }
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String rewriteSingleUrl(String url, String baseUrl, String baseHost) {
        if (url.isEmpty() || url.startsWith("#") || url.startsWith("javascript:") || url.startsWith("data:") || url.startsWith("mailto:")) {
            return null;
        }
        String trimmed = url.trim();
        if (DIRECT_DOMAINS.matcher(trimmed).find()) {
            return null;
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return PROXY_PATH + trimmed;
        }
        if (trimmed.startsWith("//")) {
            return PROXY_PATH + "https:" + trimmed;
        }
        try {
            String resolved;
            if (trimmed.startsWith("/")) {
                URI base = URI.create(baseUrl);
                resolved = base.getScheme() + "://" + base.getAuthority() + trimmed;
            } else {
                String baseDir = baseUrl;
                int lastSlash = baseUrl.lastIndexOf('/');
                if (lastSlash > baseUrl.indexOf("://") + 2) {
                    baseDir = baseUrl.substring(0, lastSlash + 1);
                } else {
                    baseDir = baseUrl + "/";
                }
                URI base = URI.create(baseDir);
                resolved = base.resolve(trimmed).toString();
            }
            return PROXY_PATH + resolved;
        } catch (Exception e) {
            return PROXY_PATH + "https://" + baseHost + "/" + trimmed;
        }
    }

    private String rewriteHlsPlaylist(String m3u8, String effectiveTarget, String baseHost) {
        StringBuilder sb = new StringBuilder();
        for (String line : m3u8.split("\n")) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty() && !trimmed.startsWith("#") && !trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("//")) {
                String resolved;
                if (trimmed.startsWith("/")) {
                    resolved = PROXY_PATH + "https://" + baseHost + trimmed;
                } else {
                    try {
                        String baseDir = effectiveTarget;
                        int hlsSlash = effectiveTarget.lastIndexOf('/');
                        if (hlsSlash > effectiveTarget.indexOf("://") + 2) {
                            baseDir = effectiveTarget.substring(0, hlsSlash + 1);
                        } else {
                            baseDir = effectiveTarget + "/";
                        }
                        resolved = PROXY_PATH + URI.create(baseDir).resolve(trimmed).toString();
                    } catch (Exception e) {
                        resolved = PROXY_PATH + "https://" + baseHost + "/" + trimmed;
                    }
                }
                sb.append(resolved).append("\n");
            } else if (!trimmed.isEmpty() && (trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
                sb.append(PROXY_PATH).append(trimmed).append("\n");
            } else if (!trimmed.isEmpty() && trimmed.startsWith("//")) {
                sb.append(PROXY_PATH).append("https:").append(trimmed).append("\n");
            } else if (trimmed.startsWith("#EXT-X-KEY:") || trimmed.startsWith("#EXT-X-MAP:") || trimmed.startsWith("#EXT-X-MEDIA:") || trimmed.startsWith("#EXT-X-SESSION-KEY:")) {
                String rewritten = Pattern.compile("URI=\"([^\"]+)\"").matcher(trimmed)
                    .replaceAll(mr -> {
                        String uri = mr.group(1);
                        if (uri.startsWith("http://") || uri.startsWith("https://")) {
                            return "URI=\"" + PROXY_PATH + uri + "\"";
                        }
                        if (uri.startsWith("/")) {
                            return "URI=\"" + PROXY_PATH + "https://" + baseHost + uri + "\"";
                        }
                        try {
                            String baseDir = effectiveTarget;
                            int extKeySlash = effectiveTarget.lastIndexOf('/');
                            if (extKeySlash > effectiveTarget.indexOf("://") + 2) {
                                baseDir = effectiveTarget.substring(0, extKeySlash + 1);
                            } else {
                                baseDir = effectiveTarget + "/";
                            }
                            String resolved = URI.create(baseDir).resolve(uri).toString();
                            return "URI=\"" + PROXY_PATH + resolved + "\"";
                        } catch (Exception e) {
                            return mr.group();
                        }
                    });
                sb.append(rewritten).append("\n");
            } else {
                sb.append(line).append("\n");
            }
        }
        return sb.toString();
    }

    /**
     * Replace external resource site banners (e.g. freelink.co.jp) with FankuHub link.
     * Finds the <section> containing the external URL and replaces it.
     */
    private String rewriteResourceSites(String html) {
        int flIdx = html.indexOf("freelink.co.jp");
        if (flIdx < 0) return html;

        int sectionStart = html.lastIndexOf("<section", flIdx);
        if (sectionStart < 0) return html;

        int sectionEnd = html.indexOf("</section>", flIdx);
        if (sectionEnd < 0) return html;
        sectionEnd += "</section>".length();

        String fankuBanner = "<section class=\"px-margin py-md\">"
            + "<div class=\"grid gap-3 sm:gap-4 grid-cols-1\">"
            + "<!--[--><a href=\"/proxy/https://www.fankuhub.com\" "
            + "class=\"group relative flex items-center justify-center w-full h-52 sm:h-64 lg:h-72 "
            + "overflow-hidden rounded-xl bg-gradient-to-br from-purple-600/80 to-blue-600/80 "
            + "ring-1 ring-white/10 hover:ring-white/30 transition\">"
            + "<span class=\"relative z-10 text-white text-3xl sm:text-4xl font-bold tracking-wide drop-shadow-lg\">"
            + "\uD83C\uDFAC FankuHub</span>"
            + "</a><!--]--></div></section>";

        html = html.substring(0, sectionStart) + fankuBanner + html.substring(sectionEnd);

        // Also clean remaining freelink refs in Nuxt data payload
        html = html.replace("freelink.co.jp", "fankuhub.com");

        return html;
    }

    /**
     * Extract scheme + authority (host + port) from a URL string.
     * Handles URLs with or without a trailing path.
     * e.g. "https://example.com/path" -> "https://example.com"
     *      "https://example.com"       -> "https://example.com"
     */
    private String extractOrigin(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            int port = uri.getPort();
            if (scheme == null || host == null) return url;
            if (port > 0 && port != 80 && port != 443) {
                return scheme + "://" + host + ":" + port;
            }
            return scheme + "://" + host;
        } catch (Exception e) {
            // Fallback: find "://" then find next "/" or end
            int schemeEnd = url.indexOf("://");
            if (schemeEnd > 0) {
                int pathStart = url.indexOf("/", schemeEnd + 3);
                return pathStart > 0 ? url.substring(0, pathStart) : url;
            }
            return url;
        }
    }

    private String extractBase(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            int port = uri.getPort();
            if (host == null) return null;
            return port > 0 && port != 80 && port != 443 ? host + ":" + port : host;
        } catch (Exception e) {
            return null;
        }
    }
}
