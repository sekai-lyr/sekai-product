(() => {
    const list = document.getElementById('anime-archive-list');
    if (!list || list.dataset.reorder !== 'true') return;
    const save = document.getElementById('save-anime-order');
    const message = document.getElementById('anime-order-message');
    let dragged = null;
    let saving = false;
    let dirty = list.dataset.initialDirty === 'true';
    const cards = () => Array.from(list.children);
    const ids = () => cards().map(card => Number(card.dataset.animeId));
    function changed() {
        cards().forEach((card, index) => {
            card.querySelector('[data-order-position]').value = index + 1;
        });
        dirty = true;
        save.disabled = false;
        message.textContent = '顺序已调整，尚未保存。';
    }
    list.addEventListener('click', event => {
        const button = event.target.closest('[data-move-anime]');
        if (!button || saving) return;
        const card = button.closest('[data-anime-id]');
        const input = card.querySelector('[data-order-position]');
        if (!input.reportValidity()) return;
        const position = Number(input.value);
        const current = cards();
        const oldPosition = current.indexOf(card);
        if (position === oldPosition + 1) return;
        const target = current[position - 1];
        if (position - 1 > oldPosition) target.after(card);
        else target.before(card);
        changed();
        card.scrollIntoView({block: 'nearest'});
    });
    list.addEventListener('dragstart', event => {
        if (saving || !event.target.closest('[data-drag-handle]')) {
            event.preventDefault();
            return;
        }
        dragged = event.target.closest('[data-anime-id]');
        dragged.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', dragged.dataset.animeId);
    });
    list.addEventListener('dragover', event => {
        if (!dragged) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const target = event.target.closest('[data-anime-id]');
        if (!target || target === dragged) return;
        const rect = target.getBoundingClientRect();
        const before = ids().join(',');
        if (event.clientY < rect.top + rect.height / 2) target.before(dragged);
        else target.after(dragged);
        if (before !== ids().join(',')) changed();
    });
    list.addEventListener('drop', event => {
        if (dragged) event.preventDefault();
    });
    list.addEventListener('dragend', () => {
        if (dragged) dragged.classList.remove('is-dragging');
        dragged = null;
    });
    save.addEventListener('click', async () => {
        if (saving) return;
        saving = true;
        save.disabled = true;
        message.textContent = '正在保存顺序…';
        try {
            const response = await fetch('/anime/order', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(ids())
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '保存失败，请重试。');
            dirty = false;
            const url = new URL(window.location.href);
            url.searchParams.delete('sort');
            url.searchParams.delete('autoSort');
            window.history.replaceState(null, '', url);
            document.querySelectorAll('a[href]').forEach(link => {
                const target = new URL(link.href, window.location.origin);
                if (target.origin === window.location.origin && target.pathname === '/anime') {
                    target.searchParams.delete('sort');
                    target.searchParams.delete('autoSort');
                    link.href = target.pathname + target.search;
                }
            });
            const sortSelect = document.getElementById('anime-sort');
            if (sortSelect) {
                sortSelect.value = 'default';
                sortSelect.dispatchEvent(new Event('change'));
            }
            document.querySelectorAll('input[name="returnTo"]').forEach(input => {
                const target = new URL(input.value, window.location.origin);
                target.searchParams.delete('sort');
                target.searchParams.delete('autoSort');
                input.value = target.pathname + target.search;
            });
            message.textContent = result.message;
        } catch (error) {
            message.textContent = error.message || '保存失败，请重试。';
            save.disabled = false;
        } finally {
            saving = false;
        }
    });
    window.addEventListener('beforeunload', event => {
        if (dirty) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
})();
