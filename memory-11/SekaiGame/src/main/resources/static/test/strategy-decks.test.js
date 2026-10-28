import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, Player, createCardInstance } from '../js/model.js';
import { GameEngine } from '../js/engine.js';
import { GameController } from '../js/controller.js';
import { ALL_CARDS, getCardById } from '../js/catalog.js';
import { STRATEGY_DECKS } from '../js/strategy-decks.js';
import { STRATEGY_PILOT_IDS } from '../js/strategy-card-rules.js';
import { validateDeck } from '../js/deck.js';
import { calculateMatchReward } from '../js/rewards.js';
import { applyAilment, removeAilment } from '../js/status-effects.js';
const monster = (id='fixture') => createCardInstance({id,name:id,type:'monster',level:3,attack:1000,defense:1000,attribute:'earth',effects:[]});
function setup(){const s=new GameState();s.players=[new Player('A',[]),new Player('B',[])];s.turn=3;s.firstTurn=false;s.phase='main_1';const e=new GameEngine(s,()=>.3);return {s,e,p:s.players[0],o:s.players[1]};}
function field(p,id){const c=createCardInstance(getCardById(id));c.canAttack=true;p.monsterZone.push(c);return c;}
function use(e,p,c,index=0,target=null){return e.triggerAllEffects(p,c,'manual',{effectIndex:index,selectedTarget:target});}
test('三套借用卡组均为合法40张且卡牌全部存在',()=>{for(const d of STRATEGY_DECKS){assert.equal(d.main.length,40);const v=validateDeck(d,ALL_CARDS);assert.equal(v.valid,true,v.errors.join(';'));assert.ok(d.main.some(id=>getCardById(id).type==='monster'&&getCardById(id).level<=4));assert.ok(d.core.every(id=>d.main.includes(id)));}});
test('11张试点卡均有明确的定位、代价、反制与同步描述',()=>{assert.equal(STRATEGY_PILOT_IDS.length,11);for(const id of STRATEGY_PILOT_IDS){const c=getCardById(id);assert.ok(c.strategyDesign.role&&c.strategyDesign.tradeoff&&c.strategyDesign.counter);assert.ok(c.effects.every(e=>c.description.includes(e.description)));}});
test('电磁炮蓄力不足不扣LP、不消耗次数',()=>{const {e,p,o}=setup();const c=field(p,'picture_ssr7_010');o.monsterZone.push(monster());assert.equal(use(e,p,c),null);assert.equal(p.lp,8000);assert.equal(p.themedUses?.[`${c.id}:0`],undefined);});
test('电磁炮消耗两次蓄力及对应增益，保留其他增益',()=>{const {s,e,p,o}=setup();const c=field(p,'picture_ssr7_010');const t=monster();o.monsterZone.push(t);use(e,p,c,1);s.turn+=2;use(e,p,c,1);c.permanentBuffs.push({type:'attack',value:300,source:'other'});p._recalcCardStats(c);assert.equal(c.currentAttack,c.attack+700);assert.ok(use(e,p,c,0,t));assert.equal(c.themedState.charges,0);assert.equal(c.currentAttack,c.attack+300);assert.equal(p.lp,7300);assert.ok(o.banished.includes(t));assert.equal(use(e,p,c,0),null);});
test('蓄力后离场重置资源，不能带着蓄力重新登场',()=>{const {e,p}=setup();const c=field(p,'picture_ssr7_010');use(e,p,c,1);e.resetFieldCard(c);assert.equal(c.themedState?.charges,undefined);assert.equal(c.currentAttack,c.attack);});
test('一闪准备回合不能攻击，下一回合释放可攻击两次',()=>{const {s,e,p}=setup();const c=field(p,'picture_ex_021');assert.ok(use(e,p,c));s.phase='battle';assert.equal(e.attack(c,'player').success,false);s.turn+=2;p.resetTurnState();s.phase='main_1';assert.ok(use(e,p,c));assert.equal(c.themedState.charges,0);s.phase='battle';assert.equal(e.attack(c,'player').success,true);assert.equal(e.attack(c,'player').success,true);assert.equal(e.attack(c,'player').success,false);});
test('已有蓄力但LP不够时不消耗资源',()=>{const {e,p}=setup();const c=field(p,'picture_ex_021');c.themedState={charges:1};p.lp=400;assert.equal(use(e,p,c),null);assert.equal(c.themedState.charges,1);assert.equal(p.lp,400);});
test('引爆必须先点燃，净化后不能凭空引爆',()=>{const {e,p,o}=setup();const c=field(p,'picture_ex_027'),t=monster();o.monsterZone.push(t);assert.equal(use(e,p,c),null);applyAilment(t,'burn',2,250);removeAilment(t,'burn');assert.equal(use(e,p,c),null);assert.equal(o.lp,8000);});
test('引爆消耗现有灼烧并准确结算，不附赠新灼烧',()=>{const {e,p,o}=setup();const c=field(p,'picture_ex_027'),t=monster();o.monsterZone.push(t);applyAilment(t,'burn',2,250);assert.ok(use(e,p,c,0,t));assert.equal(o.lp,6800);assert.equal(Number(t.themedState.statuses.burn)||0,0);assert.ok(o.monsterZone.includes(t));});
test('合奏需要两种属性和墓地资源，发动后放弃攻击',()=>{const {e,p}=setup();const c=field(p,'picture_ex_094');assert.equal(use(e,p,c),null);p.monsterZone.push(monster());const g=monster('墓地');p.graveyard.push(g);p.deck.push(monster('抽卡'));assert.ok(use(e,p,c));assert.equal(c.position,'defense');assert.equal(c.canAttack,false);assert.equal(c.hasAttackedThisTurn,true);assert.equal(p.hand.length,1);assert.ok(p.deck.includes(g));assert.equal(p.graveyard.length,0);});
test('合奏本回合已经攻击则不能再换取抽卡',()=>{const {e,p}=setup();const c=field(p,'picture_ex_094');p.monsterZone.push(monster());p.graveyard.push(monster());c.hasAttackedThisTurn=true;assert.equal(use(e,p,c),null);});
test('AI不会为了合奏或蓄力放弃已知的直接致胜机会',()=>{const {s,e,p,o}=setup();const c=field(p,'picture_ex_021');o.lp=100;const ctrl=new GameController(s,e,{addLog(){},render(){}});assert.equal(ctrl._aiThemedValue('tempoStrike',p,o,c),0);assert.equal(ctrl._aiThemedValue('ensemble',p,o,c),0);});
test('试炼模式胜负均不发奖励',()=>{for(const result of ['win','loss','draw'])assert.equal(calculateMatchReward(result,{mode:'practice'}).duelCoins,0);});

test('放弃攻击后即使获得连击也不能绕过本回合代价',()=>{const {s,e,p}=setup();const c=field(p,'picture_ex_021');use(e,p,c);c.doubleAttackThisTurn=true;c.canAttack=true;s.phase='battle';assert.equal(e.attack(c,'player').success,false);});
test('引爆选择未点燃的目标不消耗发动次数',()=>{const {e,p,o}=setup();const c=field(p,'picture_ex_027'),burning=monster('燃烧'),plain=monster('未燃烧');o.monsterZone.push(burning,plain);applyAilment(burning,'burn',1,250);assert.equal(use(e,p,c,0,plain),null);assert.equal(p.themedUses?.[`${c.id}:0`],undefined);assert.ok(use(e,p,c,0,burning));});
test('电磁炮目标失效不扣LP和蓄力',()=>{const {e,p,o}=setup();const c=field(p,'picture_ssr7_010');c.themedState={charges:2};o.monsterZone.push(monster('合法'));assert.equal(use(e,p,c,0,monster('已离场')),null);assert.equal(p.lp,8000);assert.equal(c.themedState.charges,2);assert.equal(p.themedUses?.[`${c.id}:0`],undefined);});
