(() => {
    'use strict';
    if (!document.body.classList.contains('local-playback-page')) return;
    const main = document.querySelector('.local-player-content');
    const workspace = document.querySelector('#local-workspace');
    const tools = document.createElement('details');
    tools.className = 'playback-file-tools';
    const summary = document.createElement('summary');
    summary.textContent = '关联文件、补充素材与歌单检查';
    tools.append(summary);
    main.querySelectorAll(':scope > header.local-toolbar, :scope > .local-import-guide, :scope > #local-import-panel, :scope > #local-link-panel, :scope > section[aria-label="歌单缺失检查"]').forEach(node => tools.append(node));
    workspace.after(tools);
    const controls = document.querySelector('#local-playback-tools');
    workspace.before(controls);
    const notice = document.querySelector('.local-statistics-notice');
    if (notice) main.append(notice);
    const status = document.querySelector('#local-status');
    new MutationObserver(() => {
        if (/请重新关联|需要恢复本机授权|文件不可用/.test(status.textContent)) tools.open = true;
    }).observe(status, {childList:true,subtree:true});
})();
