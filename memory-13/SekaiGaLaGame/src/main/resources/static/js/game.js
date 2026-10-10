(function () {
    'use strict';

    // ---------------- 基础 ----------------
    const $ = (sel) => document.querySelector(sel);
    const activeAnimations = new WeakMap();
    let toastTimer = null;
    let lastModalFocus = null;

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // Native WAAPI keeps the static build dependency-free while preserving the
    // same transform/opacity-first motion discipline as the animation layer.
    function playMotion(el, keyframes, options = {}) {
        if (!el || prefersReducedMotion()) return null;
        const previous = activeAnimations.get(el);
        if (previous) previous.cancel();
        const animation = el.animate(keyframes, {
            duration: 560,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'both',
            ...options
        });
        activeAnimations.set(el, animation);
        animation.finished.catch(() => {}).finally(() => {
            if (activeAnimations.get(el) === animation) activeAnimations.delete(el);
        });
        return animation;
    }

    function revealElement(el) {
        if (!el) return;
        el.classList.remove('hidden', 'is-entering');
        if (prefersReducedMotion()) return;
        requestAnimationFrame(() => {
            el.classList.add('is-entering');
            window.setTimeout(() => el.classList.remove('is-entering'), 900);
        });
    }

    function hideElement(el) {
        if (!el) return;
        el.classList.remove('is-entering');
        el.classList.add('hidden');
    }

    async function api(url, options) {
        const resp = await fetch(url, options);
        const json = await resp.json();
        if (!json.success) {
            throw new Error(json.message || '请求失败');
        }
        return json.data;
    }

    function post(url, params) {
        const body = new URLSearchParams(params || {});
        return api(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    }

    function showToast(msg) {
        const t = $('#toast');
        t.textContent = msg;
        clearTimeout(toastTimer);
        t.classList.remove('show');
        void t.offsetWidth;
        t.classList.add('show');
        toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
    }

    // ---------------- 全局状态 ----------------
    const state = {
        user: null,
        frame: null,
        characters: {},
        busy: false,
        authBusy: false,
        lastNodeKey: null,
        lastSpeakerName: null
    };

    // 打字机效果：与 RenPy preferences.text_cps = 35（每秒 35 字）一致
    const TEXT_CPS = 35;
    const TEXT_TICK = 1000 / 60;
    let typeTimer = null;
    let typeFullText = '';

    function typeText(el, full) {
        clearInterval(typeTimer);
        typeTimer = null;
        typeFullText = full || '';
        el.textContent = '';
        $('#dialogue-area').classList.add('is-typing');
        $('#click-hint').classList.add('hidden');
        if (!typeFullText) {
            $('#dialogue-area').classList.remove('is-typing');
            return;
        }
        let i = 0;
        const perTick = Math.max(1, Math.round(TEXT_CPS / 60));
        typeTimer = setInterval(() => {
            i = Math.min(i + perTick, typeFullText.length);
            el.textContent = typeFullText.slice(0, i);
            if (i >= typeFullText.length) {
                clearInterval(typeTimer);
                typeTimer = null;
                $('#dialogue-area').classList.remove('is-typing');
                $('#click-hint').classList.remove('hidden');
            }
        }, TEXT_TICK);
    }

    function finishTyping() {
        if (typeTimer) {
            clearInterval(typeTimer);
            typeTimer = null;
            $('#dialogue-text').textContent = typeFullText;
            $('#dialogue-area').classList.remove('is-typing');
            $('#click-hint').classList.remove('hidden');
        }
    }

    function cancelTyping() {
        if (typeTimer) {
            clearInterval(typeTimer);
            typeTimer = null;
        }
        $('#dialogue-area').classList.remove('is-typing');
    }

    // 立绘位置映射：直接使用 script.rpy 中各 transform 的精确参数
    // {x: xalign, z: zoom, y: yalign, r: rotate}，RenPy 基准分辨率 1920x1080
    const POS_MAP = {
        'cast_single_center': { x: 0.52, z: 1.05, y: 1.0, r: -0.28 },
        'cast_left': { x: 0.22, z: 0.88, y: 1.0, r: -0.22 },
        'cast_center': { x: 0.52, z: 0.86, y: 1.0, r: -0.18 },
        'cast_right': { x: 0.74, z: 0.86, y: 1.0, r: 0.22 },
        'cast_far_right': { x: 0.98, z: 0.72, y: 1.0, r: 0.20 },
        'cast_group_left': { x: 0.10, z: 0.74, y: 1.0, r: -0.14 },
        'cast_group_midleft': { x: 0.36, z: 0.74, y: 1.0, r: -0.08 },
        'cast_group_midright': { x: 0.62, z: 0.74, y: 1.0, r: 0.08 },
        'cast_group_right': { x: 0.88, z: 0.74, y: 1.0, r: 0.14 },
        'heroine_full': { x: 0.50, z: 0.55, y: 1.0, r: -0.35 },
        'heroine_bust_center': { x: 0.56, z: 1.05, y: 1.0, r: -0.38 },
        'heroine_winter_center': { x: 0.56, z: 1.05, y: 1.0, r: -0.38 },
        'heroine_autumn_center': { x: 0.56, z: 1.45, y: 1.0, r: -0.34 },
        'heroine_autumn_left': { x: 0.36, z: 1.36, y: 1.0, r: -0.34 },
        'heroine_autumn_right': { x: 0.74, z: 1.36, y: 1.0, r: -0.34 },
        'heroine_autumn_near': { x: 0.56, z: 1.54, y: 1.0, r: -0.30 },
        'heroine_autumn_far': { x: 0.56, z: 1.28, y: 1.0, r: -0.32 },
        'heroine_karuizawa_center': { x: 0.56, z: 1.45, y: 1.0, r: -0.34 },
        'heroine_karuizawa_left': { x: 0.36, z: 1.36, y: 1.0, r: -0.34 },
        'heroine_karuizawa_right': { x: 0.74, z: 1.36, y: 1.0, r: -0.34 },
        'heroine_karuizawa_near': { x: 0.56, z: 1.54, y: 1.0, r: -0.30 },
        'heroine_karuizawa_far': { x: 0.56, z: 1.28, y: 1.0, r: -0.32 },
        'heroine_ch12_ch13_center': { x: 0.56, z: 0.63, y: 1.0, r: -0.35 },
        'heroine_ch12_ch13_left': { x: 0.35, z: 0.63, y: 1.0, r: -0.35 },
        'heroine_ch12_ch13_right': { x: 0.74, z: 0.63, y: 1.0, r: -0.35 },
        'heroine_ch12_ch13_near': { x: 0.56, z: 0.70, y: 1.0, r: -0.32 },
        'heroine_ch12_ch13_far': { x: 0.56, z: 0.56, y: 1.0, r: -0.32 },
        'band_guitarist_stage': { x: 0.37, z: 0.44, y: 0.55, r: 0 },
        'band_bassist_stage': { x: 0.50, z: 0.40, y: 0.55, r: 0 },
        'band_keyboardist_stage': { x: 0.66, z: 0.40, y: 0.58, r: 0 },
        'band_drummer_stage': { x: 0.82, z: 0.40, y: 0.58, r: 0 },
        'center': { x: 0.50, z: 1.0, y: 1.0, r: 0 }
    };

    function posOf(name) {
        const cfg = POS_MAP[name];
        if (cfg) return cfg;
        return { x: 0.50, z: 1.0, y: 1.0, r: 0 };
    }

    // ---------------- 页面切换 ----------------
    function showScreen(name) {
        hideElement($('#login-overlay'));
        hideElement($('#title-screen'));
        hideElement($('#game-screen'));
        hideElement($('#ending-overlay'));

        if (name === 'title') revealElement($('#title-screen'));
        if (name === 'game') revealElement($('#game-screen'));
    }

    function openModal(title) {
        cancelTyping();
        lastModalFocus = document.activeElement;
        $('#modal-title').textContent = title;
        $('#modal').setAttribute('aria-hidden', 'false');
        revealElement($('#modal'));
        window.setTimeout(() => $('#modal-close').focus(), 0);
    }

    function closeModal() {
        hideElement($('#modal'));
        $('#modal').setAttribute('aria-hidden', 'true');
        if (lastModalFocus && typeof lastModalFocus.focus === 'function') lastModalFocus.focus();
        lastModalFocus = null;
    }

    function openViewer(url) {
        $('#viewer-img').src = url;
        revealElement($('#viewer'));
        window.setTimeout(() => $('#viewer-close').focus(), 0);
    }

    function closeViewer() {
        hideElement($('#viewer'));
    }

    function setModalLoading(kind) {
        const body = $('#modal-body');
        body.className = 'modal-body modal-loading';
        body.setAttribute('aria-busy', 'true');
        if (kind === 'grid') {
            body.innerHTML = '<div class="skeleton-grid">' + '<span></span>'.repeat(8) + '</div>';
        } else {
            body.innerHTML = '<div class="skeleton-rows">' + '<span></span>'.repeat(5) + '</div>';
        }
    }

    function prepareModalBody() {
        const body = $('#modal-body');
        body.className = 'modal-body';
        body.removeAttribute('aria-busy');
        body.innerHTML = '';
        return body;
    }

    function revealModalItems(container) {
        if (!container) return;
        container.classList.remove('is-ready');
        requestAnimationFrame(() => container.classList.add('is-ready'));
    }

    function showModalError(message) {
        const body = prepareModalBody();
        const error = document.createElement('div');
        error.className = 'empty-state error-state';
        const title = document.createElement('strong');
        title.textContent = '暂时无法打开';
        const detail = document.createElement('span');
        detail.textContent = message;
        error.append(title, detail);
        body.appendChild(error);
    }

    // ---------------- 登录 ----------------
    function initLogin() {
        document.querySelector('.login-tabs').addEventListener('click', (e) => {
            const tab = e.target.closest('.login-tab');
            if (!tab) return;
            document.querySelectorAll('.login-tab').forEach(t => t.classList.toggle('active', t === tab));
            const isLogin = tab.dataset.tab === 'login';
            $('#register-nickname').style.display = isLogin ? 'none' : 'block';
            $('#login-password').setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
        });

        const submitLogin = async () => {
            if (state.authBusy) return;
            const username = $('#login-username').value.trim();
            const password = $('#login-password').value;
            const nickname = $('#register-nickname').value.trim();
            const isLogin = document.querySelector('.login-tab.active').dataset.tab === 'login';
            $('#login-error').textContent = '';
            state.authBusy = true;
            const submit = $('#login-submit');
            submit.disabled = true;
            submit.classList.add('is-loading');
            submit.setAttribute('aria-busy', 'true');
            submit.textContent = isLogin ? '正在进入' : '正在创建';
            try {
                state.user = isLogin
                    ? await post('/api/login', { username, password })
                    : await post('/api/register', { username, password, nickname });
                enterTitle();
            } catch (err) {
                $('#login-error').textContent = err.message;
            } finally {
                state.authBusy = false;
                submit.disabled = false;
                submit.classList.remove('is-loading');
                submit.removeAttribute('aria-busy');
                submit.textContent = '进 入 世 界';
            }
        };

        $('#login-submit').addEventListener('click', submitLogin);
        $('.login-form').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitLogin();
            }
        });
    }

    async function enterTitle() {
        $('#login-overlay').classList.add('hidden');
        $('#title-user').textContent = '旅人 · ' + (state.user.nickname || state.user.username);
        showScreen('title');
    }

    // ---------------- 标题菜单 ----------------
    function initTitleMenu() {
        document.querySelectorAll('#title-screen .menu-btn, .ending-actions .menu-btn').forEach((btn, index) => {
            btn.style.setProperty('--menu-index', index);
            btn.addEventListener('click', () => onMenuAction(btn.dataset.action));
        });
    }

    async function onMenuAction(action) {
        switch (action) {
            case 'start':
                await startGame(0);
                break;
            case 'chapters':
                openChapters();
                break;
            case 'load':
                openSaves('load');
                break;
            case 'save':
                openSaves('save');
                break;
            case 'gallery':
                openGallery();
                break;
            case 'endings':
                openEndings();
                break;
            case 'restart':
                await startGame(0);
                break;
            case 'title':
                $('#ending-overlay').classList.add('hidden');
                showScreen('title');
                break;
            case 'logout':
                try { await post('/api/logout'); } catch (e) { }
                location.reload();
                break;
        }
    }

    async function startGame(chapterNo) {
        try {
            state.frame = await post('/api/game/start', chapterNo ? { chapterNo } : {});
            state.lastNodeKey = null;
            state.lastSpeakerName = null;
            currentBg = '';
            currentCg = '';
            showScreen('game');
            renderFrame();
        } catch (err) {
            showToast(err.message);
        }
    }

    // ---------------- 渲染 ----------------
    const cgLayer = $('#cg-layer');
    const bgLayer = $('#bg-layer');
    const spriteLayer = $('#sprite-layer');

    function isCgUrl(url) {
        return url && url.indexOf('/cg_') !== -1;
    }

    // 与 RenPy 一致：背景只在 scene 实际变化时过渡，对话推进不重复闪烁
    let currentBg = '';
    let currentCg = '';
    let bgSwapTimer = null;

    function setBackground(url, intoCg) {
        const active = intoCg ? currentCg : currentBg;
        if (active === url) {
            if (intoCg && cgLayer.style.opacity !== '1') {
                cgLayer.style.opacity = '1';
                bgLayer.style.opacity = '0';
            }
            if (!intoCg && bgLayer.style.opacity !== '1') {
                bgLayer.style.opacity = '1';
                cgLayer.style.opacity = '0';
            }
            return;
        }
        if (intoCg) {
            currentCg = url;
            cgLayer.style.backgroundImage = `url('${url}')`;
            cgLayer.style.opacity = '1';
            bgLayer.style.opacity = '0';
            playMotion(cgLayer, [
                { opacity: 0, transform: 'scale(1.025)' },
                { opacity: 1, transform: 'scale(1)' }
            ], { duration: 760 });
        } else {
            currentBg = url;
            if (bgLayer.style.backgroundImage) {
                clearTimeout(bgSwapTimer);
                bgLayer.style.opacity = '0';
                bgSwapTimer = setTimeout(() => {
                    bgLayer.style.backgroundImage = `url('${url}')`;
                    bgLayer.style.opacity = '1';
                    playMotion(bgLayer, [
                        { opacity: 0, transform: 'scale(1.025)' },
                        { opacity: 1, transform: 'scale(1)' }
                    ], { duration: 760 });
                }, 260);
            } else {
                bgLayer.style.backgroundImage = `url('${url}')`;
                bgLayer.style.opacity = '1';
                playMotion(bgLayer, [
                    { opacity: 0, transform: 'scale(1.025)' },
                    { opacity: 1, transform: 'scale(1)' }
                ], { duration: 760 });
            }
            cgLayer.style.opacity = '0';
        }
    }

    // 与 RenPy 一致：立绘 DOM 持续保留，只有真正新增/移除/换位时才变化，
    // 对话推进时立绘保持静态，不会每句重新淡入
    function renderSprites(sprites) {
        const items = (sprites || []).filter(s => s.url).map(s => {
            const cfg = posOf(s.pos || 'center');
            const isBottom = cfg.y >= 1;
            return {
                url: s.url,
                left: (cfg.x * 100) + '%',
                top: isBottom ? '' : (cfg.y * 100) + '%',
                bottom: isBottom ? '0' : '',
                transform: isBottom
                    ? `translateX(-50%) rotate(${cfg.r}deg)`
                    : `translate(-50%, ${-(cfg.y * 100)}%) rotate(${cfg.r}deg)`,
                zoom: cfg.z
            };
        });
        const byUrl = new Map(items.map(i => [i.url, i]));

        // 消失的立绘：淡出后移除
        [...spriteLayer.children].forEach(img => {
            if (!byUrl.has(img.dataset.url)) {
                img.style.transition = 'opacity 0.25s ease';
                img.style.opacity = '0';
                setTimeout(() => img.remove(), 260);
            }
        });

        // 新增或更新
        items.forEach(item => {
            let img = spriteLayer.querySelector(`img[data-url="${item.url}"]`);
            if (!img) {
                img = document.createElement('img');
                img.className = 'sprite sprite-appear';
                img.dataset.url = item.url;
                img.dataset.zoom = item.zoom;
                img.src = item.url;
                img.style.left = item.left;
                img.style.top = item.top;
                img.style.bottom = item.bottom;
                img.style.transform = item.transform;
                img.onload = () => {
                    // RenPy 1920x1080 基准：显示高度 = 原图像素高 × zoom，再按屏高等比换算
                    const h = img.naturalHeight * img.dataset.zoom / 1080;
                    img.style.height = (h * 100) + 'vh';
                };
                spriteLayer.appendChild(img);
            } else {
                // 已有立绘：仅在位置/大小变化时更新，不重新淡入
                const moved = img.style.left !== item.left
                    || img.style.top !== item.top
                    || img.style.bottom !== item.bottom
                    || img.style.transform !== item.transform;
                if (moved) {
                    img.style.left = item.left;
                    img.style.top = item.top;
                    img.style.bottom = item.bottom;
                    img.style.transform = item.transform;
                }
                if (img.naturalHeight > 0 && img.dataset.zoom !== String(item.zoom)) {
                    img.style.height = (img.naturalHeight * item.zoom / 1080 * 100) + 'vh';
                    img.dataset.zoom = item.zoom;
                }
            }
        });
    }

    function renderFrame() {
        const f = state.frame;
        if (!f) return;
        const isNewFrame = state.lastNodeKey !== f.nodeKey;
        const speakerChanged = state.lastSpeakerName !== f.speakerName;
        state.lastNodeKey = f.nodeKey;
        state.lastSpeakerName = f.speakerName;

        $('#chapter-label').textContent = f.chapterTitle || '';
        $('#story-progress').textContent = f.chapterTitle ? (f.chapterTitle + ' · ' + (f.labelName || '')) : '';

        if (f.end) {
            showEnding(f);
            return;
        }

        // 背景：CG 场景显示在上层，普通背景在下层
        if (f.bgUrl) {
            setBackground(f.bgUrl, isCgUrl(f.bgUrl));
        }

        renderSprites(f.sprites);

        // 对白
        const isNarration = f.nodeType === 'narration' || !f.speakerName;
        const nameTag = $('#name-tag');
        const text = $('#dialogue-text');
        if (isNarration) {
            nameTag.style.display = 'none';
        } else {
            nameTag.style.display = 'block';
            nameTag.textContent = f.speakerName;
            const ch = state.characters[f.speakerName];
            nameTag.style.background = ch && ch.color
                ? `linear-gradient(135deg, ${ch.color}aa, ${ch.color})`
                : 'linear-gradient(135deg, #7a5fc0, #b39dff)';
        }
        // 打字机逐字显示（选项节点整段直接显示）
        if (f.menu) {
            // 与 RenPy window hide 一致：选选项时隐藏对白框
            $('#dialogue-area').classList.add('hidden');
            text.textContent = f.text || '';
            cancelTyping();
            $('#click-hint').classList.add('hidden');
        } else {
            $('#dialogue-area').classList.remove('hidden');
            typeText(text, f.text);
            if (isNewFrame) {
                playMotion($('#dialogue-area'), [
                    { opacity: 0.45, transform: 'translateY(10px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], { duration: 520 });
            }
            if (speakerChanged && !isNarration) {
                playMotion(nameTag, [
                    { opacity: 0, transform: 'translateY(-8px) scale(0.96)' },
                    { opacity: 1, transform: 'translateY(0) scale(1)' }
                ], { duration: 420 });
            }
        }

        // 选项
        if (f.menu) {
            renderChoices(f.choices || []);
        } else {
            $('#choice-area').classList.add('hidden');
            $('#choice-area').classList.remove('choice-entering', 'is-ready');
        }
    }

    function renderChoices(choices) {
        cancelTyping();
        $('#click-hint').classList.add('hidden');
        const area = $('#choice-area');
        area.classList.remove('hidden', 'is-ready');
        area.classList.add('choice-entering');
        area.innerHTML = '';
        choices.forEach((c, index) => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.style.setProperty('--choice-index', index);
            btn.textContent = c.text;
            btn.addEventListener('click', async () => {
                if (state.busy) return;
                state.busy = true;
                try {
                    state.frame = await post('/api/game/choose', { nextKey: c.nextKey });
                    renderFrame();
                } catch (err) {
                    showToast(err.message);
                } finally {
                    state.busy = false;
                }
            });
            area.appendChild(btn);
        });
        requestAnimationFrame(() => area.classList.add('is-ready'));
    }

    function showEnding(f) {
        cancelTyping();
        $('#click-hint').classList.add('hidden');
        revealElement($('#ending-overlay'));
        if (f.ending) {
            $('#ending-title').textContent = f.ending.title || '结 局';
            $('#ending-desc').textContent = f.ending.description || '';
            const bg = f.ending.bgUrl || f.bgUrl;
            if (bg) {
                $('#ending-bg').style.backgroundImage = `url('${bg}')`;
            }
        } else {
            $('#ending-title').textContent = '故 事 结 束';
            $('#ending-desc').textContent = f.text || '';
        }
    }

    function advance() {
        if (state.busy) return;
        if (!state.frame || state.frame.menu || state.frame.end) return;
        // RenPy 行为：打字中点击 -> 立即显示完整文字；再点击 -> 推进
        if (typeTimer) {
            finishTyping();
            return;
        }
        state.busy = true;
        post('/api/game/advance').then(f => {
            state.frame = f;
            renderFrame();
        }).catch(err => showToast(err.message)).finally(() => { state.busy = false; });
    }

    // ---------------- 章节选择 ----------------
    async function openChapters() {
        openModal('章 节 选 择');
        setModalLoading('rows');
        try {
            const chapters = await api('/api/chapters');
            const body = prepareModalBody();
            if (!chapters.length) {
                body.innerHTML = '<div class="empty-state"><strong>还没有章节</strong><span>章节数据暂时为空。</span></div>';
                return;
            }
            chapters.forEach((ch, index) => {
                const row = document.createElement('div');
                row.className = 'chapter-row';
                row.tabIndex = 0;
                row.style.setProperty('--item-index', index);
                row.innerHTML = `<span class="c-no">${ch.chapterNo === 0 ? '序' : '第' + ch.chapterNo + '章'}</span>
                                 <span class="c-title">${ch.title}</span>
                                 <span style="margin-left:auto;color:#6d6585">▶</span>`;
                const chooseChapter = () => {
                    closeModal();
                    startGame(ch.chapterNo);
                };
                row.addEventListener('click', chooseChapter);
                row.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        chooseChapter();
                    }
                });
                body.appendChild(row);
            });
            revealModalItems(body);
        } catch (err) {
            showModalError(err.message);
            showToast(err.message);
        }
    }

    // ---------------- 存档 ----------------
    async function openSaves(mode) {
        openModal(mode === 'save' ? '存 档' : '读 取 存 档');
        setModalLoading('grid');
        try {
            const saves = await api('/api/saves');
            const body = prepareModalBody();
            const grid = document.createElement('div');
            grid.className = 'save-grid';
            for (let slot = 1; slot <= 10; slot++) {
                const row = saves.find(s => s.slotNo === slot);
                const div = document.createElement('div');
                div.className = 'save-slot';
                div.style.setProperty('--item-index', slot - 1);
                div.innerHTML = `
                    <div class="slot-no">${String(slot).padStart(2, '0')}</div>
                    <div class="slot-info">
                        ${row
                            ? `<div class="slot-title">${row.progress || '第 ' + row.chapterNo + ' 章'}</div>
                               <div class="slot-time">${(row.updateTime || '').replace('T', ' ').slice(0, 16)}</div>`
                            : `<div class="slot-empty">空存档位</div>`}
                    </div>
                    <div class="slot-actions">
                        <button class="slot-btn" data-act="${mode === 'save' ? 'do-save' : 'do-load'}" data-slot="${slot}">
                            ${mode === 'save' ? '存档' : '读取'}
                        </button>
                        ${row ? `<button class="slot-btn danger" data-act="do-del" data-slot="${slot}">删除</button>` : ''}
                    </div>`;
                grid.appendChild(div);
            }
            body.appendChild(grid);
            revealModalItems(grid);

            body.querySelectorAll('.slot-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (btn.disabled) return;
                    const act = btn.dataset.act;
                    const slot = parseInt(btn.dataset.slot, 10);
                    btn.disabled = true;
                    btn.classList.add('is-busy');
                    const originalText = btn.textContent;
                    btn.textContent = '处理中';
                    try {
                        if (act === 'do-save') {
                            await post('/api/save/' + slot);
                            showToast('已保存到存档位 ' + slot);
                            closeModal();
                        } else if (act === 'do-load') {
                            state.frame = await post('/api/load/' + slot);
                            closeModal();
                            showScreen('game');
                            renderFrame();
                        } else {
                            await api('/api/save/' + slot, { method: 'DELETE' });
                            showToast('已删除存档');
                            openSaves(mode);
                        }
                    } catch (err) {
                        btn.disabled = false;
                        btn.classList.remove('is-busy');
                        btn.textContent = originalText;
                        showToast(err.message);
                    }
                });
            });
        } catch (err) {
            showModalError(err.message);
            showToast(err.message);
        }
    }

    // ---------------- 图鉴 ----------------
    async function openGallery() {
        openModal('CG 图 鉴');
        setModalLoading('grid');
        try {
            const items = await api('/api/gallery');
            const body = prepareModalBody();
            const grid = document.createElement('div');
            grid.className = 'gallery-grid';
            if (!items.length) {
                body.innerHTML = '<div class="empty-state"><strong>还没有解锁 CG</strong><span>推进剧情后，新的画面会自动收录到这里。</span></div>';
                return;
            }
            items.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'gallery-item';
                div.tabIndex = 0;
                div.style.setProperty('--item-index', index);
                div.innerHTML = `<img src="${item.url}" alt="CG 画面" loading="lazy">`;
                const preview = () => openViewer(item.url);
                div.addEventListener('click', preview);
                div.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        preview();
                    }
                });
                grid.appendChild(div);
            });
            body.appendChild(grid);
            revealModalItems(grid);
        } catch (err) {
            showModalError(err.message);
            showToast(err.message);
        }
    }

    // ---------------- 结局 ----------------
    async function openEndings() {
        openModal('结 局 记 录');
        setModalLoading('rows');
        try {
            const endings = await api('/api/endings');
            const body = prepareModalBody();
            if (!endings.length) {
                body.innerHTML = '<div class="empty-state"><strong>还没有结局记录</strong><span>完成一条路线后，结局会显示在这里。</span></div>';
                return;
            }
            endings.forEach((ending, index) => {
                const row = document.createElement('div');
                row.className = 'ending-row' + (ending.unlocked ? '' : ' locked');
                if (ending.unlocked) row.tabIndex = 0;
                row.style.setProperty('--item-index', index);
                row.innerHTML = `
                    <div class="e-dot"></div>
                    <div class="e-title">${ending.title}</div>
                    <div class="e-time">${ending.unlocked ? (ending.unlockTime || '已解锁') : '未解锁'}</div>`;
                const previewEnding = () => {
                    if (ending.unlocked) {
                        openViewer(ending.bgUrl);
                    }
                };
                row.addEventListener('click', previewEnding);
                row.addEventListener('keydown', (e) => {
                    if (ending.unlocked && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        previewEnding();
                    }
                });
                body.appendChild(row);
            });
            revealModalItems(body);
        } catch (err) {
            showModalError(err.message);
            showToast(err.message);
        }
    }

    // ---------------- 事件绑定 ----------------
    function initEvents() {
        // 点击对白区推进
        $('#dialogue-area').addEventListener('click', advance);
        $('#game-screen').addEventListener('click', (e) => {
            if (e.target.closest('#top-bar') || e.target.closest('#choice-area')) return;
            if (e.target === e.currentTarget || e.target.id === 'stage' || e.target.id === 'bg-layer' || e.target.id === 'sprite-layer') {
                advance();
            }
        });

        // 顶栏
        document.querySelectorAll('#top-bar .top-btn').forEach(btn => {
            btn.addEventListener('click', () => onMenuAction(btn.dataset.action));
        });

        $('#modal-close').addEventListener('click', closeModal);
        $('#viewer-close').addEventListener('click', closeViewer);
        $('#modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
        $('#viewer').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeViewer();
        });

        // 空格/回车推进
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                if (!$('#game-screen').classList.contains('hidden')) {
                    e.preventDefault();
                    advance();
                }
            }
            if (e.code === 'Escape') {
                closeModal();
                closeViewer();
            }
        });
    }

    // ---------------- 启动 ----------------
    async function init() {
        initLogin();
        initTitleMenu();
        initEvents();
        try {
            const chars = await api('/api/characters');
            chars.forEach(c => { state.characters[c.name] = { color: c.color }; });
        } catch (e) { }
        try {
            state.user = await api('/api/me');
            await enterTitle();
        } catch (e) {
            revealElement($('#login-overlay'));
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
