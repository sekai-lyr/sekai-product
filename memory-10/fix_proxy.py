# -*- coding: utf-8 -*-
import re

with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add Cookie import
content = content.replace(
    "import jakarta.servlet.http.HttpServletResponse;",
    "import jakarta.servlet.http.HttpServletResponse;\nimport jakarta.servlet.http.Cookie;"
)

# 2. Add HOST_COOKIE constant
content = content.replace(
    'private static final String PROXY_PATH = "/proxy/";',
    'private static final String PROXY_PATH = "/proxy/";\n    private static final String HOST_COOKIE = "PXHOST";'
)

# 3. Add Map import
content = content.replace(
    "import java.util.List;",
    "import java.util.List;\nimport java.util.Map;"
)

# 4. Fix host resolution to use cookie
old_block = '''        if (!fullPath.startsWith(PROXY_PATH)) {
            String referer = request.getHeader("Referer");
            String host = "www.fankuhub.com";
            if (referer != null) {
                int pi = referer.indexOf("/proxy/");
                if (pi >= 0) {
                    try { host = java.net.URI.create(referer.substring(pi + 7)).getHost(); }
                    catch (Exception ignored) {}
                }
            }
            target = "https://" + host + fullPath;
        } else {
            target = fullPath.substring(PROXY_PATH.length());
        }'''

new_block = '''        String siteHost = null;
        if (!fullPath.startsWith(PROXY_PATH)) {
            siteHost = getCookie(request, HOST_COOKIE);
            if (siteHost == null) {
                String referer = request.getHeader("Referer");
                if (referer != null) {
                    int pi = referer.indexOf("/proxy/");
                    if (pi >= 0) {
                        try { siteHost = java.net.URI.create(referer.substring(pi + 7)).getHost(); }
                        catch (Exception ignored) {}
                    }
                }
                if (siteHost == null) siteHost = "www.fankuhub.com";
            }
            target = "https://" + siteHost + fullPath;
        } else {
            target = fullPath.substring(PROXY_PATH.length());
            siteHost = extractBase(target);
        }'''

content = content.replace(old_block, new_block)

# 5. Add host cookie setting
old_cookie = '''            // Forward Set-Cookie headers from upstream so the client browser can maintain session
            proxyRes.headers().allValues("Set-Cookie").forEach(c -> response.addHeader("Set-Cookie", c));'''

new_cookie = '''            // Set host tracking cookie
            if (siteHost != null && !siteHost.isEmpty()) {
                Cookie hc = new Cookie(HOST_COOKIE, siteHost);
                hc.setPath("/");
                hc.setMaxAge(3600);
                hc.setHttpOnly(true);
                response.addCookie(hc);
            }

            // Forward Set-Cookie headers from upstream
            proxyRes.headers().allValues("Set-Cookie").forEach(c -> response.addHeader("Set-Cookie", c));'''

content = content.replace(old_cookie, new_cookie)

# 6. Add getCookie method
old_method = "    private String detectCharsetFromMeta(byte[] rawHtml) {"
new_method = '''    private String getCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (name.equals(c.getName())) return c.getValue();
            }
        }
        return null;
    }

    private String detectCharsetFromMeta(byte[] rawHtml) {'''

content = content.replace(old_method, new_method)

# 7. Fix encoding detection - add looksGarbled check
old_enc = "                if (html.indexOf('\\uFFFD') > 0) {"
new_enc = "                if (html.indexOf('\\uFFFD') > 0 || looksGarbled(html)) {"
content = content.replace(old_enc, new_enc)

# 8. Add looksGarbled method before extractBase
old_extract = "    private String extractBase(String url) {"
new_extract = '''    private boolean looksGarbled(String text) {
        if (text.length() < 50) return false;
        int sampleLen = Math.min(text.length(), 1000);
        String sample = text.substring(0, sampleLen);
        int weird = 0;
        for (int i = 0; i < sample.length(); i++) {
            char c = sample.charAt(i);
            if (c >= 0x80 && c <= 0x9F) weird++;
            if (c == 0xFFFD) weird += 5;
        }
        return weird > sampleLen * 0.15;
    }

    private String extractBase(String url) {'''

content = content.replace(old_extract, new_extract)

# 9. Fix window.open in injected JS  
old_win = "window.open = function(url, target, features) {"
# Find the full block around window.open
idx = content.find(old_win)
if idx > 0:
    # Find the closing of this function
    end_idx = content.find("return window;", idx)
    if end_idx > 0:
        end_line = content.find("\n", end_idx)
        old_window_block = content[idx:end_line+1]
        new_window_block = '''window.open = function(url, target, features) {
                    if (!url || url === '' || url === 'about:blank') {
                        try { return _open.call(window, url, target, features); } catch(e) { return null; }
                    }
                    if (typeof url === 'string' && url.indexOf('javascript:') !== 0 && url.indexOf('blob:') !== 0 && url.indexOf('data:') !== 0) {
                        try { window.location.href = proxyUrl(url); } catch(e) { try { _open.call(window, proxyUrl(url), '_self'); } catch(e2) {} }
                    }
                    return null;'''
        content = content.replace(old_window_block, new_window_block)

# 10. Fix MutationObserver for links - add form target removal
old_mo = """if (nodes[j].querySelectorAll) {
                                var links = nodes[j].querySelectorAll('a[target="_blank"], a[target="blank"]');"""
new_mo = """if (nodes[j].querySelectorAll) {
                                var links = nodes[j].querySelectorAll('a[target="_blank"], a[target="blank"], form[target="_blank"]');"""
content = content.replace(old_mo, new_mo)

# 11. Add history API interception before the MutationObserver for link targets
old_mo2 = "new MutationObserver(function(muts) {"
# Find it by context
idx2 = content.find(old_mo2, content.find("preventEscape"))
if idx2 > 0:
    # Find the end of the preventEscape IIFE
    end_iife = content.find("})();", content.find(".observe(document.documentElement, {childList:true, subtree:true});", idx2))
    if end_iife > 0:
        end_iife = content.find("\n", end_iife)
        # Insert history interception before the MutationObserver
        history_intercept = '''            // Intercept history API for SPA navigation
            try {
                var _push = history.pushState;
                history.pushState = function(state, title, url) {
                    if (url && typeof url === 'string') url = proxyUrl(url);
                    return _push.call(this, state, title, url);
                };
                var _replace = history.replaceState;
                history.replaceState = function(state, title, url) {
                    if (url && typeof url === 'string') url = proxyUrl(url);
                    return _replace.call(this, state, title, url);
                };
            } catch(e) {}
            '''
        content = content[:end_iife+1] + history_intercept + content[end_iife+1:]

with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "w", encoding="utf-8") as f:
    f.write(content)

print("All fixes applied successfully!")
print("File length:", len(content))