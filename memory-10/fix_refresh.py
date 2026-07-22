with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "r", encoding="utf-8") as f:
    content = f.read()

# Fix proxyUrl to detect already-proxied full URLs
# Pattern in INJECT_BODY_JS
old1 = 'if (url.indexOf(PROXY_PREFIX) === 0) return url;'
new1 = 'if (url.indexOf(PROXY_PREFIX) !== -1) return url;'
c1 = content.count(old1)
content = content.replace(old1, new1)
print(f"Fix1: {c1} replacements")

# Pattern in inline critical JS
old2 = 'if(u.indexOf(P)===0)return u;'
new2 = 'if(u.indexOf(P)!==-1)return u;'
c2 = content.count(old2)
content = content.replace(old2, new2)
print(f"Fix2: {c2} replacements")

with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")