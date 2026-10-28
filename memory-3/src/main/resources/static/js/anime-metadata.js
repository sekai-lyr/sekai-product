document.querySelectorAll('[data-match-anime]').forEach(button => {
    const form = button.closest('form');
    const message = form.querySelector('[data-match-message]');
    const titleInput = form.elements.namedItem('title');
    const fields = ['coverUrl', 'type', 'tags', 'releaseDate', 'totalEpisodes'];
    const filled = new Map();
    const candidates = document.createElement('div');
    candidates.className = 'metadata-candidates';
    message.after(candidates);
    const selectedId = document.createElement('input');
    selectedId.type = 'hidden';
    selectedId.name = 'metadataSubjectId';
    form.append(selectedId);
    let generation = 0;
    let controller = null;

    function apply(candidate) {
        const anime = candidate.anime;
        let preserved = false;
        for (const field of fields) {
            const input = form.elements.namedItem(field);
            if (!input) continue;
            if (!input.value.trim() || input.value === filled.get(field)) {
                input.value = anime[field] == null ? '' : anime[field];
                filled.set(field, input.value);
            } else {
                preserved = true;
            }
        }
        titleInput.value = anime.title;
        selectedId.value = candidate.subjectId;
        const cover = form.querySelector('[data-match-cover]');
        cover.hidden = !form.elements.namedItem('coverUrl').value;
        if (!cover.hidden) cover.src = form.elements.namedItem('coverUrl').value;
        candidates.querySelectorAll('[data-subject-id]').forEach(item => {
            item.setAttribute('aria-pressed', String(item.dataset.subjectId === String(candidate.subjectId)));
        });
        message.textContent = `已选：${anime.title} · ${anime.type || '类型未知'} · ${anime.releaseDate || '日期待公布'} · ${anime.totalEpisodes || '未知'} 集。${preserved ? '已有填写内容已保留，仅补充空白字段。' : ''}确认后保存。`;
    }

    titleInput.addEventListener('input', () => {
        generation++;
        controller?.abort();
        button.disabled = false;
        selectedId.value = '';
        candidates.replaceChildren();
        for (const [field, value] of filled) {
            const input = form.elements.namedItem(field);
            if (input && input.value === value) input.value = '';
        }
        filled.clear();
        form.querySelector('[data-match-cover]').hidden = true;
        message.textContent = '';
    });

    button.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        if (!title) {
            message.textContent = '请输入番剧名称，可以带季数、简称或副标题。';
            return;
        }
        const requestGeneration = ++generation;
        controller?.abort();
        controller = new AbortController();
        button.disabled = true;
        candidates.replaceChildren();
        message.textContent = '正在搜索名称和别名，网络较慢时会自动重试…';
        try {
            const response = await fetch('/anime/metadata', {
                method: 'POST', body: new URLSearchParams({title}), signal: controller.signal
            });
            const result = await response.json();
            if (requestGeneration !== generation) return;
            if (!response.ok) throw new Error(result.message || '匹配失败，请稍后重试。');
            const heading = document.createElement('p');
            heading.className = 'form-hint';
            heading.textContent = '匹配结果 · 请核对季数和版本';
            candidates.append(heading);
            for (const candidate of result.candidates) {
                const anime = candidate.anime;
                const choice = document.createElement('button');
                choice.type = 'button';
                choice.className = 'metadata-candidate';
                choice.dataset.subjectId = candidate.subjectId;
                choice.setAttribute('aria-pressed', 'false');
                if (anime.coverUrl) {
                    const img = document.createElement('img');
                    img.src = anime.coverUrl;
                    img.alt = '';
                    img.loading = 'lazy';
                    img.referrerPolicy = 'no-referrer';
                    img.addEventListener('error', () => img.remove());
                    choice.append(img);
                }
                const text = document.createElement('span');
                const name = document.createElement('strong');
                name.textContent = anime.title;
                const info = document.createElement('span');
                info.textContent = `${anime.type || '类型未知'} · ${anime.releaseDate || '日期待公布'} · ${anime.totalEpisodes || '未知'} 集`;
                const hint = document.createElement('small');
                hint.textContent = `${candidate.matchReason} · 点击选用`;
                text.append(name, info, hint);
                choice.append(text);
                choice.addEventListener('click', () => apply(candidate));
                candidates.append(choice);
            }
            const recommended = result.candidates.find(item => item.subjectId === result.recommendedSubjectId);
            if (recommended) apply(recommended);
            else message.textContent = '找到多个相关作品，请从下方选择对应季数或版本，选择后填入资料。';
        } catch (error) {
            if (error.name !== 'AbortError' && requestGeneration === generation) {
                message.textContent = error.message || '网络异常，请稍后重试。';
            }
        } finally {
            if (requestGeneration === generation) button.disabled = false;
        }
    });
});
