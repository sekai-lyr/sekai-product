import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

/**
 * 抽卡 PV 演出（角色特写快切）测试
 * jsdom 没有 Web Animations API，先给 Element.animate 打桩，再动态导入模块。
 */
async function bootDom() {
    const dom = new JSDOM(`<!doctype html><html><body><div id="stage"></div></body></html>`, { pretendToBeVisual: true });
    const w = dom.window;
    w.Element.prototype.animate = () => ({
        cancel() {}, finish() {}, play() {}, pause() {}, commitStyles() {},
        finished: Promise.resolve(), currentTime: 0, startTime: 0, playState: "running",
    });
    w.Element.prototype.getAnimations = () => [];
    if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    global.window = w;
    global.document = w.document;
    global.HTMLElement = w.HTMLElement;
    global.Element = w.Element;
    global.Node = w.Node;
    global.NodeList = w.NodeList;
    global.HTMLCollection = w.HTMLCollection;
    global.SVGElement = w.SVGElement;
    global.getComputedStyle = w.getComputedStyle.bind(w);
    // anime.js 的引擎在模块加载时就要用 rAF
    global.requestAnimationFrame = w.requestAnimationFrame
        ? w.requestAnimationFrame.bind(w) : cb => setTimeout(() => cb(Date.now()), 16);
    global.cancelAnimationFrame = w.cancelAnimationFrame
        ? w.cancelAnimationFrame.bind(w) : id => clearTimeout(id);
    global.performance = w.performance || globalThis.performance;
    // anime.js waapi 会用到 CSS 工具（registerProperty / supports），jsdom 未暴露
    global.CSS = w.CSS || {
        supports: () => false,
        registerProperty: () => {},
        escape: value => String(value),
        number: value => String(value),
        px: value => `${value}px`,
        deg: value => `${value}deg`,
    };
    w.CSS = w.CSS || global.CSS;
    return dom;
}

const mkCard = (id, rarity, attribute = "dark") => ({
    id, name: `角色-${id}`, rarity, attribute, type: "monster",
    image: "./assets/cards/webp/thumb/x.webp", fullImage: "./assets/cards/webp/card/x.webp",
});

test("抽卡 PV 演出 · 角色特写快切", async t => {
    await bootDom();
    const { playPackPvShowcase } = await import("../js/card-ignition.js");
    const stage = document.getElementById("stage");

    await t.test("生成快切层，每个抽到的卡一段，含名字/属性/稀有度", () => {
        stage.innerHTML = "";
        const cards = [mkCard("a", "SR"), mkCard("b", "UR"), mkCard("c", "SR")];
        const handle = playPackPvShowcase(stage, cards, { limit: 6 });
        const layer = stage.querySelector(".pack-pv-layer");
        assert.ok(layer, "应创建 .pack-pv-layer");
        const cuts = layer.querySelectorAll(".pack-pv-cut");
        assert.equal(cuts.length, 3);
        const first = cuts[0];
        assert.equal(first.querySelector(".pack-pv-name").textContent, "角色-b"); // UR 排最前
        assert.equal(first.querySelector(".pack-pv-rar").textContent, "UR");
        assert.equal(first.querySelector(".pack-pv-attr").textContent, "暗");
        assert.ok(first.querySelector(".pack-pv-art img"), "应渲染卡图");
        // 图片要立刻加载，快切节奏下 lazy 会漏载（jsdom 下属性/特性可能不同步，两者其一即可）
        const img = first.querySelector("img");
        assert.ok(img.loading === "eager" || img.getAttribute("loading") === "eager", "图片应为即时加载");
        handle.cancel();
        assert.equal(stage.querySelector(".pack-pv-layer"), null, "cancel 后应移除图层");
    });

    await t.test("按稀有度从高到低排序，并受 limit 限制", () => {
        stage.innerHTML = "";
        const cards = [
            mkCard("n1", "N"), mkCard("r1", "R"), mkCard("ur1", "UR"),
            mkCard("sr1", "SR"), mkCard("ssr1", "SSR"), mkCard("n2", "N"), mkCard("sr2", "SR"),
        ];
        const handle = playPackPvShowcase(stage, cards, { limit: 4 });
        const names = [...stage.querySelectorAll(".pack-pv-rar")].map(el => el.textContent);
        assert.deepEqual(names, ["UR", "SSR", "SR", "SR"]);
        handle.cancel();
    });

    await t.test("无重复卡：同一张卡只出现一次", () => {
        stage.innerHTML = "";
        const dup = mkCard("x", "SSR");
        const handle = playPackPvShowcase(stage, [dup, dup, mkCard("y", "R")], { limit: 6 });
        assert.equal(stage.querySelectorAll(".pack-pv-cut").length, 2);
        handle.cancel();
    });

    await t.test("尊重 reducedMotion：不插入演出层", () => {
        stage.innerHTML = "";
        const handle = playPackPvShowcase(stage, [mkCard("a", "UR")], { reducedMotion: true });
        assert.equal(stage.querySelector(".pack-pv-layer"), null);
        assert.equal(typeof handle.cancel, "function");
    });

    await t.test("空卡组 / 无效 root 不报错", () => {
        assert.doesNotThrow(() => playPackPvShowcase(stage, [], {}));
        assert.doesNotThrow(() => playPackPvShowcase(null, [mkCard("a", "UR")], {}));
    });
});
