/* Game Studio prototype — DOM HUD, Phaser view, state owned by Rules. */
'use strict';
const $=s=>document.querySelector(s), E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE='words-wilds-prototype-v1';
const REGIONS={
 grass:{name:'風わたる草原',sub:'はじまりの地 / 分岐する小径',layer:'ground',art:'grass',bg:'bg_grass',danger:false,enemies:['seedpod_mouse','lotus_root_sproutling','pinecone_sparrow'],nodes:[
 ['町','town',14,68],['草の小径','battle',31,51],['泉','rest',30,80],['風の丘','battle',49,38],['野の分かれ道','battle',50,69],['苔の宝箱','treasure',68,52],['森への道','gate',83,31,'forest'],['古い坑道','gate',83,78,'cave']
 ],edges:[[0,1],[0,2],[1,3],[1,4],[2,4],[3,5],[4,5],[5,6],[4,7]]},
 forest:{name:'木漏れ日の森',sub:'地上 / 精霊の回廊',layer:'ground',art:'forest',bg:'bg_forest',enemies:['silk_leaf_caterpillar','pinecone_sparrow','lantern_moth'],nodes:[
 ['森の入口','rest',14,72],['葉のトンネル','battle',29,52],['ネネの寄り道','talk',34,80],['光の水辺','treasure',49,36],['古樹の根','battle',53,67],['精霊の輪','boss',72,49],['空への階段','gate',86,26,'sky'],['草原への道','gate',83,80,'grass']
 ],edges:[[0,1],[0,2],[1,3],[1,4],[2,4],[3,5],[4,5],[5,6],[4,7]]},
 volcano:{name:'赤い山のふもと',sub:'地上 / 強敵注意・いつでも退却可',layer:'ground',art:'volcano',bg:'bg_volcano',danger:true,enemies:['ancient_forest_stag','thunder_feather_owlet'],nodes:[
 ['避難小屋','rest',14,74],['灰の草地','battle',32,53],['熱風の分岐','battle',34,80],['火口のかけら','treasure',52,34],['焦げた橋','battle',55,66],['山の守り手','boss',75,48],['帰りの道','gate',85,79,'grass']
 ],edges:[[0,1],[0,2],[1,3],[1,4],[2,4],[3,5],[4,5],[4,6]]},
 cave:{name:'ひかり苔の地下道',sub:'地下 / 小規模な試作区画',layer:'below',art:'forest',bg:'bg_forest',enemies:['sprout_ear_mole','lantern_moth'],nodes:[
 ['地底の入口','rest',14,73],['苔の通路','battle',32,52],['地下の泉','rest',34,81],['光る鉱石','treasure',52,35],['根のアーチ','battle',55,65],['地上への梯子','gate',80,46,'grass']
 ],edges:[[0,1],[0,2],[1,3],[1,4],[2,4],[3,5],[4,5]]},
 sky:{name:'雲の庭',sub:'空中 / 小規模な試作区画',layer:'sky',art:'grass',bg:'bg_grass',enemies:['thunder_feather_owlet','pinecone_sparrow'],nodes:[
 ['風の停留所','rest',14,73],['浮かぶ草地','battle',32,52],['雲の泉','rest',34,81],['空のかけら','treasure',52,35],['風の渡り廊下','battle',55,65],['森への階段','gate',80,46,'forest']
 ],edges:[[0,1],[0,2],[1,3],[1,4],[2,4],[3,5],[4,5]]}
};
for(const [id,r] of Object.entries(REGIONS)){r.nodes.forEach((n,i)=>{const p=Geography.local(id,Geography.areas[id].points[i]);n[2]=p[0];n[3]=p[1];});}
let mapCleanup=null;const mapPositions={};
let state=Rules.fresh(), loadError='', renderer, worldScene, sceneStamp=0, talkStep=0, talkCharacter='kiki', translated=false;
function validSave(parsed){
 if(!Rules.valid(parsed)||parsed.party.some(m=>!ASSETS[m.id])||!REGIONS[parsed.region]||(parsed.location&&(!REGIONS[parsed.location.region]||!REGIONS[parsed.location.region].nodes[parsed.location.index])))return false;
 return !parsed.battle||(!!ASSETS[parsed.battle.enemy]&&(!parsed.battle.questionId||QUESTIONS.some(q=>q.id===parsed.battle.questionId)));
}
try{const raw=localStorage.getItem(SAVE);if(raw){const original=JSON.parse(raw),parsed=Rules.migrate(original);if(original.version===1&&!localStorage.getItem(SAVE+'-v1-backup'))localStorage.setItem(SAVE+'-v1-backup',raw);if(!validSave(parsed))throw Error('形式');state=parsed;}}catch(e){loadError='保存データを読み込めませんでした。既存データは保護しています。設定から別名バックアップを保存後、初期化できます。';}
function save(){if(loadError)return;try{localStorage.setItem(SAVE,JSON.stringify(state));$('#saved').textContent='保存済み · このブラウザー';}catch(e){$('#saved').textContent='保存できません · 設定から書き出せます';}}
function notify(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
const btn=(text,action,arg='',cls='')=>`<button class="${cls}" data-action="${action}" data-arg="${E(arg)}">${text}</button>`;
const image=(id,cls='')=>`<img class="${cls}" src="${ASSETS[id].img}" alt="${E(ASSETS[id].name||id)}">`;
const member=()=>Rules.unit(state);
function header(){
 document.body.classList.toggle("in-battle",!!state.battle);
 $('#status').textContent=`${state.band} · 星砂 ${state.dust} · 仲間 ${state.party.length}`;
 document.querySelectorAll('header button').forEach(b=>b.disabled=!!state.battle);
 $('#hint').textContent=state.battle?'正解で100%、不正解でも50%。間違えても呪文は届く。':'明るいマスをタップして探索。強敵からはいつでも退却できます。';
}
function modal(html){$('#modalBody').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function close(){ $('#modal').close(); }
function clearScene(){if(mapCleanup){mapCleanup();mapCleanup=null;}sceneStamp++;if(renderer){renderer.destroy(true);renderer=null;worldScene=null;}}
function paintPhaser(region){
 const host=$('#map-canvas');if(!host)return;
 const stamp=sceneStamp;
 class View extends Phaser.Scene{
  preload(){this.load.image('terrain',ASSETS.world.img);}
  create(){
   if(stamp!==sceneStamp)return;
   worldScene=this;
   this.back=this.add.image(0,0,'terrain').setOrigin(.5);
   this.paths=this.add.graphics();
   this.layout=()=>{
    const w=this.scale.width,h=this.scale.height;
    const [gx,gy,gw,gh]=Geography.areas[state.region].bounds;
    this.back.setOrigin(0);this.back.setPosition(-gx/gw*w,-gy/gh*h);this.back.setDisplaySize(w*100/gw,h*100/gh);
    this.back.setTint(region.layer==='below'?0x789baa:region.layer==='sky'?0xd9eaff:0xffffff);
    this.paths.clear().lineStyle(2,0xf5dc9d,.7);
    region.edges.forEach(([a,b])=>{const p=region.nodes[a],q=region.nodes[b];this.paths.lineBetween(w*p[2]/100,h*p[3]/100,w*q[2]/100,h*q[3]/100);});
   };this.layout();this.scale.on('resize',this.layout);
  }
 }
 renderer=new Phaser.Game({type:Phaser.CANVAS,parent:host,width:host.clientWidth,height:host.clientHeight,transparent:true,pixelArt:true,scale:{mode:Phaser.Scale.RESIZE},scene:View,audio:{noAudio:true},banner:false});
}
function unlockedRegion(id){
 if(REGIONS[id].layer==='ground')return true;
 return id==='cave'?state.cleared.includes('grass:7'):state.cleared.includes('forest:6');
}
function world(preview=false){
 clearScene();if(!preview){state.view='world';save();}header();
 const layer=state.layer||'ground';const coords=Object.fromEntries(Object.entries(Geography.areas).map(([id,g])=>[id,g.anchor]));
 $('#scene').innerHTML=`<section class="map world-map ${layer}">${image('world')}<div class="intro"><div class="eyebrow">WORDS & WILDS</div><h1>ごちゃまぜ<br>モンスター</h1><p>ひとつの言葉が、<br>まだ見ぬ仲間への道になる。</p><span class="pill">小さな旅の試作 · 5エリア</span></div><div class="layer-tabs" aria-label="世界の層">${[['ground','地上'],['below','地下'],['sky','空中']].map(([id,label])=>btn(label,'layer',id,layer===id?'primary':'')).join('')}</div>${Object.entries(REGIONS).filter(([,r])=>r.layer===layer).map(([id,r])=>`<button class="node ${r.danger?'danger':''}" style="left:${coords[id][0]}%;top:${coords[id][1]}%" data-action="region" data-arg="${id}" ${unlockedRegion(id)?'':'disabled'}><strong>${r.name}</strong><small>${unlockedRegion(id)?r.danger?'強敵 Lv.6目安 / 初めから挑戦可':'探索する':id==='cave'?'草原の坑道から解放':'森の階段から解放'}</small></button>`).join('')}<div class="map-note">地上3・地下1・空中1の試作区画<br>地下と空中の背景は既存素材を仮使用</div><div class="map-actions">${btn('町でひと休み','town')}${btn('旅の手引き','help')}</div></section>`;
 tidyMap(true);
}

function accessible(id,index){if(index===0)return true;return REGIONS[id].edges.some(([a,b])=>(a===index&&state.cleared.includes(`${id}:${b}`))||(b===index&&state.cleared.includes(`${id}:${a}`)));}
function region(id=state.region){
 if(!REGIONS[id]||!unlockedRegion(id))return;
 clearScene();state.region=id;state.layer=REGIONS[id].layer;state.view='region';save();header();const r=REGIONS[id];
 $('#scene').innerHTML=`<section class="map region ${r.layer}"><div id="map-canvas" aria-hidden="true"></div><div class="region-title"><div class="eyebrow">${r.sub}</div><h2>${r.name}</h2><small>${state.cleared.filter(k=>k.startsWith(id+':')).length} / ${r.nodes.length} マス探索済み</small></div>${r.nodes.map((n,i)=>{const done=state.cleared.includes(`${id}:${i}`),open=accessible(id,i);return `<button class="node ${done?'done':''} ${n[1]==='boss'?'danger':''}" style="left:${n[2]}%;top:${n[3]}%" data-action="node" data-arg="${i}" ${open?'':'disabled'}><strong>${open?n[0]:'？'}</strong><small>${!open?'隣のマスを探索':done?'✓ 探索済み':({town:'英語で会話・回復',battle:'呪文バトル',rest:'休憩・道を開く',treasure:'星砂を拾う',gate:'次のエリアへ',boss:'強敵バトル',talk:'ネネとの会話'}[n[1]])}</small></button>`;}).join('')}<div class="map-actions">${btn('← ワールド','world')}</div></section>`;
 tidyMap(false);paintPhaser(r);
}
function mark(index){state.location={region:state.region,index};const k=`${state.region}:${index}`;if(!state.cleared.includes(k))state.cleared.push(k);save();}
function node(index){
 if(state.battle||!accessible(state.region,index))return;state.location={region:state.region,index};save();const r=REGIONS[state.region],n=r.nodes[index];
 if(n[1]==='battle'||n[1]==='boss')return startBattle(index);
 const done=state.cleared.includes(`${state.region}:${index}`);mark(index);
 if(n[1]==='gate'){const destination=n[4],back=REGIONS[destination].nodes.findIndex(p=>p[1]==='gate'&&p[4]===state.region);if(back<0)return world();state.layer=REGIONS[destination].layer;state.location={region:destination,index:back};const arrival=destination+':'+back;if(!state.cleared.includes(arrival))state.cleared.push(arrival);return region(destination);}
 region();
 if(n[1]==='town')town();
 if(n[1]==='talk')talk('nene');
 if(n[1]==='rest')notify('泉でひと休み。次の戦いは全回復で始まります。周囲の道が開きました。');
 if(n[1]==='treasure'){if(!done){state.dust+=3;save();header();}notify(done?'宝箱は空です。':'星砂を3つ見つけました。配合に使えます。');}
}
function npcArt(id,face=false){const n=TOWN_NPCS[id];return n.ready?'<img class="npc-art" src="'+(face?n.portrait:n.standing)+'" alt="'+n.name+'">':'<div class="npc-placeholder" role="img" aria-label="'+n.name+'の立ち絵準備中"><span>♙</span><small>立ち絵準備中</small></div>';}
let townRole='resident',townTranslated=false;
function town(){state.region='grass';state.layer='ground';state.location={region:'grass',index:0};mark(0);region('grass');modal(`<div class="eyebrow">HAVEN / 風待ちの町</div><h2>町に立ち寄る</h2><p>星砂 ${state.dust} · いやしのしずく ${state.items.dew||0}個</p><div class="town-menu">${btn('道具屋','facility','item_shop')}${btn('宿屋','facility','inn')}${btn('配合案内','facility','breeding_guide')}${btn('住人と話す','facility','resident')}${btn('鍛冶屋と話す','facility','blacksmith')}${btn('旅の案内','facility','travel_guide')}${btn('道具を使う','inventory')}${btn('キキと話す','talk','kiki')}${btn('ネネと話す','talk','nene')}${btn('町を出る','close')}</div>`);}
function facility(id,keep=false){if(!TOWN_NPCS[id])return;townRole=id;if(!keep)townTranslated=false;const n=TOWN_NPCS[id];modal(`<h2>${n.name}</h2><div class="facility">${npcArt(id)}<div>${townTranslated?'<p class="translation">'+n.ja+'</p>':''}<p lang="en" class="english">${n.en}</p>${btn(townTranslated?'訳を隠す':'日本語を重ねる','npcTranslate')}${btn('話を聞く','npcTalk',id)}<p>所持星砂 ${state.dust}</p>${id==='item_shop'?'<p>いやしのしずく：HP30回復（戦闘外・戦闘不能にも使用可）</p>'+btn('1個買う · 星砂'+Rules.SHOP.dew.price,'buy','dew')+'<p>所持 '+(state.items.dew||0)+'個</p>':id==='inn'?'<p>所持する全員が全回復します。</p>'+btn('泊まる · 星砂'+Rules.SHOP.innPrice,'inn'):id==='breeding_guide'?'<p>選んだ親2個体は消え、子1体が加入します。</p>'+btn('配合工房へ','breed'):''}</div></div>${btn('町へ戻る','town')}`);}
function npcConversation(id){const n=TOWN_NPCS[id];modal('<h2>'+n.name+'</h2><div class="talk">'+npcArt(id,true)+'<div><p class="english" lang="en">'+n.en+'</p></div></div>'+btn('日本語を重ねる','npcFaceTranslate',id)+btn('施設へ戻る','facility',id));}
function inventory(){modal('<h2>道具 · いやしのしずく '+(state.items.dew||0)+'個</h2><p>HP30回復。使う仲間を選んでください。</p><div class="inventory-list">'+state.party.map(m=>btn(ASSETS[m.id].name+' ('+m.uid+') HP '+m.hp+'/'+Rules.maxHP(m),'useItem',m.uid)).join('')+'</div>'+btn('閉じる','close'));}
const LINES={
 kiki:[['determined',"I'll lead the way. Stay close!","俺が先頭だ。ついてこいよ！"],['goofy',"Wait... which way is north?","待て……北ってどっちだ？"],['determined',"A wrong word still has power. Let's try again!","間違えた言葉にも力はある。もう一回いこうぜ！"]],
 nene:[['smile',"The clouds look like little cats.","雲が小さな猫みたい。"],['puzzled',"Did I pack lunch... or a pillow?","お弁当を入れたっけ……それとも枕だった？"],['smile',"Let's take our time. We can find a new path.","ゆっくり行こう。新しい道を見つけられるよ。"]]
};
function talk(who){talkCharacter=who;talkStep=0;translated=false;showTalk();}
function showTalk(){
 const line=LINES[talkCharacter][talkStep];
 modal(`<div class="eyebrow">風待ちの町 · ${talkStep+1} / 3</div><div class="talk"><img src="assets/${talkCharacter}_${line[0]}.png" alt="${talkCharacter==='kiki'?'キキ':'ネネ'}の表情"><div><h2>${talkCharacter==='kiki'?'キキ':'ネネ'}</h2>${translated?`<p class="translation">${line[2]}</p>`:''}<p class="english" lang="en">${E(line[1])}</p></div></div><div class="row">${btn(translated?'訳を隠す':'日本語を重ねる','translate')}${btn(talkStep<2?'次へ':'会話を終える',talkStep<2?'nextTalk':'close','','primary')}</div>`);
}
function startBattle(index){
 const r=REGIONS[state.region],boss=r.nodes[index][1]==='boss',danger=r.danger||boss;
 const enemy=boss?'ancient_forest_stag':r.enemies[index%r.enemies.length],hp=danger?170:48+(state.region==='grass'?0:18);
 if(!Rules.start(state,{enemy,enemyHP:hp,enemyMax:hp,attack:danger?23:9,nodeKey:`${state.region}:${index}`,log:danger?'強い魔力を感じる。育ててから戻っても大丈夫。':'魔獣が現れた。言葉を呪文に変えよう。'})){notify('同行する仲間が倒れています。町の宿屋か泉で回復してください。');return;}state.view='battle';save();battle();
}
function battle(){
 clearScene();header();const b=state.battle,r=REGIONS[state.region],m=member();if(!b)return region();
 $('#scene').innerHTML=`<section class="battle arena" style="--battle-art:url('${ASSETS[r.bg].img}')"><div class="battlefield"><div class="health enemy-health">${ASSETS[b.enemy].name}<progress value="${b.enemyHP}" max="${b.enemyMax}"></progress><span>HP ${b.enemyHP} / ${b.enemyMax}</span></div>${image(b.enemy,'sprite enemy'+(b.enemyHP<=0?' defeated':''))}</div><div class="battle-window"><div class="party-status trio">${b.units.map(uid=>{const u=Rules.unit(state,uid);return `<button class="team-unit ${uid===state.active?'acting':''} ${u.hp<=0?'fainted':''}" data-action="actor" data-arg="${uid}" data-unit="${uid}" ${b.phase!=='choose'||b.acted.includes(uid)||u.hp<=0?'disabled':''}>${image(u.id,'sprite '+(uid===state.active?'ally':'companion'))}<div class="health ${uid===state.active?'ally-health':''}">${b.units.indexOf(uid)+1}. ${ASSETS[u.id].name}<progress value="${u.hp}" max="${Rules.maxHP(u)}"></progress><span>HP ${u.hp}/${Rules.maxHP(u)}</span><small>${u.hp<=0?'戦闘不能':b.acted.includes(uid)?'行動済み':uid===state.active?'行動中':'未行動'}</small></div></button>`;}).join('')}</div><div class="battle-panel" id="commands" data-phase="${b.phase}"></div></div><div class="battle-log" role="status"></div></section>`;
 const panel=$('#commands');
 const title=Rules.SPELLS.find(s=>s.id===b.spell);
 const head=(name)=>`<div class="command-heading"><h2>${name}</h2>${btn('詳細','combatInfo','','quiet')}</div>`;
 if(b.phase==='choose'){
  panel.innerHTML=head(ASSETS[m.id].name+'の番')+`<div class="spell-grid">${Rules.SPELLS.map(s=>btn(`${s.name}<span>${s.kind==='heal'?'回復':'威力'} ${s.power+(m.level-1)*4} · ${{basic:'基礎',standard:'標準',challenge:'挑戦'}[s.difficulty]}</span>`,'spell',s.id,'spell')).join('')}</div><div class="command-bottom"><small>全員が行動すると敵の番 · MP消費なし</small>${btn('退却','retreat','','quiet')}</div>`;
 }else if(b.phase==='question'){
  const q=QUESTIONS.find(q=>q.id===b.questionId);
  panel.innerHTML=head(title.name+(title.kind==='heal'?' → '+ASSETS[Rules.unit(state,b.target).id].name:''))+`<div class="question-copy"><p class="cue">${E(q.cue_ja)}</p><div class="question" lang="en">${E(q.prompt_en)}</div></div><div class="choices">${q.options.map((o,i)=>btn(E(o),'answer',i)).join('')}</div><div class="command-bottom"><small>正解100% / 不正解50%</small>${btn('退却','retreat','','quiet')}</div>`;
 }else if(b.phase==='result'){
  const q=QUESTIONS.find(q=>q.id===b.questionId),a=b.result;
  panel.innerHTML=head(a.right?'正解！':'呪文は届いた！')+`<div class="result ${a.right?'':'wrong'}"><strong>${a.kind==='heal'?'回復':'ダメージ'} ${a.amount}</strong><span>${a.right?'100%':'50%'} の効果${a.kind==='heal'?' · '+ASSETS[Rules.unit(state,a.target).id].name:''}</span></div><p class="answer-line">正解：<strong lang="en">${E(q.answer)}</strong></p><div class="command-bottom">${btn('解説','combatInfo','','quiet')}${btn(b.enemyHP<=0?'勝利の報酬へ':'次の行動へ','continue','','primary')}</div>`;
 }else if(b.phase==='won'){
  panel.innerHTML=head('勝利！')+`<div class="result"><strong>星砂 +2 · 経験値 +2</strong><span>${ASSETS[m.id].name} Lv.${m.level}</span></div><p>${ASSETS[b.enemy].name}と心が通じました。</p>${btn('探索を続ける','finish','','primary')}`;
 }else if(b.phase==='lost'){
  panel.innerHTML=head('ひと休みしよう')+`<p>仲間も星砂も失いません。</p>${btn('探索へ戻る','finish','','primary')}`;
 }
}

function spell(id){if(id==='heal'&&state.battle?.phase==='choose'){modal('<h2>回復する仲間</h2>'+state.battle.units.map(uid=>{const u=Rules.unit(state,uid);return btn(ASSETS[u.id].name+' ('+uid+') HP '+u.hp+'/'+Rules.maxHP(u),'healTarget',uid);}).join('')+btn('戻る','close'));return;}prepareSpell(id);}
function prepareSpell(id){const b=state.battle;if(!b||b.phase!=='choose')return;const s=Rules.SPELLS.find(s=>s.id===id);b.spell=id;b.questionId=Rules.pick(QUESTIONS,state,s.difficulty).id;b.phase='question';save();battle();}
function answer(index){if(combatAnimating)return;const b=state.battle;if(!b||b.phase!=='question')return;const q=QUESTIONS.find(q=>q.id===b.questionId),s=Rules.SPELLS.find(s=>s.id===b.spell);const result=Rules.cast(state,q,index,s);if(!result)return;save();playCombat({spell:s.id,kind:s.kind,amount:result.amount,weak:!result.right,enemy:false,target:result.target,defeated:b.enemyHP<=0});}
function nextTurn(){
 if(combatAnimating)return;
 const b=state.battle;if(!b||b.phase!=='result')return;
 if(b.enemyHP<=0){Rules.reward(state);save();battle();return;}
 const hit=Rules.enemyTurn(state);
 if(!hit)return;if(hit.nextOnly){save();battle();return;}
 b.log=`${ASSETS[b.enemy].name}の「木霊の呪文」！ ${hit.amount}ダメージ。`;
 save();playCombat({spell:'echo',kind:'damage',amount:hit.amount,enemy:true,target:hit.target,defeated:Rules.unit(state,hit.target).hp<=0});
}
function finish(){if(state.battle?.phase==='lost')state.team.forEach(id=>{const u=Rules.unit(state,id);u.hp=Math.max(1,u.hp);});state.battle=null;state.view='region';save();region();}
function card(id,extra=''){return `<article class="card">${image(id)}<h3>${ASSETS[id].name}</h3>${extra}</article>`;}
function roster(){
 clearScene();state.view='roster';header();save();
 $('#scene').innerHTML=`<section class="collection"><div class="collection-head"><h1>仲間の編成</h1>${btn('ワールドへ','world')}</div><p>同行 ${state.team.length}/3体。外した仲間は所持したままです。先に1体外すと入れ替えられます。</p><div class="cards">${state.party.map(m=>card(m.id,`<p>Lv.${m.level} · 個体 ${m.uid} · HP ${m.hp}/${Rules.maxHP(m)}</p>${btn(state.team.includes(m.uid)?'同行から外す':'同行させる','team',m.uid,state.team.includes(m.uid)?'primary':'')}`)).join('')}</div>${btn('道具を使う','inventory')}</section>`;
}
let pendingBreed=null;
function breeding(){
 close();pendingBreed=null;clearScene();state.view='breed';header();save();
 $('#scene').innerHTML=`<section class="collection"><div class="collection-head"><h1>配合工房</h1>${btn('モリーの案内','facility','breeding_guide')}${btn('ワールドへ','world')}</div><p>親の個体2体と星砂3つを消費し、子1体が生まれます。同じ種類の別個体は残ります。</p><div class="recipes">${RECIPES.map(r=>`<div class="recipe-group"><div class="recipe">${card(r.parents[0])}<b>＋</b>${card(r.parents[1])}<b>→</b>${card(r.child)}</div>${btn('親を選ぶ · 星砂3','previewBreed',r.id)}</div>`).join('')}</div></section>`;
}
function previewBreed(id){const r=RECIPES.find(r=>r.id===id);if(!r)return;pendingBreed=null;modal(`<h2>配合する親を選ぶ</h2><p>${r.parents.map(x=>ASSETS[x].name).join(' ＋ ')} → ${ASSETS[r.child].name}</p>${r.parents.map((species,i)=>`<label>親${i+1}<select id="parent${i}">${state.party.filter(m=>m.id===species).map(m=>`<option value="${m.uid}">${ASSETS[m.id].name} · ${m.uid} · Lv.${m.level}${state.team.includes(m.uid)?' (同行中)':''}</option>`).join('')}</select></label>`).join('')}<p>所持星砂：${state.dust}</p>${btn('結果を確認','reviewBreed',id)}${btn('やめる','close')}`);}
function reviewBreed(id){const r=RECIPES.find(r=>r.id===id),parents=[$('#parent0').value,$('#parent1').value];if(!r||!parents[0]||!parents[1]||parents[0]===parents[1]||state.dust<3){notify('異なる親2体と星砂3つが必要です。');return;}pendingBreed={id,parents};modal(`<h2>この2体を消費して配合しますか？</h2>${card(r.child)}<p>${parents.map(uid=>{const m=Rules.unit(state,uid);return ASSETS[m.id].name+' ('+uid+')';}).join(' ＋ ')} は所持・同行からいなくなります。子はLv.1で加入します。</p><p>星砂 −3。取り消す場合は「やめる」を選んでください。</p>${btn('親2体を消費して配合','confirmBreed',id,'primary')}${btn('やめる','close')}`);}

function settings(first=false){
 modal(`<div class="eyebrow">${first?'BEGIN YOUR JOURNEY':'SETTINGS'}</div><h2>${first?'最初に、学習帯を選ぼう。':'旅の設定'}</h2><p>小1入門から中3目安まで。学習帯はいつでも変更できます。学年区分と難易度はゲーム用の目安です。</p><label for="band">英語の学習帯</label><select id="band">${Rules.LEVELS.map(l=>`<option ${l===state.band?'selected':''}>${l}</option>`).join('')}</select><p class="muted">正解100%・不正解50%。制限時間はありません。</p>${loadError?`<p class="warning">${loadError}</p>`:''}<div class="row">${btn(first?'冒険をはじめる':'設定を保存','saveSettings','','primary')}${first?'':btn('閉じる','close')}</div>${!first?`<hr><p>このブラウザーに自動保存。別の場所へ移す場合は保存ファイルを書き出してください。</p><div class="row">${btn('保存を書き出す','export')}${btn('保存を読み込む','import')}${btn('新しい旅','reset','','danger')}</div><input id="saveFile" type="file" accept=".json" hidden>`:''}`);
}
function exportSave(){
 const raw=loadError?localStorage.getItem(SAVE):JSON.stringify(state,null,2),url=URL.createObjectURL(new Blob([raw||''],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download='words-wilds-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function help(){modal(`<div class="eyebrow">FIELD NOTES</div><h2>旅の手引き</h2><p>① 草原の町から、明るいマスをタップ。分岐を自由に選び、周回して道を開きます。赤い山は最初から入れますが強敵です。</p><p>② 呪文を選び、英語問題に答えます。味方の攻撃・回復はすべて呪文。正解100%、不正解50%。相手も呪文で反撃します。</p><p>③ 勝つと仲間・経験・星砂。最大3体を編成し、全員の行動後に敵が反撃します。配合は親の個体2体を消費します。</p><p>④ 草原の坑道から地下、森の階段から空中へ。試作は地上3＋地下1＋空中1、計35マスです。背景の地下・空中専用素材、全18配合、技継承、BGMは未実装です。</p><p>学習問題370問を搭載。キキ・ネネの町会話は別の自由会話です。設定から保存を持ち出せます。</p>${btn('旅に戻る','close','','primary')}`);}

// Effects are presentation only. Rules/save commit once before the visual sequence.
let combatAnimating=false;
async function playCombat(hit){
 if(combatAnimating)return;
 combatAnimating=true;
 const arena=$('.arena'),commands=$('#commands');
 if(!arena){combatAnimating=false;battle();return;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const source=arena.querySelector(hit.enemy?'.enemy':'.ally');
 const target=(hit.kind==='heal'||hit.enemy)?arena.querySelector('[data-unit="'+hit.target+'"] img')||arena.querySelector('.ally'):arena.querySelector('.enemy');
 const base=arena.getBoundingClientRect(),sr=source.getBoundingClientRect(),tr=target.getBoundingClientRect();
 const from={x:sr.left-base.left+sr.width*.5,y:sr.top-base.top+sr.height*.48};
 const to={x:tr.left-base.left+tr.width*.5,y:tr.top-base.top+tr.height*.48};
 commands.inert=true;commands.setAttribute('aria-busy','true');
 commands.querySelectorAll('button').forEach(b=>b.disabled=true);
 const layer=document.createElement('div');layer.className='combat-fx '+hit.spell+(hit.weak?' weak':'');layer.setAttribute('aria-hidden','true');arena.appendChild(layer);
 const log=arena.querySelector('.battle-log');
 log.textContent=hit.kind==='heal'?'いやしの露が仲間を包む…':hit.enemy?'相手が呪文を唱えている…':'呪文が相手へ向かう…';
 const animations=[];
 const motion=async(el,frames,duration)=>{
  const a=el.animate(reduced?[{opacity:1},{opacity:1}]:frames,{duration:reduced?160:duration,easing:'ease-out',fill:'forwards'});animations.push(a);
  try{await a.finished;}catch{}
 };
 const mote=(cls,x,y,text='')=>{const e=document.createElement('span');e.className=cls;e.style.left=x+'px';e.style.top=y+'px';e.textContent=text;layer.appendChild(e);return e;};
 try{
  const aura=mote('cast-aura',from.x,from.y);
  source.classList.add('casting');
  await Promise.all([
   motion(aura,[{opacity:0,scale:'.5'},{opacity:1,scale:'1.15'},{opacity:0,scale:'1.35'}],250),
   reduced?Promise.resolve():motion(source,[{translate:'0 0'},{translate:(hit.enemy?'12px':'-8px')+' 0'},{translate:(hit.enemy?'-18px':'10px')+' -3px'},{translate:'0 0'}],380)
  ]);
  source.classList.remove('casting');
  if(hit.kind!=='heal'){
   const orb=mote('spell-projectile',from.x,from.y,hit.spell==='star'?'✦':hit.spell==='wind'?'◌':'');
   await motion(orb,[{translate:'0 0',opacity:1},{translate:(to.x-from.x)+'px '+(to.y-from.y)+'px',opacity:1}],reduced?90:hit.spell==='wind'?340:300);
   orb.remove();
  }
  const b=state.battle,health=[arena.querySelector('.ally-health'),arena.querySelector('.enemy-health')];
  arena.querySelectorAll('[data-unit]').forEach(el=>{const u=Rules.unit(state,el.dataset.unit);el.querySelector('progress').value=u.hp;el.querySelector('.health span').textContent='HP '+u.hp+'/'+Rules.maxHP(u);});
  health[1].querySelector('progress').value=b.enemyHP;health[1].querySelector('span').textContent='HP '+b.enemyHP+' / '+b.enemyMax;
  const ring=mote(hit.kind==='heal'?'heal-bloom':'impact-ring',to.x,to.y,hit.kind==='heal'?'✧':'');
  const number=mote('effect-number '+(hit.kind==='heal'?'healing':''),to.x,to.y-30,(hit.kind==='heal'?'+':'−')+hit.amount);
  const note=mote('effect-caption',to.x,to.y+10,hit.weak?'50%':hit.enemy?'木霊の呪文':'100%');
  if(hit.kind!=='heal'){
   target.classList.add('receiving-hit');
   if(!reduced){for(let i=0;i<6;i++){const p=mote('hit-spark',to.x,to.y);const angle=i*Math.PI/3;
    motion(p,[{translate:'0 0',opacity:1},{translate:Math.cos(angle)*48+'px '+Math.sin(angle)*40+'px',opacity:0}],390);}}
  }
  log.textContent=hit.kind==='heal'?'回復 '+hit.amount+(hit.weak?'（50%）':'（100%）'):hit.enemy?ASSETS[Rules.unit(state,hit.target).id].name+'に '+hit.amount+' ダメージ':'相手に '+hit.amount+' ダメージ'+(hit.weak?'（50%）':'（100%）');
  await Promise.all([
   motion(ring,[{opacity:1,scale:'.5'},{opacity:0,scale:'1.8'}],500),
   motion(number,[{opacity:0,translate:'0 8px'},{opacity:1,offset:.18,translate:'0 -8px'},{opacity:1,offset:.8,translate:'0 -24px'},{opacity:0,translate:'0 -30px'}],850),
   motion(note,[{opacity:1},{opacity:0}],850),
   reduced||hit.kind==='heal'?Promise.resolve():motion(target,[{opacity:1,translate:'0 0'},{opacity:.35,translate:(hit.enemy?'-10px':'10px')+' 0',offset:.25},{opacity:1,translate:'0 0',offset:.55},{opacity:.6,offset:.7},{opacity:1,translate:'0 0'}],360)
  ]);
  if(hit.defeated)await motion(target,[{opacity:1},{opacity:.2}],240);
 }finally{
  animations.forEach(a=>a.cancel());source.classList.remove('casting');target.classList.remove('receiving-hit');layer.remove();
  combatAnimating=false;battle();
 }
}
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const a=el.dataset.action,x=el.dataset.arg;
 if(opening&&['tapBegin','startJourney'].includes(a)){if(a==='tapBegin')showTitle();else beginJourney();return;}
 if(opening||combatAnimating)return;
 if(state.battle&&!['spell','answer','continue','finish','retreat','combatInfo','close','actor','healTarget'].includes(a))return;
 if(a==='actor'){if(Rules.selectActor(state,x)){save();battle();}return;}if(a==='healTarget'){if(state.battle?.phase==='choose'&&state.battle.units.includes(x)){state.battle.target=x;close();prepareSpell('heal');}return;}
 if(a==='combatInfo'){combatInfo();return;}
 if(a==='selectMap'){selectMap(x);return;}
 if(a==='enterMap'){enterMap();return;}
 if(a==='world')world();else if(a==='layer'){state.layer=x;world();}
 else if(a==='region')region(x);else if(a==='node')node(Number(x));
 else if(a==='npcTalk')npcConversation(x);else if(a==='npcFaceTranslate'){const n=TOWN_NPCS[x];modal('<h2>'+n.name+'</h2><div class="talk">'+npcArt(x,true)+'<div><p class="translation">'+n.ja+'</p><p class="english" lang="en">'+n.en+'</p></div></div>'+btn('訳を隠す','npcTalk',x)+btn('施設へ戻る','facility',x));}else if(a==='facility')facility(x);else if(a==='npcTranslate'){townTranslated=!townTranslated;facility(townRole,true);}else if(a==='buy'){if(Rules.buy(state,x)){save();header();facility('item_shop',true);}else notify('星砂が足りないか、持ち物がいっぱいです。');}else if(a==='inn'){if(Rules.inn(state)){save();header();facility('inn',true);notify('全員が元気になりました。');}else notify('全員元気か、星砂が足りません。');}else if(a==='inventory')inventory();else if(a==='useItem'){if(Rules.use(state,'dew',x)){save();inventory();}else notify('道具がないか、HPが満タンです。');}else if(a==='town')town();else if(a==='talk')talk(x);else if(a==='translate'){translated=!translated;showTalk();}
 else if(a==='nextTalk'){talkStep++;translated=false;showTalk();}
 else if(a==='close'){pendingBreed=null;close();}else if(a==='roster')roster();else if(a==='team'){const ids=state.team.includes(x)?state.team.filter(id=>id!==x):[...state.team,x];if(Rules.setTeam(state,ids)){save();roster();}else notify('同行は1〜3体です。先に別の仲間を外してください。');}
 else if(a==='breed')breeding();else if(a==='previewBreed')previewBreed(x);
 else if(a==='reviewBreed')reviewBreed(x);else if(a==='confirmBreed'){const pending=pendingBreed;pendingBreed=null;if(pending&&pending.id===x&&Rules.breed(state,RECIPES.find(r=>r.id===x),pending.parents)){save();close();breeding();notify('新しい仲間が生まれました！');}}
 else if(a==='spell')spell(x);else if(a==='answer')answer(Number(x));else if(a==='continue')nextTurn();else if(a==='finish')finish();
 else if(a==='retreat'){finish();notify('無事に退却しました。育ててからまた挑戦できます。');}
 else if(a==='settings')settings();else if(a==='saveSettings'){state.band=$('#band').value;state.started=true;close();save();header();}
 else if(a==='help')help();else if(a==='export')exportSave();
 else if(a==='reset')modal(`<h2>新しい旅を始めますか？</h2><p>この試作の保存だけを初期化します。必要なら先に保存を書き出してください。</p><div class="row">${btn('初期化する','confirmReset','','danger')}${btn('戻る','settings')}</div>`);
 else if(a==='confirmReset'){loadError='';state=Rules.fresh();save();close();world();settings(true);}
 else if(a==='import')$('#saveFile').click();
});
document.addEventListener('change',async e=>{
 if(e.target.id!=='saveFile'||!e.target.files[0])return;
 try{const parsed=Rules.migrate(JSON.parse(await e.target.files[0].text()));if(!validSave(parsed))throw Error();
 state=parsed;loadError='';save();close();render();notify('保存データを読み込みました。');
 }catch(err){notify('保存形式が正しくありません。現在の旅は変更していません。');}
});
function render(){if(state.battle)battle();else if(state.view==='region')region();else if(state.view==='roster')roster();else if(state.view==='breed')breeding();else world();}
$('#modal').addEventListener('cancel',e=>{if(!state.started)e.preventDefault();});

let opening=true;
function showTitle(){
 document.body.classList.add('title-ready');
 $('#opening-title').hidden=false;
 $('#tap-gate').remove();
 $('#journey-start').focus();
}
function beginJourney(){
 if(!opening)return;
 opening=false;
 document.body.classList.add('journey-entering');
 const overlay=$('#opening');
 overlay.inert=true;
 setTimeout(()=>{
  overlay.remove();
  document.body.classList.remove('opening-mode','title-ready','journey-entering');
  if(state.battle||state.view!=='world')render();
  if(!state.started)settings(true);else if(loadError)settings();
 },550);
}
function openingScreen(){
 document.title='ごちゃまぜモンスター';
 document.body.classList.add('opening-mode');
 world(true);
 const overlay=document.createElement('section');
 overlay.id='opening';
 overlay.setAttribute('aria-label','ごちゃまぜモンスターのスタート画面');
 overlay.innerHTML=`<div id="opening-title" hidden><div class="opening-heading"><p>WORDS, WONDERS & MONSTERS</p><h1>ごちゃまぜ<br><span>モンスター</span></h1><p class="opening-sub">ことばでつながる、ふしぎな仲間たち。</p></div><div class="opening-companions"><figure><img src="assets/kiki_determined.png" alt="クリーム色の猫、キキ"><figcaption>KIKI / キキ</figcaption></figure><figure><img src="assets/nene_smile.png" alt="銀白の猫、ネネ"><figcaption>NENE / ネネ</figcaption></figure></div><div class="opening-start"><button id="journey-start" data-action="startJourney">スタート <span>→</span></button><p>${state.started?'保存した冒険から再開':'はじめての冒険へ'}</p></div></div><button id="tap-gate" data-action="tapBegin"><span class="tap-emblem">✦</span><strong>タップして開始</strong><small>TAP TO BEGIN</small></button>`;
 $('#scene').appendChild(overlay);
 $('#tap-gate').focus();
}
fitScreen();
openingScreen();


// The frame fits the visible viewport; controls remain in normal, unscaled DOM coordinates.
function fitScreen(){
 const v=window.visualViewport,style=getComputedStyle(document.body),pad=n=>parseFloat(style[n])||0;
 const availableW=(v?v.width:innerWidth)-pad('paddingLeft')-pad('paddingRight')-12;
 const availableH=(v?v.height:innerHeight)-pad('paddingTop')-pad('paddingBottom')-12;
 const portrait=availableH>availableW,ratio=portrait?9/16:16/9;
 const width=availableW,height=availableH;
 const app=$('#app');app.style.width=width+'px';app.style.height=height+'px';
 app.style.left=((v?v.offsetLeft:0)+pad('paddingLeft')+(availableW+12-width)/2)+'px';
 app.style.top=((v?v.offsetTop:0)+pad('paddingTop')+(availableH+12-height)/2)+'px';
 document.documentElement.style.setProperty('--frame-height',height+'px');
 document.documentElement.style.setProperty('--frame-width',width+'px');
 app.classList.toggle('portrait-frame',portrait);
}
window.addEventListener('resize',fitScreen);window.visualViewport?.addEventListener('resize',fitScreen);window.visualViewport?.addEventListener('scroll',fitScreen);
var selectedMap;
function tidyMap(isWorld){
 selectedMap=null;
 const map=$('.map');if(!map)return;
 map.querySelectorAll('.intro,.region-title,.map-note').forEach(e=>e.remove());
 const name=isWorld?'ワールドマップ':REGIONS[state.region].name;
 const strip=document.createElement('div');strip.className='map-info';
 strip.innerHTML=`<div><small>${isWorld?'地上・地下・空中':REGIONS[state.region].sub}</small><h1>${name}</h1></div><div id="place-name" aria-live="polite">マスを選んでください</div>`;
 map.appendChild(strip);
 const field=document.createElement('div');field.className='node-field';
 if(!isWorld){const canvas=$('#map-canvas');field.appendChild(canvas);}
 map.querySelectorAll('.node').forEach((n,i)=>{
  const oldAction=n.dataset.action,id=n.dataset.arg,disabled=n.disabled,done=n.classList.contains('done');
  const label=oldAction==='region'?REGIONS[id].name:REGIONS[state.region].nodes[Number(id)][0];
  n.dataset.destination=oldAction;n.dataset.action='selectMap';n.dataset.arg=id;
  n.setAttribute('aria-label',disabled?'未解放のマス':label);n.title=disabled?'未解放':label;
  n.innerHTML=`<span aria-hidden="true">${disabled?'·':done?'✓':n.classList.contains('danger')?'!':'◇'}</span>`;
  field.appendChild(n);
 });
 map.appendChild(field);
 const loc=state.location||{region:'grass',index:0};const geo=Geography.areas[loc.region];
 if(isWorld){Object.entries(Geography.areas).filter(([id])=>REGIONS[id].layer===state.layer).forEach(([id,g])=>{const box=document.createElement('div');box.className='region-range';box.dataset.region=id;box.style.cssText='left:'+g.bounds[0]+'%;top:'+g.bounds[1]+'%;width:'+g.bounds[2]+'%;height:'+g.bounds[3]+'%';field.prepend(box);});}
 if(geo&&(isWorld?REGIONS[loc.region].layer===state.layer:loc.region===state.region)){const p=geo.points[loc.index]||geo.anchor,xy=isWorld?p:Geography.local(loc.region,p);const marker=document.createElement('span');marker.className='you-are-here';marker.setAttribute('aria-label','現在地');marker.style.left=xy[0]+'%';marker.style.top=xy[1]+'%';marker.textContent='●';field.appendChild(marker);}
 const current=document.createElement('small');current.className='current-location';current.textContent='現在地：'+REGIONS[loc.region].name+' / '+REGIONS[loc.region].nodes[loc.index][0]+(!isWorld&&Geography.areas[state.region].projection?' · '+Geography.areas[state.region].projection:'');strip.appendChild(current);
 const controls=document.createElement('div');controls.className='map-selection';controls.innerHTML=btn('選択した場所へ','enterMap','','primary');controls.firstElementChild.disabled=true;map.appendChild(controls);
 attachMapCamera(map,field,isWorld);
}
function selectMap(id){
 const n=Array.from(document.querySelectorAll('.node')).find(e=>e.dataset.arg===id);if(!n||n.disabled)return;
 document.querySelectorAll('.node').forEach(e=>{e.classList.remove('selected');e.setAttribute('aria-pressed','false');});n.classList.add('selected');n.setAttribute('aria-pressed','true');
 selectedMap={type:n.dataset.destination,id};document.querySelectorAll('.region-range').forEach(e=>e.classList.toggle('chosen',e.dataset.region===id));
 mapPositions[selectedMap.type==='region'?'world-'+state.layer:state.region]={x:parseFloat(n.style.left)*10,y:parseFloat(n.style.top)*5.625};
 const label=selectedMap.type==='region'?REGIONS[id].name:REGIONS[state.region].nodes[Number(id)][0];
 $('#place-name').textContent=label+(n.classList.contains('danger')?' · 強敵注意':'');
 const go=$('[data-action="enterMap"]');go.disabled=false;go.textContent=selectedMap.type==='region'?'このエリアへ':'このマスへ';
}
function enterMap(){if(!selectedMap)return;const pick=selectedMap;selectedMap=null;if(pick.type==='region')region(pick.id);else node(Number(pick.id));}
function combatInfo(){
 const b=state.battle;if(!b)return;
 const q=b.phase==='result'?QUESTIONS.find(q=>q.id===b.questionId):null;
 modal(`<div class="eyebrow">BATTLE NOTES</div><h2>${q?'ことばの解説':'戦闘の手引き'}</h2><p>${q?E(q.explanation_ja):'呪文を選んで英語に答えます。正解は100%、不正解も50%の効果。MPは消費しません。強い呪文ほど同じ学習帯の難しい問題になります。'}</p>${q?`<small>${state.band} · ${E(q.id)}</small>`:''}${btn('戻る','close','','primary')}`);
}

function attachMapCamera(map,field,isWorld){
 const viewport=document.createElement('div');viewport.className='map-viewport';viewport.setAttribute('aria-label','地図：ドラッグで移動、ホイールやピンチで拡大縮小');
 field.before(viewport);viewport.appendChild(field);
 if(isWorld){const art=map.querySelector(':scope > img');field.prepend(art);}
 const w=1000,h=562.5;field.style.width=w+'px';field.style.height=h+'px';
 const camera=new MapCamera(w,h,viewport.clientWidth,viewport.clientHeight);
 const key=isWorld?'world-'+state.layer:state.region;
 const loc=state.location||{region:'grass',index:0},g=Geography.areas[loc.region],p=g.points[loc.index]||g.anchor;
 const center=isWorld?p:Geography.local(state.region,loc.region===state.region?p:Geography.areas[state.region].points[0]);
 const focus=mapPositions[key]||{x:center[0]*10,y:center[1]*5.625};
 camera.focus(focus.x,focus.y,Math.max(1.8,Math.max(camera.vw/w,camera.vh/h)/camera.fit*1.12));
 const toolbar=document.createElement('div');toolbar.className='map-tools';toolbar.innerHTML='<button type="button" aria-label="地図を縮小">−</button><output aria-live="polite"></output><button type="button" aria-label="地図を拡大">＋</button><button type="button">全体表示</button>';
 map.appendChild(toolbar);
 const draw=()=>{field.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;field.style.setProperty('--marker-scale',1/camera.scale);toolbar.querySelector('output').textContent=Math.round(camera.zoom*100)+'%';};
 const buttons=toolbar.querySelectorAll('button');buttons[0].onclick=()=>{camera.zoomAt(camera.zoom/1.3);draw();};buttons[1].onclick=()=>{camera.zoomAt(camera.zoom*1.3);draw();};buttons[2].onclick=()=>{camera.focus(w/2,h/2,1);draw();};
 viewport.addEventListener('wheel',e=>{e.preventDefault();const r=viewport.getBoundingClientRect();camera.zoomAt(camera.zoom*Math.exp(-e.deltaY*.002),e.clientX-r.left,e.clientY-r.top);draw();},{passive:false});
 const pointers=new Map();let moved=false,suppressUntil=0,gesture;
 const metrics=()=>{const p=[...pointers.values()];return p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}:{...p[0],d:0};};
 viewport.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;e.target.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});if(pointers.size===1)moved=false;else moved=true;gesture=metrics();});
 viewport.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;const p={...old,x:e.clientX,y:e.clientY};pointers.set(e.pointerId,p);if(Math.hypot(p.x-p.startX,p.y-p.startY)>7)moved=true;if(!moved)return;e.preventDefault();const next=metrics();if(pointers.size>1&&gesture.d>0){const r=viewport.getBoundingClientRect();camera.zoomAt(camera.zoom*next.d/gesture.d,gesture.x-r.left,gesture.y-r.top);}camera.pan(next.x-gesture.x,next.y-gesture.y);gesture=next;draw();});
 const end=e=>{if(!pointers.has(e.pointerId))return;if(moved||e.type==='pointercancel')suppressUntil=performance.now()+450;pointers.delete(e.pointerId);if(pointers.size)gesture=metrics();};
 ['pointerup','pointercancel','lostpointercapture'].forEach(type=>viewport.addEventListener(type,end));
 viewport.addEventListener('click',e=>{if(moved||performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 const observer=new ResizeObserver(()=>{camera.resize(viewport.clientWidth,viewport.clientHeight);draw();});observer.observe(viewport);
 mapCleanup=()=>observer.disconnect();draw();
}
