with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "r", encoding="utf-8") as f:
    content = f.read()

# Find the HTML processing section where we inject into <head>
# We need to add a <base> tag right after <head> opening
# Look for the section that finds headTagClose and injects critical JS
old = '''                    html = html.substring(0, headTagClose + 1) + criticalJs + html.substring(headTagClose + 1);'''
new = '''                    // Inject <base> tag to fix relative URL resolution for SPA routers
                    String baseHref = targetUri.getScheme() + "://" + targetUri.getHost();
                    String baseTag = "<base href=\\"" + PROXY_PATH + baseHref + "/\\">";
                    html = html.substring(0, headTagClose + 1) + baseTag + criticalJs + html.substring(headTagClose + 1);'''

if old in content:
    content = content.replace(old, new)
    print("Base tag injection added")
else:
    print("Pattern not found, searching...")
    idx = content.find("headTagClose + 1) + criticalJs")
    print(f"Found at index: {idx}")
    if idx > 0:
        # Show context
        print(content[max(0,idx-50):idx+100])

with open(r"D:\Sekai_two\memory-10\SekaiAnimeVideo\src\main\java\com\sekai\animevideo\control\ProxyController.java", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")