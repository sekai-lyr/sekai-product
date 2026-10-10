/**
 * card-images.js
 * 卡图派生路径。
 *
 * 卡池原始图单张平均 1.39 MB、合计约 1.0 GB，直接下发在移动端完全不可用。
 * 构建期已按**相同相对路径**生成两档 WebP：
 *   assets/cards/webp/thumb/...   宽 320px  q72  —— 手牌、场上、收藏网格、卡组编辑器
 *   assets/cards/webp/card/...    宽 640px  q80  —— 详情弹窗、卡包演出
 *
 * 这里用纯路径约定做映射，避免额外维护一份 368 条的清单；万一某个文件缺失或
 * 损坏，ui.js 的图片兜底逻辑会回退到原始图（originalImage）。
 */

const WEBP_ROOT = "./assets/cards/webp/";
const SOURCE_PREFIX = "assets/cards/";

export function cardImageSrc(image, tier = "thumb") {
    if (!image || typeof image !== "string") return image || "";
    const rel = image.replace(/^\.\//, "").split("?")[0];
    if (!rel.startsWith(SOURCE_PREFIX)) return image;
    const rest = rel.slice(SOURCE_PREFIX.length).replace(/\.[a-z0-9]+$/i, "");
    if (rest.startsWith("webp/")) return image;
    return `${WEBP_ROOT}${tier}/${rest}.webp`;
}

/** 给一张卡加上派生图片字段：image/thumbnail = 缩略图，fullImage = 大图，originalImage = 原始图。 */
export function applyCardImageSources(card) {
    if (!card || typeof card !== "object" || !card.image) return card;
    const original = card.originalImage || card.image;
    const thumbnail = cardImageSrc(original, "thumb");
    return {
        ...card,
        originalImage: original,
        thumbnail,
        image: thumbnail,
        fullImage: cardImageSrc(original, "card"),
    };
}

export function withCardImageSources(cards) {
    return (cards || []).map(applyCardImageSources);
}
