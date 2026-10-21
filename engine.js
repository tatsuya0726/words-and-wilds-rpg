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
function oldFresh(){return {version:1,started:false,band:LEVELS[0],layer:'ground',view:'world',region:'grass',cleared:[],party:['seedpod_mouse','lotus_root_sproutling','pinecone_sparrow','silk_leaf_caterpillar'].map(id=>({id,level:1,xp:0})),active:'seedpod_mouse',dust:6,seen:{},answered:0,correct:0,battle:null,breeds:0};}
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
function oldValid(s){
 if(!(s&&s.version===1&&typeof s.started==='boolean'&&LEVELS.includes(s.band)&&['ground','below','sky'].includes(s.layer)&&['world','region','roster','breed','battle'].includes(s.view)&&typeof s.region==='string'&&Array.isArray(s.party)&&s.party.length>0&&s.party.every(m=>m&&typeof m.id==='string'&&Number.isInteger(m.level)&&m.level>0&&m.level<1000&&Number.isInteger(m.xp)&&m.xp>=0&&m.xp<3)&&new Set(s.party.map(m=>m.id)).size===s.party.length&&s.party.some(m=>m.id===s.active)&&Array.isArray(s.cleared)&&s.cleared.every(x=>typeof x==='string')&&typeof s.seen==='object'&&s.seen!==null&&!Array.isArray(s.seen)&&Object.values(s.seen).every(x=>Number.isInteger(x)&&x>=0)&&Number.isFinite(s.dust)&&s.dust>=0&&Number.isInteger(s.answered)&&s.answered>=0&&Number.isInteger(s.correct)&&s.correct>=0&&s.correct<=s.answered))return false;
 const b=s.battle;
 if(!b)return true;
 if(!['choose','question','result','won','lost'].includes(b.phase)||typeof b.enemy!=='string'||typeof b.nodeKey!=='string'||typeof b.log!=='string'||![b.hp,b.enemyHP,b.enemyMax,b.attack,b.turn].every(Number.isFinite)||b.hp<0||b.enemyHP<0||b.enemyMax<=0||b.enemyHP>b.enemyMax||b.attack<0||b.turn<0)return false;
 if(['question','result'].includes(b.phase)&&(!SPELLS.some(x=>x.id===b.spell)||typeof b.questionId!=='string'))return false;
 if(b.phase==='result'&&(!b.result||typeof b.result.right!=='boolean'||![b.result.base,b.result.amount].every(Number.isFinite)))return false;
 return true;
}
function migrate(input){
 const s=JSON.parse(JSON.stringify(input));if(s.version===2)return s;
 if(!oldValid(s))throw Error('Invalid legacy save');
 s.version=2;s.nextUid=s.party.length+1;s.party.forEach((m,i)=>{m.uid='m'+(i+1);m.hp=maxHP(m);});
 const lead=s.party.find(m=>m.id===s.active);s.active=lead.uid;s.team=[lead.uid,...s.party.filter(m=>m!==lead).slice(0,2).map(m=>m.uid)];s.items={dew:0};
 if(s.battle){const b=s.battle;lead.hp=Math.min(maxHP(lead),b.hp);b.units=[...s.team];b.acted=b.phase==='result'?[s.active]:[];b.target=s.active;b.lastTarget=s.active;}
 return s;
}
function fresh(){return migrate(oldFresh());}
const unit=(s,id=s.active)=>s.party.find(m=>m.uid===id);
function sync(s){if(s.battle)s.battle.hp=unit(s).hp;}
function start(s,config){if(s.battle)return false;const alive=s.team.filter(id=>unit(s,id).hp>0);if(!alive.length)return false;s.active=alive[0];s.battle={...config,units:[...s.team],acted:[],target:s.active,lastTarget:s.active,hp:unit(s).hp,phase:'choose',turn:0};return true;}
function selectActor(s,id){const b=s.battle;if(!b||b.phase!=='choose'||!b.units.includes(id)||b.acted.includes(id)||unit(s,id).hp<=0)return false;s.active=id;b.target=id;sync(s);return true;}
function setTeam(s,ids){if(s.battle||ids.length<1||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!unit(s,id)))return false;s.team=[...ids];s.active=ids[0];return true;}
function castV2(s,q,index,spell){const b=s.battle;if(!b||b.phase!=='question'||b.questionId!==q.id||b.spell!==spell.id||b.acted.includes(s.active)||!Number.isInteger(index)||index<0||index>=q.options.length)return null;
 const m=unit(s),right=q.options[index]===q.answer,base=spell.power+(m.level-1)*4,amount=effect(base,right);if(m.hp<=0)return null;
 const target=unit(s,b.target)||m;if(spell.kind==='heal')target.hp=Math.min(maxHP(target),target.hp+amount);else b.enemyHP=Math.max(0,b.enemyHP-amount);
 s.answered++;s.correct+=+right;s.seen[q.id]=(s.seen[q.id]||0)+1;b.acted.push(s.active);b.result={right,base,amount,kind:spell.kind,selected:index,target:target.uid,actor:s.active};b.phase='result';sync(s);return b.result;
}
function enemyV2(s){const b=s.battle;if(!b||b.phase!=='result'||b.enemyHP<=0)return null;
 const next=b.units.find(id=>unit(s,id).hp>0&&!b.acted.includes(id));if(next){s.active=next;b.target=next;b.phase='choose';sync(s);return {nextOnly:true};}
 const alive=b.units.filter(id=>unit(s,id).hp>0);if(!alive.length){b.phase='lost';return null;}
 const target=unit(s,alive[b.turn%alive.length]);target.hp=Math.max(0,target.hp-b.attack);b.lastTarget=target.uid;b.turn++;b.acted=[];
 const remaining=b.units.filter(id=>unit(s,id).hp>0);b.phase=remaining.length?'choose':'lost';s.active=remaining[0]||target.uid;b.target=s.active;sync(s);return {amount:b.attack,target:target.uid};
}
function rewardV2(s){const b=s.battle;if(!b||b.enemyHP>0||b.rewarded)return false;b.rewarded=true;s.dust+=2;
 b.units.forEach(id=>{const m=unit(s,id);m.xp+=2;while(m.xp>=3){m.xp-=3;m.level++;m.hp=Math.min(maxHP(m),m.hp+12);}});
 s.party.push({uid:'m'+s.nextUid++,id:b.enemy,level:1,xp:0,hp:80});if(!s.cleared.includes(b.nodeKey))s.cleared.push(b.nodeKey);b.phase='won';sync(s);return true;}
function breedV2(s,r,parents){if(s.battle||!r||s.dust<3||!Array.isArray(parents)||parents.length!==2||parents[0]===parents[1])return false;
 const members=parents.map(id=>unit(s,id));if(members.some((m,i)=>!m||m.id!==r.parents[i]))return false;
 const child={uid:'m'+s.nextUid,id:r.child,level:1,xp:0,hp:80};s.nextUid++;s.party=s.party.filter(m=>!parents.includes(m.uid));s.party.push(child);s.team=s.team.filter(id=>!parents.includes(id));if(s.team.length<3)s.team.push(child.uid);s.active=s.team[0];s.dust-=3;s.breeds++;return true;}
const SHOP={dew:{name:'いやしのしずく',price:2,heal:30},innPrice:2};
function buy(s,id){const item=SHOP[id];if(s.battle||!item||!item.price||s.dust<item.price||(s.items[id]||0)>=99)return false;s.dust-=item.price;s.items[id]=(s.items[id]||0)+1;return true;}
function use(s,id,uid){const item=SHOP[id],m=unit(s,uid);if(s.battle||!item||!m||!s.items[id]||m.hp>=maxHP(m))return false;m.hp=Math.min(maxHP(m),m.hp+item.heal);s.items[id]--;return true;}
function inn(s){if(s.battle||s.dust<SHOP.innPrice||s.party.every(m=>m.hp===maxHP(m)))return false;s.dust-=SHOP.innPrice;s.party.forEach(m=>m.hp=maxHP(m));return true;}
function valid(s){
 if(!s||s.version!==2||!Array.isArray(s.party)||!Array.isArray(s.team)||s.team.length<1||s.team.length>3||new Set(s.team).size!==s.team.length||!s.team.includes(s.active)||!Number.isInteger(s.nextUid)||s.nextUid<1||!s.items||Object.entries(s.items).some(([k,v])=>k!=='dew'||!Number.isInteger(v)||v<0||v>99))return false;
 if(s.party.some(m=>!m||!/^m[1-9][0-9]*$/.test(m.uid)||+m.uid.slice(1)>=s.nextUid||!Number.isFinite(m.hp)||m.hp<0||m.hp>maxHP(m))||new Set(s.party.map(m=>m.uid)).size!==s.party.length||s.team.some(id=>!unit(s,id)))return false;
 const legacy=JSON.parse(JSON.stringify(s));legacy.version=1;legacy.party.forEach(m=>m.id=m.uid);legacy.active=s.active;if(!oldValid(legacy))return false;
 const b=s.battle;if(b&&(!Array.isArray(b.units)||JSON.stringify(b.units)!==JSON.stringify(s.team)||!Array.isArray(b.acted)||new Set(b.acted).size!==b.acted.length||b.acted.some(id=>!b.units.includes(id))||!b.units.includes(b.target)||!b.units.includes(b.lastTarget)))return false;
 if(s.location&&(!Number.isInteger(s.location.index)||s.location.index<0||typeof s.location.region!=='string'))return false;
 return true;
}
const api={migrate,start,unit,selectActor,setTeam,SHOP,buy,use,inn,LEVELS,SPELLS,fresh,pool,pick,effect,maxHP,cast:castV2,enemyTurn:enemyV2,reward:rewardV2,breed:breedV2,valid};
if(typeof module!=='undefined')module.exports=api;else root.Rules=api;
})(typeof globalThis!=='undefined'?globalThis:this);
