import React, { useState, useEffect, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { motionValue } from 'framer-motion';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import zhCN from 'folia-upstream/i18n/locales/zh-CN';
import { VISUALIZER_REGISTRY, getVisualizerRegistryEntry } from 'folia-upstream/components/visualizer/registry';
import VisualizerRenderer from 'folia-upstream/components/visualizer/VisualizerRenderer';
import { VISUALIZER_BACKGROUND_REGISTRY, getVisualizerBackgroundRegistryEntry } from 'folia-upstream/components/visualizer/backgrounds/registry';
import { DEFAULT_THEME, DAYLIGHT_THEME } from 'folia-upstream/services/baseThemes';
import * as types from 'folia-upstream/types';
import * as emojiAssets from 'folia-upstream/services/cappellaEmojiPack';
import * as avatarAssets from 'folia-upstream/services/cappellaAvatarPack';
import * as portraitAssets from 'folia-upstream/services/monetPortraitImage';

const i18n = i18next.createInstance();
await i18n.use(initReactI18next).init({ lng: 'zh-CN', fallbackLng: 'zh-CN', resources: { 'zh-CN': { translation: zhCN } }, interpolation: { escapeValue: false } });
const t = (key: string) => String(i18n.t(key));
const defaults = Object.fromEntries(VISUALIZER_REGISTRY.filter(entry => entry.tuningKind !== 'none').map(entry => [entry.mode, types[`DEFAULT_${entry.mode.toUpperCase()}_TUNING`]]));
defaults.tempera = { ...defaults.tempera, wholeLineLyrics: true };

class RenderBoundary extends React.Component<any, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: Error) { console.error('Folia renderer failed', error); window.__foliaGalleryError = error.message; }
    render() { return this.state.failed ? <p role="alert">此演出加载失败，请切换模式或刷新页面。</p> : this.props.children; }
}

export async function mount({ host, settingsHost, rows, audio, seed, title, artist, cover, reducedMotion, mode, renderMode }) {
    const lines = rows.map((row, index) => {
        const startTime = Number(row.dataset.time);
        const fullText = row.querySelector('b')?.textContent.trim() || '';
        const next = rows.slice(index + 1).find(candidate => Number(candidate.dataset.time) > startTime);
        const endTime = Math.max(startTime + .067, Number(next?.dataset.time ?? (Number.isFinite(audio?.duration) ? audio.duration : startTime + 6)));
        const words = Array.from(new Intl.Segmenter(undefined, { granularity: 'word' }).segment(fullText), part => ({ text: part.segment, startTime, endTime: startTime }));
        return { id: `sekai-${index}`, startTime, endTime, fullText, words, isChorus: false,
            renderHints: { rawDuration: endTime - startTime, timingClass: 'normal', renderEndTime: endTime,
                lineTransitionMode: endTime - startTime < .18 ? 'none' : 'normal', wordRevealMode: 'instant' } };
    });
    const currentTime = motionValue(audio?.currentTime || 0);
    const audioPower = motionValue(0);
    const audioBands = { bass: motionValue(0), lowMid: motionValue(0), mid: motionValue(0), vocal: motionValue(0), treble: motionValue(0) };
    const roots = [host, settingsHost].map(element => {
        const shadow = element.attachShadow({ mode: 'open' });
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/js/vendor/folia-gallery/gallery-ui.css?v=20261013';
        const node = document.createElement('div'); node.className = 'folia-root';
        shadow.append(css, node); return createRoot(node);
    });
    const storageKey = 'sekai.folia.gallery.v1';
    let saved;
    try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { saved = {}; }
    let config = { tunings: {}, background: { mode: 'latent' }, light: false, fontScale: 1, ...saved };
    let index = -1, paused = audio?.paused !== false, destroyed = false;
    const assets: any = { cappellaCustomEmojiImages: [], cappellaCustomAvatarImages: [], monetPortraitImage: null };
    const assetActions: any = {};
    const assetDefinitions = [
        ['cappellaCustomEmojiImages', 'CappellaCustomEmojiPack', emojiAssets.getCustomCappellaEmojiPack, emojiAssets.buildStoredCappellaEmojiPack, emojiAssets.saveCustomCappellaEmojiPack, emojiAssets.clearCustomCappellaEmojiPack],
        ['cappellaCustomAvatarImages', 'CappellaCustomAvatar', avatarAssets.getCustomCappellaAvatar, avatarAssets.buildStoredCappellaAvatar, avatarAssets.saveCustomCappellaAvatar, avatarAssets.clearCustomCappellaAvatar],
        ['monetPortraitImage', 'MonetPortraitImage', portraitAssets.getMonetPortraitImage, files => portraitAssets.buildStoredMonetPortraitImage(files[0]), portraitAssets.saveMonetPortraitImage, portraitAssets.clearMonetPortraitImage]
    ];
    function replaceAssets(key, stored) {
        const previous = Array.isArray(assets[key]) ? assets[key] : [assets[key]];
        previous.filter(Boolean).forEach(item => URL.revokeObjectURL(item.url));
        const convert = item => ({ ...item, url: URL.createObjectURL(item.blob) });
        assets[key] = Array.isArray(stored) ? stored.map(convert) : stored ? convert(stored) : null;
    }
    for (const [key, label, get, build, saveAsset, clear] of assetDefinitions as any[]) {
        assetActions[`on${label === 'MonetPortraitImage' ? 'Upload' : 'Import'}${label}`] = async files => {
            if (!files.length || files.some(file => !file.type.startsWith('image/'))) return { ok: false, error: '请选择图片文件' };
            try { const stored = build(files); await saveAsset(stored); replaceAssets(key, stored); draw(); return { ok: true }; }
            catch { return { ok: false, error: '本机图片保存失败，请检查浏览器存储空间' }; }
        };
        assetActions[`onClear${label}`] = async () => { await clear(); replaceAssets(key, key === 'monetPortraitImage' ? null : []); draw(); };
        get().then(stored => { if (!destroyed) { replaceAssets(key, stored); draw(); } }).catch(error => console.warn('Local visualizer assets unavailable', error));
    }
    const entry = getVisualizerRegistryEntry(mode);
    const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(config)); } catch {} };
    let tuningConfig = config;
    let resolvedTunings = { ...defaults, ...Object.fromEntries(Object.entries(config.tunings).map(([key, value]) => [key, { ...defaults[key], ...value }])) };
    const patch = change => { config = { ...config, ...change }; save(); draw(); };
    const tuningPatch = change => patch({ tunings: { ...config.tunings, [mode]: { ...defaults[mode], ...config.tunings[mode], ...change } } });
    const backgroundPatch = (name, change) => patch({ background: { ...config.background, [name]: { ...config.background[name], ...change } } });
    const theme = () => config.light ? DAYLIGHT_THEME : DEFAULT_THEME;
    const capitalize = text => text[0].toUpperCase() + text.slice(1);
    function fittedFontScale() {
        const width = host.clientWidth, height = host.clientHeight;
        const mobileViewport=window.matchMedia('(max-width:900px), (max-height:600px) and (max-width:1100px)').matches&&!!document.documentElement.style.getPropertyValue('--performance-height');
        if(mobileViewport){
            const count=Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(lines[index]?.fullText||'')).length;
            const scale=Math.min(1,width/620,height/360);
            const density=Math.min(1,Math.sqrt(28/Math.max(1,count)));
            return Math.min(Number(config.fontScale)||1,1.8)*Math.max(.25,scale)*density;
        }
        const availableHeight = Math.max(120, height - (width < 600 ? 360 : 230));
        const viewportScale = Math.min(1, availableHeight / 650, width / 1100);
        const count = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(lines[index]?.fullText || '')).length;
        const denseModes = ['classic', 'partita', 'cadenza', 'claddagh'];
        const density = denseModes.includes(mode) ? Math.min(1, Math.sqrt(16 / Math.max(1, count))) : 1;
        // Fit the text, not the full-screen background; resizing keeps the same audio time.
        return Math.min(Number(config.fontScale) || 1, 1.8) * Math.max(.35, viewportScale) * density;
    }
    function settings() {
        const panelProps = { t, ...assets, ...assetActions, cappellaCustomEmojiCount: assets.cappellaCustomEmojiImages.length,
            hasCappellaCustomEmojiPack: assets.cappellaCustomEmojiImages.length > 0, hasCappellaCustomAvatar: assets.cappellaCustomAvatarImages.length > 0,
            isDaylight: config.light, theme: theme(), controlCardBg: 'rgba(255,255,255,.04)', rangeInputClass: 'w-full accent-orange-300',
            [`${mode}Tuning`]: { ...defaults[mode], ...config.tunings[mode] }, [`on${capitalize(mode)}TuningChange`]: tuningPatch };
        const backgroundEntry = getVisualizerBackgroundRegistryEntry(config.background.mode);
        const actions: any = { onModeChange: value => patch({ background: { ...config.background, mode: value } }),
            common: {
                onCoverColorChange: value => backgroundPatch('common', { useCoverColorBg: value }),
                onOpacityChange: value => backgroundPatch('common', { opacity: value }),
                onDisableGeometricChange: value => backgroundPatch('common', { disableGeometricBackground: value }),
                onDisableVignetteChange: value => backgroundPatch('common', { disableVignette: value })
            }
        };
        for (const name of ['latent', 'monet', 'nomand', 'sora']) actions[name] = {
            onTuningChange: change => backgroundPatch(name, { tuning: { ...types[`DEFAULT_${name.toUpperCase()}_BACKGROUND_TUNING`], ...config.background[name]?.tuning, ...change } }),
            onResetTuning: () => backgroundPatch(name, { tuning: types[`DEFAULT_${name.toUpperCase()}_BACKGROUND_TUNING`] })
        };
        return <div className="settings-content" style={{ '--text-primary': theme().primaryColor, '--text-secondary': theme().secondaryColor } as React.CSSProperties}>
            <div className="settings-intro"><span>FOLIa / {entry.labelFallback}</span><button onClick={() => patch({ tunings: { ...config.tunings, [mode]: defaults[mode] } })}>恢复此演出默认值</button></div>
            <div className="settings-common">
                <label>配色<select value={String(config.light)} onChange={e => patch({ light: e.target.value === 'true' })}><option value="false">午夜墨染</option><option value="true">日光素白</option></select></label>
                <label>歌词字号<input type="range" min="0.5" max="1.8" step=".05" value={config.fontScale} onChange={e => patch({ fontScale: Number(e.target.value) })}/></label>
            </div>
            {entry.renderSettingsPanel?.(panelProps) || <p>此演出没有独立参数，使用原版默认布局。</p>}
            <details><summary>背景效果</summary>
                <label>背景类型<select value={config.background.mode} onChange={e => actions.onModeChange(e.target.value)}>{VISUALIZER_BACKGROUND_REGISTRY.filter(item => item.mode !== 'url').map(item => <option key={item.mode} value={item.mode}>{t(item.labelKey)}</option>)}</select></label>
                {backgroundEntry.renderSettingsPanel?.({ ...panelProps, config: config.background, actions })}
            </details>
            <p className="settings-note">普通 LRC 按整句时间同步；逐字精度取决于歌词文件。<a href="/js/vendor/FOLIA-LICENSE.txt" target="_blank">开源许可</a> · <a href="/js/vendor/folia-sekai-source.zip" download>对应源码</a></p>
        </div>;
    }
    function draw() {
        if (destroyed) return;
        if (tuningConfig !== config) {
            tuningConfig = config;
            resolvedTunings = { ...defaults, ...Object.fromEntries(Object.entries(config.tunings).map(([key, value]) => [key, { ...defaults[key], ...value }])) };
        }
        const shared: any = { ...assets, currentTime, currentLineIndex: index, lines, theme: theme(), isDaylight: config.light, audioPower, audioBands,
            seed, songTitle: title, songArtist: artist, coverUrl: cover, paused,
            staticMode: reducedMotion, backgroundStaticMode: reducedMotion,
            lyricsFontScale: fittedFontScale(), background: config.background,
            visualizerTunings: resolvedTunings,
            subtitleContentMode: 'none', showSubtitleTranslation: false,
            onLyricLineSeek: t => { if (audio && Number.isFinite(audio.duration)) audio.currentTime = t; },
            [`on${capitalize(mode)}TuningChange`]: tuningPatch,
            isPreviewMode: true
        };
        const wrap = content => <I18nextProvider i18n={i18n}><RenderBoundary><Suspense fallback={<p className="loading">正在准备演出…</p>}>{content}</Suspense></RenderBoundary></I18nextProvider>;
        const rendererKey = mode === 'tempera' ? `${mode}:${host.clientWidth}:${host.clientHeight}` : mode;
        roots[0].render(wrap(<VisualizerRenderer key={rendererKey} mode={mode} {...shared}/>));
        roots[1].render(wrap(settings()));
    }
    draw();
    const resize = new ResizeObserver(() => { if (!destroyed) flushSync(draw); });
    resize.observe(host);
    return {
        apply(time) {
            const nextIndex = lines.findLastIndex(line => line.startTime <= time);
            const nextPaused = renderMode || audio?.paused !== false;
            currentTime.set(time);
            if (index !== nextIndex || paused !== nextPaused) {
                index = nextIndex; paused = nextPaused;
                flushSync(draw);
            }
            // Newly mounted upstream words subscribe after the seek has updated time.
            // Re-publish the same audio time so paused/fixed-frame lyrics initialize too.
            currentTime.notifyChange();
            // Share the existing audio graph: a media element must never have two sources.
            const spectrum = window.__sekaiAudioSpectrum?.();
            if (spectrum) {
                audioPower.set(spectrum.power); audioBands.bass.set(spectrum.bass);
                audioBands.mid.set(spectrum.mid); audioBands.treble.set(spectrum.treble);
                audioBands.lowMid.set(spectrum.lowMid); audioBands.vocal.set(spectrum.vocal);
            }
            host.dataset.activeLine = String(index);
            host.dataset.activeText = lines[index]?.fullText || '';
        },
        destroy() { destroyed = true; resize.disconnect(); Object.keys(assets).forEach(key => replaceAssets(key, null)); roots.forEach(root => root.unmount()); currentTime.destroy(); audioPower.destroy(); Object.values(audioBands).forEach(value => value.destroy()); },
        program: { lines: lines.length, mode, engine: 'Folia upstream React', lossless: lines.every(line => line.words.map(word => word.text).join('') === line.fullText) }
    };
}
