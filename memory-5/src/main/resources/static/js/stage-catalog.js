(() => {
    'use strict';
    window.SekaiStages = [
        { id: 'disc', name: '唱片舞台', detail: '封面唱片 · 同步歌词' },
        { id: 'lyrics', name: '字符飘动演出', detail: '自由分布 · 轻盈飘动' },
        { id: 'folia-classic', name: '字符矩阵演出', detail: '几何字块 · 空间构图' },
        { id: 'folia', name: '字符浮现演出', detail: '文字镜头 · 浮现转场' },
        { id: 'folia-sonnet', engine: 'sonnet', name: '商籁演出', detail: 'FOLIa · Sonnet' },
        { id: 'folia-tempera', engine: 'tempera', name: '凝彩演出', detail: 'FOLIa · Tempera' },
        { id: 'folia-lumiere', engine: 'lumiere', name: '绘光演出', detail: 'FOLIa · Lumiere' },
        { id: 'folia-luminous', engine: 'classic', name: '流光演出', detail: 'FOLIa · Luminous' },
        { id: 'folia-cadenza', engine: 'cadenza', name: '心象演出', detail: 'FOLIa · Mindscape' },
        { id: 'folia-partita', engine: 'partita', name: '云阶演出', detail: 'FOLIa · Partita' },
        { id: 'folia-fume', engine: 'fume', name: '浮名演出', detail: 'FOLIa · Fume' },
        { id: 'folia-tilt', engine: 'tilt', name: '倾诉演出', detail: 'FOLIa · Tilt' },
        { id: 'folia-claddagh', engine: 'claddagh', name: '回环演出', detail: 'FOLIa · Claddagh' },
        { id: 'folia-monet', engine: 'monet', name: '莫奈演出', detail: 'FOLIa · Monet' },
        { id: 'folia-pendolo', engine: 'pendolo', name: '时计演出', detail: 'FOLIa · Pendolo' },
        { id: 'folia-cappella', engine: 'cappella', name: '群唱演出', detail: 'FOLIa · Cappella' },
        { id: 'folia-diorama', engine: 'diorama', name: '镜台演出', detail: 'FOLIa · Diorama' },
        { id: 'folia-still', engine: 'still', name: '静止演出', detail: 'FOLIa · Still' },
        { id: 'derived-stars', engine: 'stars', derived: true, name: '星轨演出', detail: '银河长曝光 · 暮色入夜' },
        { id: 'derived-fold', engine: 'fold', derived: true, name: '折页演出', detail: '立体纸面 · 折痕展开' },
        { id: 'derived-sea', engine: 'sea', derived: true, name: '镜海演出', detail: '月光水镜 · 波纹折射' },
        { id: 'derived-dialogue', engine: 'dialogue', derived: true, name: '对白演出', detail: '双侧分镜 · 对白接续' },
        { id: 'derived-gather', engine: 'gather', derived: true, name: '聚散演出', detail: '字符风暴 · 弧线汇聚' }
    ];
    const selector = document.querySelector('#local-mode');
    if (selector) selector.replaceChildren(...window.SekaiStages.map(item => new Option(item.name, item.id)));
    const menu = document.querySelector('[data-stage-view-menu]');
    if (menu) {
        menu.replaceChildren();
        for (const [index, item] of window.SekaiStages.entries()) {
            const link = document.createElement('a'); link.href = '#'; link.dataset.stageViewOption = item.id;
            const name = document.createElement('strong'); name.textContent = `${String(index + 1).padStart(2, '0')} · ${item.name}`;
            const detail = document.createElement('span'); detail.textContent = item.detail;
            link.append(name, detail); menu.append(link);
        }
    }
})();
