import test from "node:test";
import assert from "node:assert/strict";

import { SITE_THEMES, normalizeSiteTheme } from "../js/site-theme.js";

test("全站提供四种稳定主题标识", () => {
    assert.deepEqual(Object.keys(SITE_THEMES), ["a", "b", "c", "d"]);
});

test("未知主题安全回退到深色作战舱", () => {
    assert.equal(normalizeSiteTheme("c"), "c");
    assert.equal(normalizeSiteTheme("unknown"), "b");
    assert.equal(normalizeSiteTheme(null), "b");
});
