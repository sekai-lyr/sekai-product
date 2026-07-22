with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "r", encoding="utf-8") as f:
    content = f.read()

old = '                    // Inject <base> tag to fix relative URL resolution for SPA routers\n                    String baseHref = targetUri.getScheme() + "://" + targetUri.getHost();\n                    String baseTag = "<base href=\\"" + PROXY_PATH + baseHref + "/\\">";'
new = '                    // Inject <base> tag to fix relative URL resolution for SPA routers\n                    String baseHref = "https://" + (siteHost != null ? siteHost : targetUri.getHost());\n                    String baseTag = "<base href=\\"" + PROXY_PATH + baseHref + "/\\">";'

if old in content:
    content = content.replace(old, new)
    print("Fixed base tag!")
else:
    print("NOT FOUND")
    idx = content.find("baseHref")
    if idx > 0:
        print(content[idx-20:idx+100])

with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")