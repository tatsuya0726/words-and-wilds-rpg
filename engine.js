/* Game Studio architecture: serializable rules, independent of Phaser/DOM. */
(function(root){
'use strict';
const LEVELS=['小1向け入門','小2向け','小3向け','小4向け','小5向け','小6向け','中1目安','中2目安','中3目安'];
const SPELLS=[
 {id:'spark',name:'ひかりの種',en:'Seed Spark',power:18,difficulty:'basic',kind:'damage'},
 {id:'wind',name:'風の輪',en:'Wind Ring',power:30,difficulty:'standard',kind:'damage'},
 {id:'star',name:'星のことば',en:'Star Verse',power:42,difficulty:'challenge',kind:'damage'},
 {id:'heal',name:'いやしの露',en:'Dew of Life',power:26,difficulty:'standard',kind:'heal'}
];
const normalize=s=>s.replace('向け','目安');
function fresh(){return {version:1,started:false,band:LEVELS[0],layer:'ground',view:'world',region:'grass',cleared:[],party:['seedpod_mouse','lotus_root_sproutling','pinecone_sparrow','silk_leaf_caterpillar'].map(id=>({id,level:1,xp:0})),active:'seedpod_mouse',dust:6,seen:{},answered:0,correct:0,battle:null,breeds:0};}
function pool(questions,band,difficulty){return questions.filter(q=>normalize(q.learning_level)===normalize(band)&&q.within_level_difficulty===difficulty);}
function pick(questions,state,difficulty){
 const candidates=pool(questions,state.band,difficulty);
 const conversationTurn=state.answered%2===1;
 const preferred=candidates.filter(q=>q.id.startsWith('DC-')===conversationTurn);
 const all=preferred.length?preferred:candidates;
 if(!all.length) throw Error('この学習帯の問題がありません。');
 const min=Math.min(...all.map(q=>state.seen[q.id]||0));
 const least=all.filter(q=>(state.seen[q.id]||0)===min);
 return least[state.answered%least.length];
}
function effect(power,correct){return power*(correct?1:0.5);}
function maxHP(member){return 80+(member.level-1)*12;}
function cast(state,question,index,spell){
 const b=state.battle;
 if(!b||b.phase!=='question'||b.questionId!==question.id||b.spell!==spell.id) return null;
 const member=state.party.find(m=>m.id===state.active);
 const right=question.options[index]===question.answer;
 const base=spell.power+(member.level-1)*4,amount=effect(base,right);
 if(spell.kind==='heal') b.hp=Math.min(maxHP(member),b.hp+amount);
 else b.enemyHP=Math.max(0,b.enemyHP-amount);
 state.answered++;state.correct+=Number(right);state.seen[question.id]=(state.seen[question.id]||0)+1;
 b.result={right,base,amount,kind:spell.kind,selected:index};b.phase='result';
 return b.result;
}
function enemyTurn(state){
 const b=state.battle;
 if(!b||b.phase!=='result'||b.enemyHP<=0||b.hp<=0)return null;
 b.hp=Math.max(0,b.hp-b.attack);b.turn++;
 b.phase=b.hp<=0?'lost':'choose';
 return {amount:b.attack};
}
function reward(state){
 const b=state.battle;if(!b||b.enemyHP>0||b.rewarded)return false;
 b.rewarded=true;state.dust+=2;
 const m=state.party.find(x=>x.id===state.active);m.xp+=2;
 while(m.xp>=3){m.xp-=3;m.level++;}
 if(!state.party.some(x=>x.id===b.enemy))state.party.push({id:b.enemy,level:1,xp:0});
 if(!state.cleared.includes(b.nodeKey))state.cleared.push(b.nodeKey);
 b.phase='won';return true;
}
function breed(state,recipe){
 if(state.battle||state.dust<3||!recipe.parents.every(id=>state.party.some(m=>m.id===id))||state.party.some(m=>m.id===recipe.child))return false;
 state.dust-=3;state.party.push({id:recipe.child,level:1,xp:0});state.breeds++;return true;
}
function valid(s){
 if(!(s&&s.version===1&&typeof s.started==='boolean'&&LEVELS.includes(s.band)&&['ground','below','sky'].includes(s.layer)&&['world','region','roster','breed','battle'].includes(s.view)&&typeof s.region==='string'&&Array.isArray(s.party)&&s.party.length>0&&s.party.every(m=>m&&typeof m.id==='string'&&Number.isInteger(m.level)&&m.level>0&&m.level<1000&&Number.isInteger(m.xp)&&m.xp>=0&&m.xp<3)&&new Set(s.party.map(m=>m.id)).size===s.party.length&&s.party.some(m=>m.id===s.active)&&Array.isArray(s.cleared)&&s.cleared.every(x=>typeof x==='string')&&typeof s.seen==='object'&&s.seen!==null&&!Array.isArray(s.seen)&&Object.values(s.seen).every(x=>Number.isInteger(x)&&x>=0)&&Number.isFinite(s.dust)&&s.dust>=0&&Number.isInteger(s.answered)&&s.answered>=0&&Number.isInteger(s.correct)&&s.correct>=0&&s.correct<=s.answered))return false;
 const b=s.battle;
 if(!b)return true;
 if(!['choose','question','result','won','lost'].includes(b.phase)||typeof b.enemy!=='string'||typeof b.nodeKey!=='string'||typeof b.log!=='string'||![b.hp,b.enemyHP,b.enemyMax,b.attack,b.turn].every(Number.isFinite)||b.hp<0||b.enemyHP<0||b.enemyMax<=0||b.enemyHP>b.enemyMax||b.attack<0||b.turn<0)return false;
 if(['question','result'].includes(b.phase)&&(!SPELLS.some(x=>x.id===b.spell)||typeof b.questionId!=='string'))return false;
 if(b.phase==='result'&&(!b.result||typeof b.result.right!=='boolean'||![b.result.base,b.result.amount].every(Number.isFinite)))return false;
 return true;
}
const api={LEVELS,SPELLS,fresh,pool,pick,effect,maxHP,cast,enemyTurn,reward,breed,valid};
if(typeof module!=='undefined')module.exports=api;else root.Rules=api;
})(typeof globalThis!=='undefined'?globalThis:this);
