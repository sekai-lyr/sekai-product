(() => {
    'use strict';
    const panels = [...document.querySelectorAll('.performance-panel')];
    const compact=window.matchMedia('(max-width: 900px), (max-height: 600px) and (max-width: 1100px)');
    const topControls=[document.querySelector('.performance-actions'),document.querySelector('.stage-view-switcher')].filter(Boolean);
    const bottomControls=document.querySelector('.lyric-player-bar,.stage-controls');
    function fitViewport(){
        if(!compact.matches)return;
        const height=window.visualViewport?.height||window.innerHeight;
        const top=Math.max(0,...topControls.map(node=>node.getBoundingClientRect().bottom))+10;
        const bottom=bottomControls?Math.max(0,height-bottomControls.getBoundingClientRect().top)+10:12;
        document.documentElement.style.setProperty('--performance-top',top+'px');
        document.documentElement.style.setProperty('--performance-bottom',bottom+'px');
        document.documentElement.style.setProperty('--performance-height',Math.max(40,height-top-bottom)+'px');
    }
    const viewportObserver=new ResizeObserver(fitViewport);
    [...topControls,bottomControls].filter(Boolean).forEach(node=>viewportObserver.observe(node));
    window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);
    window.addEventListener('pagehide',()=>{viewportObserver.disconnect();window.removeEventListener('resize',fitViewport);window.visualViewport?.removeEventListener('resize',fitViewport);},{once:true});
    fitViewport();
    function closePanels() {
        panels.forEach(panel => panel.hidden = true);
        document.querySelectorAll('.performance-actions button').forEach(button => button.setAttribute('aria-expanded', 'false'));
    }
    for (const [toggle, id] of [['performance', 'performance-settings'], ['song', 'song-settings']]) {
        const button = document.querySelector(`[data-${toggle}-settings-toggle]`);
        button?.addEventListener('click', () => {
            const panel = document.getElementById(id), open = panel.hidden;
            closePanels(); panel.hidden = !open; button.setAttribute('aria-expanded', String(open));
            if (open) panel.querySelector('[data-panel-close]')?.focus();
        });
    }
    panels.forEach(panel => panel.querySelector('[data-panel-close]')?.addEventListener('click', () => {
        closePanels(); document.querySelector(`[aria-controls="${panel.id}"]`)?.focus();
    }));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closePanels(); });
    const parent = window.parent !== window ? window.parent.document : null;
    const back = document.querySelector('[data-performance-back]');
    if (parent && back) {
        const link = parent.querySelector('.section-title>a');
        back.href = link?.getAttribute('href') || '/songs'; back.textContent = `‹ ${link?.textContent || '返回歌曲库'}`;
        back.target = '_parent';
    }
    const ids = { lyrics: 'local-lrc', cover: 'local-cover', cloud: 'local-cloud', favorite: 'local-favorite' };
    document.querySelectorAll('[data-local-setting]').forEach(button => button.addEventListener('click', () => {
        const target = parent?.getElementById(ids[button.dataset.localSetting]);
        if (target) { target.click(); closePanels(); }
    }));
})();
