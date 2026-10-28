with open('src/main/java/com/example/demo/chat/entity/UserSessionEntity.java', 'r', encoding='utf-8') as f:
    content = f.read()
    
content = content.replace('columnDefinition = "LONGTEXT"', '')
    
with open('src/main/java/com/example/demo/chat/entity/UserSessionEntity.java', 'w', encoding='utf-8') as f:
    f.write(content)
