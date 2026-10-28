import re

with open('src/main/java/com/example/demo/ai/SpringAiTools.java', 'r', encoding='utf-8') as f:
    content = f.read()

# Debug: print the line we're looking for
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'chatWithTools' in line and 'Under 200 words' in line:
        print(f'Line {i+1}: {line}')
        # Use a simpler replacement
        old_text = 'Under 200 words.");'
        new_text = 'Under 200 words.", null, null);'
        if old_text in line:
            lines[i] = line.replace(old_text, new_text)
            print(f'Replaced: {old_text} -> {new_text}')
        break

content = '\n'.join(lines)

with open('src/main/java/com/example/demo/ai/SpringAiTools.java', 'w', encoding='utf-8') as f:
    f.write(content)
