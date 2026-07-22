with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "r", encoding="utf-8") as f:
    content = f.read()

# Inject base tag AFTER rewriteUrls and BEFORE response.setContentType
old = '''                html = rewriteUrls(html, effectiveTarget, charset);

                response.setContentType("text/html;charset=UTF-8");'''

new = '''                html = rewriteUrls(html, effectiveTarget, charset);

                // Inject base tag AFTER URL rewriting to fix SPA relative URL resolution
                String baseHost2 = siteHost != null ? siteHost : extractBase(effectiveTarget);
                if (baseHost2 == null) baseHost2 = "www.fankuhub.com";
                String baseTag = "<base href=\"" + PROXY_PATH + "https://" + baseHost2 + "/\">";
                int headTagEnd = html.indexOf(">", html.indexOf("<head"));
                if (headTagEnd > 0) {
                    html = html.substring(0, headTagEnd + 1) + baseTag + html.substring(headTagEnd + 1);
                }

                response.setContentType("text/html;charset=UTF-8");'''

if old in content:
    content = content.replace(old, new)
    print("Base tag injection added!")
else:
    print("PATTERN NOT FOUND")

with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")