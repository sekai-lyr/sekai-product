from pathlib import Path
import re, shutil
root=Path(__file__).resolve().parents[1]
templates=root/'src/main/resources/templates'
static=root/'src/main/resources/static'
def edit(p, fn): p.write_text(fn(p.read_text(encoding='utf-8-sig')), encoding='utf-8')
# Public decorative artwork is deliberately separate from user-owned originals.
for number in ['0004','0005','0006','0007']:
    source=next((root/'uploads/wallpapers/sekai-import').glob(f'sekai_import_{number}_*.jpg'))
    shutil.copy2(source, static/'images'/f'archive-{number}.jpg')
for p in templates.glob('*.html'):
    def common(s):
        s=re.sub(r'/uploads/wallpapers/sekai-import/sekai_import_(\d{4})_[a-f0-9]+\.jpg',r'/images/archive-\1.jpg',s)
        s=s.replace('th:src="${wallpaper.imageUrl}"','th:src="@{/media/{id}/thumbnail(id=${wallpaper.id})}"')
        s=s.replace('th:src="${item.imageUrl}"','th:src="@{/media/{id}/thumbnail(id=${item.id})}"')
        s=s.replace('data-lightbox-src=${wallpaper.imageUrl},data-lightbox-alt=${wallpaper.title}',"data-lightbox-src=@{/media/{id}(id=${wallpaper.id})},data-lightbox-alt=${wallpaper.title},data-lightbox-download=@{/download/{id}(id=${wallpaper.id})}")
        s=s.replace('hotWallpapers[0].imageUrl', "'/media/' + hotWallpapers[0].id + '/thumbnail'")
        for target,label in [('library','图库'),('dashboard','看板'),('upload','上传壁纸')]:
            s=s.replace(f'data-icon="{target}"',f'data-icon="{target}" aria-label="{label}"')
        s=s.replace('class="nav-link is-current"','class="nav-link is-current" aria-current="page"')
        if 'class="sidebar-nav"' in s:
            s=s.replace('        </nav>', '''            <a class="nav-link" href="/trash" aria-label="回收站"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg></span><span>回收站</span></a>
        </nav>''',1)
        s=s.replace('<script th:src="@{/js/ui.js}" src="/js/ui.js"></script>','<script th:src="@{/js/ui.js}" src="/js/ui.js"></script>\n<script src="/js/gallery.js" defer></script>')
        s=s.replace('</head>','    <link rel="stylesheet" href="/css/gallery.css">\n</head>')
        return s
    edit(p,common)

def home(s):
    # Remove the promotional lead-in so the actual archive is above the fold.
    start=s.index('        <section class="home-hero"')
    end=s.index('        <section class="library-panel"',start)
    s=s[:start]+s[end:]
    s=s.replace('<div class="topbar-actions">','<div class="topbar-actions"><a class="button-primary" href="/upload">上传壁纸</a>',1)
    s=s.replace('<span class="eyebrow">Personal wallpaper library</span>','<p class="archive-subtitle">找到喜欢的画面，留在手边。</p>')
    s=s.replace('<span class="control-label">Search / filter / sort</span>','<a class="inline-action" href="/home?favorite=true">我的收藏</a>')
    s=s.replace('<form action="/home" method="get" class="search-form advanced-search">','''<div class="maintenance-filter" th:if="${needs != null}"><strong th:text="${needs == 'uncategorized' ? '正在整理未分类图片' : '正在整理缺少标签的图片'}"></strong><a href="/home">返回全部图片</a></div>
            <form action="/home" method="get" class="search-form advanced-search" th:if="${needs == null}">''')
    advanced=[]
    for name in ['orientation','original','colorTone']:
        pattern=rf'                <label class="sr-only" for="{name}">.*?</select>\n'
        match=re.search(pattern,s,re.S)
        advanced.append(match.group())
        s=s[:match.start()]+s[match.end():]
    s=s.replace('                <button type="submit">应用筛选</button>','''                <button type="submit">查找壁纸</button>
                <a href="/home" class="filter-reset">重置</a>
                <details class="more-filters" th:open="${orientation != '' or colorTone != '' or original != null}"><summary>更多筛选</summary><div class="extra-filters">'''+''.join(advanced)+'''</div></details>''')
    s=s.replace("${(stat.index == 0 ? ' featured-wallpaper' : '') + (spotlightId != null and spotlightId == wallpaper.id ? ' is-spotlight' : '')}", "${spotlightId != null and spotlightId == wallpaper.id ? ' is-spotlight' : ''}")
    s=s.replace("onclick=\"return confirm('确认删除这张壁纸记录？')\">删除", 'data-confirm="移入回收站？之后可以恢复。">移入回收站')
    s=s.replace('sort=${sort})}', 'sort=${sort}, needs=${needs})}')
    # Context is server-validated; JS only adds scroll restoration.
    return_url='@{/home(page=${currentPage},keyword=${keyword},categoryId=${categoryId},favorite=${favorite},original=${original},orientation=${orientation},colorTone=${colorTone},sort=${sort},needs=${needs})}'
    s=re.sub(r'(<form\b[^>]*method="post"[^>]*>)', lambda m:m.group()+f'<input type="hidden" name="returnTo" th:value="{return_url}">',s)
    return s
edit(templates/'home.html',home)

def dashboard(s):
    s=s.replace('''<a th:each="item, stat : ${hotWallpapers}" th:href="@{'/download/' + ${item.id}}">''', '''<button type="button" class="rank-preview" th:each="item, stat : ${hotWallpapers}" th:attr="data-lightbox-src=@{/media/{id}(id=${item.id})},data-lightbox-alt=${item.title},data-lightbox-download=@{/download/{id}(id=${item.id})}">''')
    s=s.replace('''                    </a>
                </div>
                <p th:if="${#lists.isEmpty(hotWallpapers)}">''','''                    </button>
                </div>
                <p th:if="${#lists.isEmpty(hotWallpapers)}">''')
    a=s.index('                <div class="task-list">')
    b=s.index('                <div class="tag-cloud">',a)
    s=s[:a]+'''                <div class="archive-tasks">
                    <a href="/home?needs=uncategorized"><span>未分类图片</span><strong th:text="${health.uncategorized + ' 张 · 去整理'}"></strong></a>
                    <a href="/home?needs=untagged"><span>缺少标签</span><strong th:text="${health.untagged + ' 张 · 去补充'}"></strong></a>
                    <a href="/trash"><span>回收站</span><strong th:text="${health.trashCount + ' 张 · 管理'}"></strong></a>
                    <p><span>原图记录容量（含回收站）</span><strong th:text="${health.storageLabel}"></strong></p>
                    <p><span>已完成传输的下载请求</span><strong th:text="${health.downloads}"></strong></p>
                </div>
''' + s[b:]
    s=s.replace('收藏热度','收藏图片')
    return s
edit(templates/'dashboard.html',dashboard)

def upload(s):
    s=s.replace('class="edit-form" data-submit-state data-submitting-label="正在保存..."','class="edit-form" id="uploadForm"')
    s=s.replace('选择一张壁纸文件','选择壁纸文件，或拖到这里')
    s=s.replace('支持 JPG、PNG、WEBP 等图片格式','支持 JPG、PNG、GIF；每张不超过 20 MB、4000 万像素')
    s=s.replace('accept="image/*"','accept="image/jpeg,image/png,image/gif"')
    s=s.replace('id="title" type="text"','id="title" maxlength="120" type="text"')
    s=s.replace('例如：黄昏海岸的约定','留空使用文件名；批量时作为统一标题前缀')
    s=s.replace('角色名</label>','角色名（可选）</label>').replace('作品来源</label>','作品来源（可选）</label>').replace('色调</label>','色调（可选）</label>').replace('标签</label>','标签（可选）</label>')
    s=s.replace('<button type="submit">保存到图库</button>','''<button type="submit">开始上传</button>
                    <noscript><p>当前浏览器未启用 JavaScript，请填写标题并逐张上传。</p></noscript>''')
    s=s.replace('''                </form>
            </section>''','''                </form>
                <section id="uploadQueue" aria-label="上传队列" hidden>
                    <h3>上传队列</h3><p id="queueStatus" role="status" aria-live="polite"></p>
                    <ol id="queueItems"></ol><a class="button-secondary" href="/home">查看图库</a>
                </section>
                <p class="server-message error" th:if="${param.tooLarge != null}">图片超过限制，请选择 20 MB 以内的文件。</p>
            </section>''',1)
    return s
edit(templates/'upload.html',upload)

home_text=(templates/'home.html').read_text(encoding='utf-8')
sidebar=home_text[home_text.index('    <aside class="app-sidebar"'):home_text.index('    <main class="app-main"')]
sidebar=sidebar.replace('class="nav-link is-current" aria-current="page"','class="nav-link"').replace('class="nav-link" href="/trash"','class="nav-link is-current" aria-current="page" href="/trash"')
trash='''<!DOCTYPE html>
<html lang="zh-CN" xmlns:th="http://www.thymeleaf.org"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sekai Picture | 回收站</title><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/gallery.css"></head>
<body class="app-shell"><div class="app-layout">'''+sidebar+'''
<main class="app-main"><header class="app-topbar"><div><h1>回收站</h1><p>图片保留在这里，直到你恢复或彻底删除。</p></div><a href="/home" class="button-secondary">回到图库</a></header>
<p class="server-message success" th:if="${message}" th:text="${message}"></p><p class="server-message error" th:if="${error}" th:text="${error}"></p>
<section class="wallpaper-grid"><article class="wallpaper-card" th:each="wallpaper : ${wallpapers}">
<figure class="wallpaper-preview"><img th:src="@{/media/{id}/thumbnail(id=${wallpaper.id})}" th:alt="${wallpaper.title}" loading="lazy"><button class="image-open" type="button" th:attr="data-lightbox-src=@{/media/{id}(id=${wallpaper.id})},data-lightbox-alt=${wallpaper.title}">预览</button></figure>
<div class="card-body"><h2 th:text="${wallpaper.title}"></h2><p th:text="${'移入时间：' + #temporals.format(wallpaper.deletedAt, 'yyyy-MM-dd HH:mm')}"></p><div class="actions">
<form method="post" th:action="@{/wallpaper/{id}/restore(id=${wallpaper.id})}"><button type="submit">恢复到图库</button></form>
<form method="post" th:action="@{/wallpaper/{id}/purge(id=${wallpaper.id})}"><button type="submit" class="danger-button" data-confirm="彻底删除后无法恢复，确认删除图片及文件？">彻底删除</button></form>
</div></div></article></section><section class="empty-state" th:if="${#lists.isEmpty(wallpapers)}"><h2>回收站是空的</h2><p>移除的图片会先放在这里，方便找回。</p><a href="/home">浏览图库</a></section></main></div>
<script src="/js/ui.js"></script><script src="/js/gallery.js" defer></script></body></html>'''
(templates/'trash.html').write_text(trash,encoding='utf-8')

# The batch uploader owns file selection and the native dialog replaces the old modal.
p=static/'js/ui.js'
def old_js(s):
    s=s.replace('    initFileDrop();','    if (!document.querySelector("#uploadForm")) initFileDrop();')
    a=s.index('    const initLightbox = () => {')
    b=s.index('    const initSubmitStates',a)
    s=s[:a]+s[b:]
    s=s.replace('    initLightbox();','')
    return s
edit(p,old_js)
