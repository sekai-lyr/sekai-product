with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "r", encoding="utf-8") as f:
    content = f.read()

# Add skip for already-proxied URLs right after the trimmed line
old = '''        String trimmed = url.trim();
        // Skip rewriting for CDN/static domains - load directly from origin for speed
        if (DIRECT_DOMAINS.matcher(trimmed).find()) {'''
new = '''        String trimmed = url.trim();
        // Skip already-proxied URLs to prevent double-proxying
        if (trimmed.startsWith(PROXY_PATH) || trimmed.contains(PROXY_PATH)) {
            return null;
        }
        // Skip rewriting for CDN/static domains - load directly from origin for speed
        if (DIRECT_DOMAINS.matcher(trimmed).find()) {'''

if old in content:
    content = content.replace(old, new)
    print("Fixed!")
else:
    print("NOT FOUND")
    idx = content.find("String trimmed = url.trim();")
    if idx > 0:
        print(content[idx:idx+300])

with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")