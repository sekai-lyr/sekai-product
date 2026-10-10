import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ALL_CARDS } from "../js/catalog.js";
import { AUTHORED_CARD_SCENES, DEDICATED_PROCEDURAL_SPELLS, VFX_CARD_PROFILES, getAuthoredScene } from "../js/authored-card-scenes.js";
import { getCardPerformance } from "../js/card-performance.js";

test("independently authored cards cover their actual playable phases", () => {
    const drawings = new Map();
    assert.deepEqual(Object.keys(AUTHORED_CARD_SCENES).sort(), ALL_CARDS.map(c=>c.id).sort());
    for (const [id, scenes] of Object.entries(AUTHORED_CARD_SCENES)) {
        const card = ALL_CARDS.find(card => card.id === id);
        assert.ok(card, id);
        for (const phase of card.type === "monster" ? ["summon", "attack", "destroy"] : ["activate"]) {
            const spec = getAuthoredScene(id, phase);
            assert.ok(spec.beats.length >= 3);
            assert.equal(typeof spec.draw, "function");
            const trace=[];
            const f={from:{x:100,y:500},to:{x:650,y:100},offset:(p,x,y)=>({x:p.x+x,y:p.y+y})};
            for(const method of ["path","ring","orb","line","projectile","sigil","burst","disc","wash","title","trail","blackHole","spellCinematic","artCinematic","worldLineCinematic","storyboardStage","fireDance"]) f[method]=(...args)=>{
                trace.push([method,...args]);
                assert.ok(!JSON.stringify(args).includes("null"), `${id}/${phase}: invalid coordinates`);
            };
            spec.draw(f);
            if(card.type === "spell") assert.ok(trace.some(call=>["blackHole","spellCinematic","artCinematic","worldLineCinematic","storyboardStage","fireDance"].includes(call[0])), `${id}: spell has no effect stage`);
            // Remove timing as well: a delay change alone is not a different scene.
            for(const call of trace){
                const indices={path:[5,6],ring:[3,4],orb:[3,4],line:[4,5],projectile:[4,5],sigil:[4,5],burst:[4,5],disc:[3,4],wash:[1,2],title:[3,4],trail:[4,5],blackHole:[1,2],spellCinematic:[2,3],artCinematic:[2,3],worldLineCinematic:[1,2],storyboardStage:[2,3],fireDance:[2,3]}[call[0]];
                for(const i of indices) call[i+1]="TIME";
            }
            // Compare actual drawing commands with names, IDs, timing and colors removed.
            const fingerprint=JSON.stringify(trace,(_,v)=>typeof v==="string" && /^#[0-9a-f]{6}$/i.test(v)?"COLOR":v);
            assert.ok(!drawings.has(fingerprint), `${id}/${phase} repeats ${drawings.get(fingerprint)}`);
            drawings.set(fingerprint,`${id}/${phase}`);
            // 攻击必须以目标卡位置为基准：改变目标坐标后绘制指令必须随之改变。
            if (phase === "attack") {
                const traceWith=to=>{const calls=[];const g={from:{x:100,y:500},to,offset:(p,x,y)=>({x:p.x+x,y:p.y+y})};
                    for(const method of ["path","ring","orb","line","projectile","sigil","burst","disc","wash","title","trail","fireDance"]) g[method]=(...args)=>calls.push([method,...args]);
                    spec.draw(g);return JSON.stringify(calls);};
                assert.notEqual(traceWith({x:10000,y:20000}), traceWith({x:30000,y:40000}), `${id}/${phase} ignores target position`);
            }
        }
        assert.equal(getCardPerformance(card).production, "authored");
        if(scenes.source) assert.equal(new URL(scenes.source).protocol,"https:");
        if (card.type !== "monster") assert.equal(getAuthoredScene(id, card.type), scenes.activate);
    }
});

test("all playable phases exist and spell/trap cards do not acquire monster attacks", () => {
    let scenes=0;
    for (const card of ALL_CARDS) {
        assert.equal(getCardPerformance(card).production,"authored");
        if(card.type!=="monster") assert.equal(getAuthoredScene(card.id,"attack"),null);
        scenes+=card.type==="monster"?3:1;
    }
    assert.equal(scenes,804);
});

test("all 105 spells have one dedicated visual implementation", async () => {
    const spells=ALL_CARDS.filter(card=>card.type==="spell");
    assert.equal(spells.length,105);
    const spriteSheets=new Map();
    for(const card of spells){
        const profile=VFX_CARD_PROFILES[card.id];
        const procedural=DEDICATED_PROCEDURAL_SPELLS[card.id];
        assert.notEqual(Boolean(profile),Boolean(procedural),`${card.id}: requires exactly one visual implementation`);
        if(!profile) continue;
        assert.ok(profile.ranges && profile.size && profile.rotate && profile.mask,`${card.id}: incomplete profile`);
        assert.ok(!spriteSheets.has(profile.sheet),`${card.id}: shares ${profile.sheet} with ${spriteSheets.get(profile.sheet)}`);
        spriteSheets.set(profile.sheet,card.id);
        await access(fileURLToPath(new URL(`../images/vfx/${profile.sheet}`,import.meta.url)));
    }
    assert.equal(spriteSheets.size,99);
    assert.equal(Object.keys(DEDICATED_PROCEDURAL_SPELLS).length,6);
});
