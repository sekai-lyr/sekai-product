import pathlib
path = pathlib.Path(r'D:\Sekai_two\memory-9\SekaiForm\src\main\resources\data.sql')
content = path.read_text('utf-8')

# Add model inserts
new_inserts = '''

-- ===== Live2D Models =====
INSERT INTO live2d_model(model_name, model_path, display_name)
SELECT 'aidang_2', 'models\\2d\\aidang_2', '??? (Cubism 4)'
WHERE NOT EXISTS (SELECT 1 FROM live2d_model WHERE model_name = 'aidang_2');

INSERT INTO live2d_model(model_name, model_path, display_name)
SELECT 'biaoqiang_3', 'models\\2d\\biaoqiang_3', '?? (Cubism 4)'
WHERE NOT EXISTS (SELECT 1 FROM live2d_model WHERE model_name = 'biaoqiang_3');

INSERT INTO live2d_model(model_name, model_path, display_name)
SELECT 'haru_ja', 'models\\2d\\haru_ja', 'Haru (Cubism 2)'
WHERE NOT EXISTS (SELECT 1 FROM live2d_model WHERE model_name = 'haru_ja');

INSERT INTO live2d_model(model_name, model_path, display_name)
SELECT 'hiyori_en', 'models\\2d\\hiyori_en', 'Hiyori (Cubism 2/4)'
WHERE NOT EXISTS (SELECT 1 FROM live2d_model WHERE model_name = 'hiyori_en');
'''

if 'live2d_model' not in content:
    content += new_inserts
    path.write_text(content, 'utf-8')
    print('Added model inserts to data.sql')
else:
    print('Models already in data.sql?')
    print(content[content.find('live2d_model'):][:200] if 'live2d_model' in content else 'not found')
