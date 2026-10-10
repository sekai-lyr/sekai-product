import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { GameState, Player } from '../src/main/resources/static/js/model.js';
import { GameEngine } from '../src/main/resources/static/js/engine.js';
import { GameController } from '../src/main/resources/static/js/controller.js';
import { SeededRandom } from '../src/main/resources/static/js/rng.js';
import { getCardById } from '../src/main/resources/static/js/catalog.js';
import { STRATEGY_DECKS } from '../src/main/resources/static/js/strategy-decks.js';

const seeds=Number(process.env.STRATEGY_SEEDS || 20);
const startSeed=Number(process.env.STRATEGY_SEED_START || 1);
const report={startSeed,seedsPerSeat:seeds,maxTurns:Number(process.env.STRATEGY_MAX_TURNS || 40),policy:'Shared production main/battle selectors and main action executor; both main phases; bounded scheduler, traps auto-respond.',matches:[],pairs:[],actions:{},integrityChecks:0};
function duel(left,right,seed) {
 const rng=new SeededRandom(seed),s=new GameState();
 s.players=[new Player(left.id,left.main.map(getCardById),rng),new Player(right.id,right.main.map(getCardById),rng)];
 const e=new GameEngine(s,rng),c=new GameController(s,e,{addLog(){},render(){},showGameOver(){}});c.mode='local';e.trapConfirmHandler=null;
 for(const p of s.players)for(let i=0;i<5;i++)p.drawCard();
 const seen=new Set();
 const check=()=>{
  const all=s.players.flatMap(p=>[...p.deck,...p.hand,...p.monsterZone,...p.spellTrapZone,...p.graveyard,...p.banished,...(p.fieldZone?[p.fieldZone]:[])]);
  assert.equal(new Set(all.map(x=>x.instanceId)).size,all.length,'duplicate zone ownership');
  assert.equal(all.filter(x=>!x.isToken).length,80,'physical cards lost/created');
  for(const [owner,p]of s.players.entries()){
   assert.ok(p.monsterZone.length<=5&&p.spellTrapZone.length<=5);
   for(const [key,turn]of Object.entries(p.themedUses||{})){
    const trace=`${owner}:${turn}:${key}`;if(seen.has(trace))continue;seen.add(trace);
    const cut=key.lastIndexOf(':'),id=key.slice(0,cut),index=Number(key.slice(cut+1));
    const action=getCardById(id)?.effects[index]?.action;if(action)report.actions[action]=(report.actions[action]||0)+1;
   }
  }
  report.integrityChecks++;
 };
 while(!s.gameOver&&s.turn<=report.maxTurns){
  e.startTurn({skipDraw:s.firstTurn});if(e.checkGameOver())break;s.phase='main_1';
  const p=s.currentPlayer;
  const main=()=>{for(let steps=0;steps<c.aiMaxMainActions&&!s.gameOver;steps++){
   const began=performance.now(),action=c.chooseAiMainAction(steps);
   report.maxDecisionMs=Math.max(report.maxDecisionMs||0,performance.now()-began);
   report.decisions=(report.decisions||0)+1;
   if(!action)break;
   const result=c._executeAiPlayAction(action,{visuals:false});
   check();e.checkGameOver();
   if(!result.success){report.failedActions=(report.failedActions||0)+1;break;}
  }};
  main();
  if(!s.firstTurn&&!p.skipBattlePhase&&!s.gameOver){s.phase='battle';for(let hits=0;hits<40&&!s.gameOver;hits++){
   const began=performance.now(),action=c.chooseAiBattleAction();
   report.maxDecisionMs=Math.max(report.maxDecisionMs||0,performance.now()-began);
   report.decisions=(report.decisions||0)+1;
   if(!action)break;
   const {attacker:a,target}=action;
   const r=e.attack(a,target);if(r.redirect){const redirected=e.attack(a,r.redirect);if(!redirected.success)c._skipAiAttack(a);}else if(!r.success&&!r.replay)c._skipAiAttack(a);
   check();e.checkGameOver();
  }}
  if(!s.gameOver){s.phase='main_2';main();}
  if(!s.gameOver){e.discardToEndLimit(p);e.endTurn();}check();
 }
 c.dispose();
 return {left:left.id,right:right.id,seed,turns:s.turn,winner:s.gameOver&&!s.isDraw?s.players[s.winner]?.name:null,timeout:!s.gameOver,lp:s.players.map(p=>p.lp)};
}
for(let a=0;a<STRATEGY_DECKS.length;a++)for(let b=a+1;b<STRATEGY_DECKS.length;b++){
 const left=STRATEGY_DECKS[a],right=STRATEGY_DECKS[b],games=[];
 for(let seed=startSeed;seed<startSeed+seeds;seed++)for(const swapped of [false,true])games.push(duel(swapped?right:left,swapped?left:right,seed));
 report.matches.push(...games);report.pairs.push({decks:[left.id,right.id],games:games.length,wins:{[left.id]:games.filter(x=>x.winner===left.id).length,[right.id]:games.filter(x=>x.winner===right.id).length},draws:games.filter(x=>!x.winner&&!x.timeout).length,timeouts:games.filter(x=>x.timeout).length,averageTurns:Math.round(games.reduce((v,x)=>v+x.turns,0)/games.length*10)/10});
}
report.firstSeatWins=report.matches.filter(x=>x.winner===x.left).length;
await writeFile(new URL(process.env.STRATEGY_REPORT || '../../docs/strategy-balance-results.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({pairs:report.pairs,firstSeatWins:report.firstSeatWins,integrityChecks:report.integrityChecks,coreActions:Object.fromEntries(['ensemble','tempoStrike','railgun','combust'].map(x=>[x,report.actions[x]||0]))},null,2));
