import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, Player, createCardInstance } from '../js/model.js';
import { GameEngine } from '../js/engine.js';
import { GameController } from '../js/controller.js';
import { PHASE } from '../js/constants.js';
const definition = (id, extra={}) => ({ id, name:id, type:'monster', level:4, attack:1000, defense:1000, effects:[], ...extra });
function fixture() {
 const state=new GameState();state.players=[new Player('甲',[]),new Player('乙',[])];state.turn=3;state.firstTurn=false;state.phase=PHASE.MAIN_1;
 const engine=new GameEngine(state);
 const ui={logs:[],render(){},addLog(...args){this.logs.push(args);},showGameOver(){}};
 const controller=new GameController(state,engine,ui);controller.mode='local';
 return {state,engine,ui,controller};
}
function field(state,owner,id,extra={}) { const c=createCardInstance(definition(id,extra));c.canAttack=true;state.players[owner].monsterZone.push(c);return c; }

test('没有祭品选择时取消不能将主要阶段2退回主要阶段1',()=>{
 const {state,controller}=fixture();state.phase=PHASE.MAIN_2;controller.cancelTribute();assert.equal(state.phase,PHASE.MAIN_2);
});
test('操作锁期间不能跳阶段或提交目标',()=>{
 const {state,controller,engine}=fixture();controller.effectBusy=true;controller.nextPhase();assert.equal(state.phase,PHASE.MAIN_1);
 state.phase=PHASE.TARGET_SELECT;let calls=0;engine.triggerAllEffects=()=>{calls++;};controller.pendingMonsterEffect={card:{}};
 controller.confirmTarget({});assert.equal(calls,0);
});
test('不能选择对方怪兽使主要阶段提前结束',()=>{
 const {state,controller}=fixture();const enemy=field(state,1,'敌');controller.selectAttacker(enemy);assert.equal(state.phase,PHASE.MAIN_1);assert.equal(state.selectedAttacker,null);
});
test('动画完成锁不会被旧计时锁或其他动画完成释放',async()=>{
 const {controller}=fixture();let first,second;
 const a=controller._runEffect(()=>new Promise(r=>{first=r;}));const b=controller._runEffect(()=>new Promise(r=>{second=r;}));
 await Promise.resolve();controller._releaseEffectLocks();assert.equal(controller.effectBusy,true);
 first();await a;assert.equal(controller.effectBusy,true);second();await b;assert.equal(controller.effectBusy,false);
});
test('动画异常释放自己的锁，不改动手牌或遗留未处理拒绝',async t=>{
 t.mock.method(console, 'error', () => {});
 const {state,controller}=fixture();const card=createCardInstance(definition('已抽卡'));state.players[0].hand.push(card);
 await controller._runEffect(()=>{throw new Error('animation failed');});assert.equal(controller.effectBusy,false);assert.deepEqual(state.players[0].hand,[card]);
});
test('目标选择取消清理所有临时字段且保留主要阶段2',()=>{
 const {state,controller}=fixture();state.phase=PHASE.MAIN_2;const card=createCardInstance(definition('魔法',{type:'spell'}));const target=field(state,1,'目标');
 controller._beginTargetSelection(card,{type:'destroyTarget'},{targets:[target],fromSet:true});controller.cancelTargetSelect();
 assert.equal(state.phase,PHASE.MAIN_2);assert.equal(controller.pendingSetSpell,false);assert.equal(controller.pendingMonsterEffect,null);assert.equal(controller.pendingEffectCard,null);assert.deepEqual(state.validTargets,[]);
});
test('目标选择中源卡离场或回合过期不会发动另一张手牌',()=>{
 const {state,engine,controller}=fixture();const card=createCardInstance(definition('待发动',{type:'spell'}));const other=createCardInstance(definition('其他',{type:'spell'}));const target=field(state,1,'目标');
 state.players[0].hand.push(card,other);controller._beginTargetSelection(card,{type:'destroyTarget'},{targets:[target],cardIndex:0});state.players[0].hand.shift();
 let called=false;engine.activateSpell=()=>{called=true;};controller.confirmTarget(target);assert.equal(called,false);assert.equal(state.phase,PHASE.MAIN_1);
 controller._beginTargetSelection(other,{type:'destroyTarget'},{targets:[target],cardIndex:0});state.turn++;state.phase=PHASE.MAIN_2;controller.cancelTargetSelect();assert.equal(state.phase,PHASE.MAIN_2);assert.equal(controller.pendingEffectCard,null);
});
test('战斗报告记录结算前后LP与离场位置，且不保留可变卡牌引用',()=>{
 const {state,engine}=fixture();state.phase=PHASE.BATTLE;const a=field(state,0,'攻击者',{attack:2000});const b=field(state,1,'防守者',{attack:1000});
 const result=engine.attack(a,b);assert.equal(result.success,true);assert.ok(result.report.lines.some(line=>line.includes('8000 → 7000')));assert.ok(result.report.lines.some(line=>line.includes('墓地')));
 const saved=JSON.stringify(result.report);b.name='改名';assert.equal(JSON.stringify(result.report),saved);
 assert.equal(state.eventLog.filter(e=>e.type==='onBattleResolved').length,1);
});
test('被拒绝攻击不生成已结算报告',()=>{
 const {state,engine}=fixture();state.phase=PHASE.BATTLE;const a=field(state,0,'攻击者');field(state,1,'目标');const result=engine.attack(a,'player');assert.equal(result.success,false);assert.equal(result.report,undefined);assert.equal(state.eventLog.filter(e=>e.type==='onBattleResolved').length,0);
});


test('陷阱确认回调重复触发只结算一次',()=>{
 const {controller,engine,ui}=fixture();let confirm,calls=0;ui.showTrapConfirm=(_traps,callback)=>{confirm=callback;};engine.resolveReactiveTrapConfirm=()=>{calls++;};
 controller._showTrapConfirm([]);confirm([]);confirm([]);assert.equal(calls,1);assert.equal(controller.trapConfirmOpen,false);
});
test('旧回合选卡回调不修改新回合牌序',()=>{
 const {state,controller,ui}=fixture();let confirm,calls=0;ui.showDeckOrdering=(_cards,callback)=>{confirm=callback;};
 controller._showDeckOrdering({cards:[{}],player:state.players[0],reorder:()=>{calls++;}});state.turn++;confirm([]);assert.equal(calls,0);assert.equal(controller.effectBusy,false);
});
test('盖放怪兽的预览不能泄露身份、数值或破坏结论',()=>{
 const {state,engine}=fixture();const a=field(state,0,'攻击者');const b=field(state,1,'隐藏名字',{defense:1234});b.faceUp=false;
 const preview=engine.predictBattle(a,b);assert.equal(preview.damage,null);assert.equal(preview.targetDestroyed,null);assert.ok(!preview.text.includes('1234'));assert.ok(!preview.text.includes(b.name));
});
test('AI不会越过仍在播放的演出开始下次攻击',async()=>{
 const {state,controller,engine}=fixture();state.currentPlayerIndex=1;state.phase=PHASE.BATTLE;field(state,1,'AI');let finish,calls=0;
 const playing=controller._runEffect(()=>new Promise(r=>{finish=r;}));engine.attack=()=>{calls++;return {success:false};};controller._runAiBattleStep();assert.equal(calls,0);controller.clearAiTimer();finish();await playing;
});
test('公开基础战斗预览与结算的伤害一致（32种攻守组合）',()=>{
 for(const atk of [0,500,1000,2000])for(const power of [0,500,1500,2000])for(const position of ['attack','defense']){
  const {state,engine}=fixture();state.phase=PHASE.BATTLE;const a=field(state,0,'A',{attack:atk});const b=field(state,1,'B',{attack:power,defense:power});b.position=position;
  const preview=engine.predictBattle(a,b),result=engine.attack(a,b);assert.equal(result.success,true);assert.equal(result.damage,preview.damage,`${atk}/${power}/${position}`);assert.equal(result.damageTo,preview.damageTo);
 }
});

test('结束回合确认重复点击不能结束下一回合',()=>{
 const {state,controller,ui}=fixture();let confirm,calls=0;
 controller.pendingActions=()=>['仍可出牌'];ui.showTurnEndConfirm=(_reasons,callback)=>{confirm=callback;};
 controller._finalizeEndTurn=()=>{calls++;state.turn++;};
 controller.endTurn();confirm();confirm();assert.equal(calls,1);
});
test('结束阶段弃牌确认只执行一次',()=>{
 const {state,controller,ui}=fixture();let confirm,calls=0;
 for(let i=0;i<7;i++)state.players[0].hand.push(createCardInstance(definition(`手牌${i}`)));
 ui.showDiscardSelection=(_hand,_excess,callback)=>{confirm=callback;};controller._finalizeEndTurn=()=>{calls++;state.turn++;};
 const id=state.players[0].hand[0].instanceId;controller.endTurn(true);confirm([id]);confirm([id]);
 assert.equal(calls,1);assert.equal(state.players[0].hand.length,6);assert.equal(state.players[0].graveyard.length,1);
});
