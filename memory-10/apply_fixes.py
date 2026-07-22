with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "r", encoding="utf-8") as f:
    content = f.read()

# FIX 1: Add Cookie import
content = content.replace(
    "import jakarta.servlet.http.HttpServletResponse;",
    "import jakarta.servlet.http.HttpServletResponse;\nimport jakarta.servlet.http.Cookie;"
)

# FIX 2: Add HOST_COOKIE constant
content = content.replace(
    'private static final String PROXY_PATH = "/proxy/";',
    'private static final String PROXY_PATH = "/proxy/";\n    private static final String HOST_COOKIE = "PXHOST";'
)

# FIX 3: Fix proxyUrl in INJECT_BODY_JS (=== 0 -> !== -1)
old = "if (url.indexOf(PROXY_PREFIX) === 0) return url;"
new = "if (url.indexOf(PROXY_PREFIX) !== -1) return url;"
content = content.replace(old, new)

# FIX 4: Fix proxyUrl in critical inline JS  
old2 = "if(u.indexOf(P)===0)return u;"
new2 = "if(u.indexOf(P)!==-1)return u;"
content = content.replace(old2, new2)

# FIX 5: Fix host resolution to use cookie
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

# FIX 6: Add host cookie in response
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

# FIX 7: Add getCookie method before detectCharsetFromMeta
old_method = "    private String detectCharsetFromMeta(byte[] htmlBytes) {"
new_method = '''    private String getCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (name.equals(c.getName())) return c.getValue();
            }
        }
        return null;
    }

    private String detectCharsetFromMeta(byte[] htmlBytes) {'''

content = content.replace(old_method, new_method)

# FIX 8: Add base tag injection AFTER URL rewriting
# Find the section after rewriteUrls is called
old_base = '''                // Rewrite URLs in final HTML
                html = rewriteUrls(html, effectiveTarget, charset);'''
new_base = '''                // Rewrite URLs in final HTML
                html = rewriteUrls(html, effectiveTarget, charset);

                // Inject base tag AFTER URL rewriting to avoid double-proxy
                String baseHost = siteHost != null ? siteHost : extractBase(effectiveTarget);
                if (baseHost == null) baseHost = "www.fankuhub.com";
                String baseTag = "<base href=\"" + PROXY_PATH + "https://" + baseHost + "/\">";
                int headTagEnd = html.indexOf(">", html.indexOf("<head"));
                if (headTagEnd > 0) {
                    html = html.substring(0, headTagEnd + 1) + baseTag + html.substring(headTagEnd + 1);
                }'''

if old_base in content:
    content = content.replace(old_base, new_base)
    print("Base tag injection added (after rewriteUrls)")
else:
    print("WARNING: base tag pattern not found!")

with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "w", encoding="utf-8") as f:
    f.write(content)
print("All fixes applied. Length:", len(content))