import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {configureDuelMotion,getDuelMotion,motionDuration,createMotionScope,cancelDuelMotion,motionDiagnostics} from '../js/duel-motion.js';
import {GameState,Player,createCardInstance} from '../js/model.js';
import {GameEngine} from '../js/engine.js';
import {GameController} from '../js/controller.js';
import {getCardById} from '../js/catalog.js';
import {cardRuleStatusHtml} from '../js/card-view.js';
afterEach(()=>{cancelDuelMotion();configureDuelMotion({});});
function setup(id='picture_ssr7_010') {const s=new GameState();s.players=[new Player('A',[]),new Player('B',[])];s.turn=3;s.firstTurn=false;s.phase='main_1';const c=createCardInstance(getCardById(id));s.players[0].monsterZone.push(c);return {s,c,p:s.players[0],e:new GameEngine(s)};}
test('速度校验只接受支持的倍率，不改变原始时长',()=>{configureDuelMotion({animationSpeed:2,effectQuality:'low'});assert.equal(motionDuration(700),350);assert.equal(getDuelMotion().maxLayers,2);configureDuelMotion({animationSpeed:NaN,effectQuality:'bad'});assert.equal(motionDuration(700),700);});
test('取消演出完成Promise，清理只执行一次',async()=>{let count=0;const scope=createMotionScope({remove(){count++;}});cancelDuelMotion('exit');assert.equal((await scope.done).reason,'exit');scope.finish();assert.equal(count,1);assert.equal(motionDiagnostics().active,0);});
test('旧演出清理不能取消新演出',async()=>{const old=createMotionScope(null);cancelDuelMotion();const fresh=createMotionScope(null);old.finish();assert.equal(motionDiagnostics().active,1);fresh.finish();await fresh.done;});
test('动画取消产生的finished拒绝被处理',async()=>{let reject;const finished=new Promise((_,r)=>reject=r);const scope=createMotionScope(null);scope.animations.push({finished,cancel(){reject(Error('cancelled'));}});cancelDuelMotion();await scope.done;});
test('控制器销毁后延迟回调不能继续执行',async()=>{const {s,e}=setup();let called=false;const ctrl=new GameController(s,e,{addLog(){},render(){}});ctrl._later(()=>{called=true;},5);ctrl.dispose();await new Promise(r=>setTimeout(r,20));assert.equal(called,false);assert.equal(ctrl._pendingTimers.size,0);});
test('销毁中断未完成演出的等待并释放锁',async()=>{const {s,e}=setup();const ctrl=new GameController(s,e,{addLog(){},render(){}});const done=ctrl._runEffect(()=>new Promise(()=>{}));assert.equal(ctrl.effectBusy,true);ctrl.dispose();await done;assert.equal(ctrl.effectBusy,false);});
test('缩放等视觉中断不清除待选目标交互锁',async()=>{const {s,e}=setup();const ctrl=new GameController(s,e,{addLog(){},render(){}});ctrl._interactionLocks.add('choice');const done=ctrl._runEffect(()=>new Promise(()=>{}));cancelDuelMotion('resize');await done;assert.equal(ctrl._animationLocks.size,0);assert.equal(ctrl.effectBusy,true);ctrl.dispose();});
test('技能菜单准确显示蓄力不足且查询不扣费',()=>{const {e,p,c}=setup();const before=JSON.stringify(c);assert.match(e.getMonsterEffectAvailability(p,c,0).reason,/蓄力不足/);assert.equal(JSON.stringify(c),before);assert.equal(p.lp,8000);});
test('技能菜单准确显示外部LP代价不足',()=>{const {e,p,c}=setup('picture_ex_030');p.lp=400;assert.match(e.getMonsterEffectAvailability(p,c,0).reason,/LP不足/);assert.equal(p.lp,400);});
test('技能菜单可用状态与同名每回合次数一致',()=>{const {s,e,p,c}=setup();assert.equal(e.getMonsterEffectAvailability(p,c,1).canActivate,true);e.triggerAllEffects(p,c,'manual',{effectIndex:1});assert.match(e.getMonsterEffectAvailability(p,c,1).reason,/已发动/);s.turn+=2;assert.equal(e.getMonsterEffectAvailability(p,c,1).canActivate,true);});
test('引爆无目标时直接说明灼烧前置',()=>{const {e,p,c}=setup('picture_ex_027');assert.match(e.getMonsterEffectAvailability(p,c,0).reason,/灼烧/);});
test('过期状态不再显示，仍生效的冻结和蓄力保留',()=>{const {c}=setup();c.themedState={charges:2,sealedUntil:2,frozenUntil:4};const html=cardRuleStatusHtml(c,3);assert.ok(!html.includes('效果无效'));assert.ok(html.includes('冻结'));assert.ok(html.includes('蓄力 2/3'));});

test('后台中断释放计时演出锁但保留选卡锁',()=>{const {s,e}=setup();const ctrl=new GameController(s,e,{addLog(){},render(){}});ctrl._lockForEffect(3000);ctrl._interactionLocks.add('choice');cancelDuelMotion('hidden');assert.equal(ctrl._lockTimers.length,0);assert.equal(ctrl._pendingTimers.size,0);assert.equal(ctrl.effectBusy,true);ctrl._interactionLocks.clear();assert.equal(ctrl.effectBusy,false);ctrl.dispose();});
test('退出后旧结束回合确认不能推进已关闭牌局',()=>{const {s,e}=setup();let confirm;const ctrl=new GameController(s,e,{addLog(){},render(){},showTurnEndConfirm(reasons,cb){confirm=cb;}});ctrl.pendingActions=()=>[{label:'可召唤'}];ctrl.endTurn();ctrl.dispose();confirm();assert.equal(s.turn,3);assert.equal(s.phase,'main_1');});
