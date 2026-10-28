// Each category is evaluated independently; these policies never inspect other cards.
export const ART_POLICIES = {
    monster: { name: '角色卡', weights: { anime: .5, general: .3, technical: .2 }, thresholds: { R: 4, SR: 5, SSR: 6, UR: 7 } },
    spell: { name: '魔法卡', weights: { anime: 0, general: .8, technical: .2 }, thresholds: { R: 4, SR: 5, SSR: 6, UR: 7 } },
    trap: { name: '陷阱卡', weights: { anime: 0, general: .85, technical: .15 }, thresholds: { R: 4, SR: 5, SSR: 6, UR: 7 } },
};

export function rateCardArt(row) {
    const policy = ART_POLICIES[row.type];
    if (!policy) throw new Error(`Unknown card category: ${row.type}`);
    for (const key of ['animeScore', 'generalScore', 'technicalScore', 'width', 'height', 'sharpnessVariance']) {
        if (!Number.isFinite(row[key])) throw new Error(`Missing measurement: ${row.id}/${key}`);
    }
    const resolution = Math.min(10, Math.min(row.width, row.height) / 64);
    const detail = Math.min(10, Math.max(0, Math.log1p(row.sharpnessVariance) / Math.log(1001) * 10));
    // Landscape magic/trap art can deliberately contain dark shadows or white flashes.
    // Do not penalize those intentional regions using portrait exposure assumptions.
    const technical = row.type === 'monster' ? row.technicalScore : .4 * resolution + .6 * detail;
    const { anime, general, technical: technicalWeight } = policy.weights;
    const score = Number((anime * row.animeScore + general * row.generalScore + technicalWeight * technical).toFixed(6));
    const { R, SR, SSR, UR } = policy.thresholds;
    const rarity = score >= UR ? 'UR' : score >= SSR ? 'SSR' : score >= SR ? 'SR' : score >= R ? 'R' : 'N';
    return { category: row.type, rarity, score, categoryTechnicalScore: Number(technical.toFixed(6)), imageSha256: row.imageSha256 };
}
