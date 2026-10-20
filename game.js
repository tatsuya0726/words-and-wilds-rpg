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
let state=Rules.fresh(), loadError='', renderer, worldScene, sceneStamp=0, talkStep=0, talkCharacter='kiki', translated=false;
function validSave(parsed){
 if(!Rules.valid(parsed)||parsed.party.some(m=>!ASSETS[m.id])||!REGIONS[parsed.region])return false;
 return !parsed.battle||(!!ASSETS[parsed.battle.enemy]&&(!parsed.battle.questionId||QUESTIONS.some(q=>q.id===parsed.battle.questionId)));
}
try{const raw=localStorage.getItem(SAVE);if(raw){const parsed=JSON.parse(raw);if(!validSave(parsed))throw Error('形式');state=parsed;}}catch(e){loadError='保存データを読み込めませんでした。既存データは保護しています。設定から別名バックアップを保存後、初期化できます。';}
function save(){if(loadError)return;try{localStorage.setItem(SAVE,JSON.stringify(state));$('#saved').textContent='保存済み · このブラウザー';}catch(e){$('#saved').textContent='保存できません · 設定から書き出せます';}}
function notify(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
const btn=(text,action,arg='',cls='')=>`<button class="${cls}" data-action="${action}" data-arg="${E(arg)}">${text}</button>`;
const image=(id,cls='')=>`<img class="${cls}" src="${ASSETS[id].img}" alt="${E(ASSETS[id].name||id)}">`;
const member=()=>state.party.find(m=>m.id===state.active);
function header(){
 $('#status').textContent=`${state.band} · 星砂 ${state.dust} · 仲間 ${state.party.length}`;
 document.querySelectorAll('header button').forEach(b=>b.disabled=!!state.battle);
 $('#hint').textContent=state.battle?'正解で100%、不正解でも50%。間違えても呪文は届く。':'明るいマスをタップして探索。強敵からはいつでも退却できます。';
}
function modal(html){$('#modalBody').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function close(){ $('#modal').close(); }
function clearScene(){sceneStamp++;if(renderer){renderer.destroy(true);renderer=null;worldScene=null;}}
function paintPhaser(region){
 const host=$('#map-canvas');if(!host)return;
 const stamp=sceneStamp;
 class View extends Phaser.Scene{
  preload(){this.load.image('terrain',ASSETS[region.art].img);}
  create(){
   if(stamp!==sceneStamp)return;
   worldScene=this;
   this.back=this.add.image(0,0,'terrain').setOrigin(.5);
   this.paths=this.add.graphics();
   this.layout=()=>{
    const w=this.scale.width,h=this.scale.height;
    this.back.setPosition(w/2,h/2);
    const scale=Math.max(w/this.back.width,h/this.back.height);this.back.setScale(scale);
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
 const layer=state.layer||'ground';const coords={grass:[38,67],forest:[66,44],volcano:[81,75],cave:[56,66],sky:[59,56]};
 $('#scene').innerHTML=`<section class="map world-map ${layer}">${image('world')}<div class="intro"><div class="eyebrow">WORDS & WILDS</div><h1>ごちゃまぜ<br>モンスター</h1><p>ひとつの言葉が、<br>まだ見ぬ仲間への道になる。</p><span class="pill">小さな旅の試作 · 5エリア</span></div><div class="layer-tabs" aria-label="世界の層">${[['ground','地上'],['below','地下'],['sky','空中']].map(([id,label])=>btn(label,'layer',id,layer===id?'primary':'')).join('')}</div>${Object.entries(REGIONS).filter(([,r])=>r.layer===layer).map(([id,r])=>`<button class="node ${r.danger?'danger':''}" style="left:${coords[id][0]}%;top:${coords[id][1]}%" data-action="region" data-arg="${id}" ${unlockedRegion(id)?'':'disabled'}><strong>${r.name}</strong><small>${unlockedRegion(id)?r.danger?'強敵 Lv.6目安 / 初めから挑戦可':'探索する':id==='cave'?'草原の坑道から解放':'森の階段から解放'}</small></button>`).join('')}<div class="map-note">地上3・地下1・空中1の試作区画<br>地下と空中の背景は既存素材を仮使用</div><div class="map-actions">${btn('町でひと休み','town')}${btn('旅の手引き','help')}</div></section>`;
}
function accessible(id,index){if(index===0)return true;return REGIONS[id].edges.some(([a,b])=>(a===index&&state.cleared.includes(`${id}:${b}`))||(b===index&&state.cleared.includes(`${id}:${a}`)));}
function region(id=state.region){
 if(!REGIONS[id]||!unlockedRegion(id))return;
 clearScene();state.region=id;state.layer=REGIONS[id].layer;state.view='region';save();header();const r=REGIONS[id];
 $('#scene').innerHTML=`<section class="map region ${r.layer}"><div id="map-canvas" aria-hidden="true"></div><div class="region-title"><div class="eyebrow">${r.sub}</div><h2>${r.name}</h2><small>${state.cleared.filter(k=>k.startsWith(id+':')).length} / ${r.nodes.length} マス探索済み</small></div>${r.nodes.map((n,i)=>{const done=state.cleared.includes(`${id}:${i}`),open=accessible(id,i);return `<button class="node ${done?'done':''} ${n[1]==='boss'?'danger':''}" style="left:${n[2]}%;top:${n[3]}%" data-action="node" data-arg="${i}" ${open?'':'disabled'}><strong>${open?n[0]:'？'}</strong><small>${!open?'隣のマスを探索':done?'✓ 探索済み':({town:'英語で会話・回復',battle:'呪文バトル',rest:'休憩・道を開く',treasure:'星砂を拾う',gate:'次のエリアへ',boss:'強敵バトル',talk:'ネネとの会話'}[n[1]])}</small></button>`;}).join('')}<div class="map-actions">${btn('← ワールド','world')}</div></section>`;
 paintPhaser(r);
}
function mark(index){const k=`${state.region}:${index}`;if(!state.cleared.includes(k))state.cleared.push(k);save();}
function node(index){
 if(state.battle||!accessible(state.region,index))return;const r=REGIONS[state.region],n=r.nodes[index];
 if(n[1]==='battle'||n[1]==='boss')return startBattle(index);
 const done=state.cleared.includes(`${state.region}:${index}`);mark(index);
 if(n[1]==='gate'){state.layer=REGIONS[n[4]].layer;return region(n[4]);}
 region();
 if(n[1]==='town')town();
 if(n[1]==='talk')talk('nene');
 if(n[1]==='rest')notify('泉でひと休み。次の戦いは全回復で始まります。周囲の道が開きました。');
 if(n[1]==='treasure'){if(!done){state.dust+=3;save();header();}notify(done?'宝箱は空です。':'星砂を3つ見つけました。配合に使えます。');}
}
function town(){modal(`<div class="eyebrow">HAVEN / 風待ちの町</div><h2>旅の合間に、ひとこと。</h2><p>キキとネネが待っています。会話は英語。訳はいつでも重ねて表示できます。</p><div class="town-cats">${image('kiki')}${image('nene')}</div><div class="row">${btn('キキと話す','talk','kiki')}${btn('ネネと話す','talk','nene')}${btn('配合工房','breed')}${btn('町を出る','close')}</div>`);}
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
 state.battle={enemy,enemyHP:hp,enemyMax:hp,hp:Rules.maxHP(member()),attack:danger?23:9,nodeKey:`${state.region}:${index}`,phase:'choose',turn:0,log:danger?'強い魔力を感じる。育ててから戻っても大丈夫。':'魔獣が現れた。言葉を呪文に変えよう。'};state.view='battle';save();battle();
}
function battle(){
 clearScene();header();const b=state.battle,r=REGIONS[state.region],m=member();if(!b)return region();
 $('#scene').innerHTML=`<section class="battle" style="background-image:url('${ASSETS[r.bg].img}')"><div class="arena"><div class="battle-top"><div class="health">${ASSETS[m.id].name} · Lv.${m.level}<progress value="${b.hp}" max="${Rules.maxHP(m)}"></progress><span>HP ${b.hp} / ${Rules.maxHP(m)}</span></div><div class="health">${ASSETS[b.enemy].name}<progress value="${b.enemyHP}" max="${b.enemyMax}"></progress><span>HP ${b.enemyHP} / ${b.enemyMax}</span></div></div>${image(m.id,'sprite ally')}${image(b.enemy,'sprite enemy')}<div class="battle-log" role="status">${E(b.log)}</div></div><div class="battle-panel" id="commands"></div></section>`;
 const panel=$('#commands');
 if(b.phase==='choose'){
  panel.innerHTML=`<div class="eyebrow">SPELLBOOK / ${state.band}</div><h2>どの言葉を唱える？</h2><p class="muted">威力が高いほど、同じ学習帯の難しい問題。</p>${Rules.SPELLS.map(s=>btn(`${s.name}<span>${s.en} · ${s.kind==='heal'?'回復':'威力'} ${s.power+(m.level-1)*4} · ${{basic:'基礎',standard:'標準',challenge:'挑戦'}[s.difficulty]}</span>`,'spell',s.id,'spell')).join('')}${btn('退却する','retreat')}`;
 }else if(b.phase==='question'){
  const q=QUESTIONS.find(q=>q.id===b.questionId);
  panel.innerHTML=`<div class="eyebrow">${state.band} / ${q.id}</div><h2>${Rules.SPELLS.find(s=>s.id===b.spell).name}</h2><p class="cue">${E(q.cue_ja)}</p><div class="question" lang="en">${E(q.prompt_en)}</div><div class="choices">${q.options.map((o,i)=>btn(E(o),'answer',i)).join('')}</div><p class="muted quiz-rule">正解100%・不正解50% / 答えるまで解説は表示しません</p>${btn('退却する','retreat')}`;
 }else if(b.phase==='result'){
  const q=QUESTIONS.find(q=>q.id===b.questionId),a=b.result;
  panel.innerHTML=`<div class="eyebrow">SPELL CAST</div><h2>${a.right?'言葉が響いた！':'呪文は届いた！'}</h2><div class="result ${a.right?'':'wrong'}"><strong>${a.right?'100%':'50%'} の効果 · ${a.kind==='heal'?'回復':'ダメージ'} ${a.amount}</strong><p>基準 ${a.base} × ${a.right?'1.0':'0.5'}</p></div><p>正解：<strong lang="en">${E(q.answer)}</strong></p><p>${E(q.explanation_ja)}</p>${btn(b.enemyHP<=0?'勝利の報酬へ':'相手のターンへ','continue','','primary')}`;
 }else if(b.phase==='won'){
  panel.innerHTML=`<div class="eyebrow">VICTORY</div><h2>新しい道が開いた。</h2><p>${ASSETS[b.enemy].name}と心が通じました。</p><div class="result">星砂 +2 / 経験値 +2<br>${ASSETS[m.id].name} Lv.${m.level}</div><p class="muted">未加入の魔獣は仲間になります。加入済みなら経験を重ねます。</p>${btn('探索を続ける','finish','','primary')}`;
 }else if(b.phase==='lost'){
  panel.innerHTML=`<div class="eyebrow">TAKE A BREATH</div><h2>今日はひと休み。</h2><p>仲間や星砂は失いません。草原で育ててから戻りましょう。</p>${btn('入口へ戻る','finish','','primary')}`;
 }
}
function spell(id){const b=state.battle;if(!b||b.phase!=='choose')return;const s=Rules.SPELLS.find(s=>s.id===id);b.spell=id;b.questionId=Rules.pick(QUESTIONS,state,s.difficulty).id;b.phase='question';save();battle();}
function answer(index){const b=state.battle;if(!b||b.phase!=='question')return;const q=QUESTIONS.find(q=>q.id===b.questionId),s=Rules.SPELLS.find(s=>s.id===b.spell);Rules.cast(state,q,index,s);save();battle();}
function nextTurn(){const b=state.battle;if(!b||b.phase!=='result')return;if(b.enemyHP<=0){Rules.reward(state);}else{b.hp=Math.max(0,b.hp-b.attack);b.turn++;b.log=`${ASSETS[b.enemy].name}の「木霊の呪文」！ ${b.attack}ダメージ。`;b.phase=b.hp<=0?'lost':'choose';}save();battle();}
function finish(){state.battle=null;state.view='region';save();region();}
function card(id,extra=''){return `<article class="card">${image(id)}<h3>${ASSETS[id].name}</h3>${extra}</article>`;}
function roster(){
 clearScene();state.view='roster';header();save();
 $('#scene').innerHTML=`<section class="collection"><div class="collection-head"><div><div class="eyebrow">COMPANIONS</div><h1>旅の仲間</h1></div>${btn('ワールドへ','world')}</div><p>戦いを重ねるとレベルアップ。3経験値ごとにHPと呪文の力が育ちます。</p><div class="cards">${state.party.map(m=>card(m.id,`<p>Lv.${m.level} · 経験 ${m.xp} / 3</p><small>HP ${Rules.maxHP(m)}</small>${btn(state.active===m.id?'先頭の仲間':'先頭にする','active',m.id,state.active===m.id?'primary':'')}`)).join('')}</div></section>`;
}
function breeding(){
 close();clearScene();state.view='breed';header();save();
 $('#scene').innerHTML=`<section class="collection"><div class="collection-head"><div><div class="eyebrow">BOND WORKSHOP</div><h1>ふたつの縁、新しい仲間。</h1></div>${btn('ワールドへ','world')}</div><p>固定レシピ3組を実装。星砂3つで1種につき一度配合できます。<br><small>試作用ルール：親は残ります。必要レベル・技の継承は未実装です。</small></p><div class="recipes">${RECIPES.map(r=>{const has=r.parents.every(id=>state.party.some(m=>m.id===id)),owned=state.party.some(m=>m.id===r.child);return `<div class="recipe-group"><div class="recipe">${card(r.parents[0])}<b>＋</b>${card(r.parents[1])}<b>→</b>${card(r.child)}</div><button data-action="previewBreed" data-arg="${r.id}" ${!has||owned||state.dust<3?'disabled':''}>${owned?'配合先の仲間が加入済み':!has?'親になる仲間が必要':state.dust<3?'星砂が不足':'配合を確認 · 星砂3'}</button></div>`;}).join('')}</div></section>`;
}
function previewBreed(id){const r=RECIPES.find(r=>r.id===id);modal(`<h2>この組み合わせで配合しますか？</h2><p>${r.parents.map(x=>ASSETS[x].name).join(' ＋ ')} → ${ASSETS[r.child].name}</p>${card(r.child)}<p>星砂を3つ使います。親の2体は残り、子はLv.1で加入します。</p><div class="row">${btn('配合する','confirmBreed',id,'primary')}${btn('やめる','close')}</div>`);}
function settings(first=false){
 modal(`<div class="eyebrow">${first?'BEGIN YOUR JOURNEY':'SETTINGS'}</div><h2>${first?'最初に、学習帯を選ぼう。':'旅の設定'}</h2><p>小1入門から中3目安まで。学習帯はいつでも変更できます。学年区分と難易度はゲーム用の目安です。</p><label for="band">英語の学習帯</label><select id="band">${Rules.LEVELS.map(l=>`<option ${l===state.band?'selected':''}>${l}</option>`).join('')}</select><p class="muted">正解100%・不正解50%。制限時間はありません。</p>${loadError?`<p class="warning">${loadError}</p>`:''}<div class="row">${btn(first?'冒険をはじめる':'設定を保存','saveSettings','','primary')}${first?'':btn('閉じる','close')}</div>${!first?`<hr><p>このブラウザーに自動保存。別の場所へ移す場合は保存ファイルを書き出してください。</p><div class="row">${btn('保存を書き出す','export')}${btn('保存を読み込む','import')}${btn('新しい旅','reset','','danger')}</div><input id="saveFile" type="file" accept=".json" hidden>`:''}`);
}
function exportSave(){
 const raw=loadError?localStorage.getItem(SAVE):JSON.stringify(state,null,2),url=URL.createObjectURL(new Blob([raw||''],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download='words-wilds-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function help(){modal(`<div class="eyebrow">FIELD NOTES</div><h2>旅の手引き</h2><p>① 草原の町から、明るいマスをタップ。分岐を自由に選び、周回して道を開きます。赤い山は最初から入れますが強敵です。</p><p>② 呪文を選び、英語問題に答えます。味方の攻撃・回復はすべて呪文。正解100%、不正解50%。相手も呪文で反撃します。</p><p>③ 勝つと仲間・経験・星砂。配合工房で固定レシピの仲間を迎えます。</p><p>④ 草原の坑道から地下、森の階段から空中へ。試作は地上3＋地下1＋空中1、計35マスです。背景の地下・空中専用素材、全18配合、技継承、BGMは未実装です。</p><p>学習問題370問を搭載。キキ・ネネの町会話は別の自由会話です。設定から保存を持ち出せます。</p>${btn('旅に戻る','close','','primary')}`);}
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const a=el.dataset.action,x=el.dataset.arg;
 if(opening&&['tapBegin','startJourney'].includes(a)){if(a==='tapBegin')showTitle();else beginJourney();return;}
 if(opening)return;
 if(state.battle&&!['spell','answer','continue','finish','retreat'].includes(a))return;
 if(a==='world')world();else if(a==='layer'){state.layer=x;world();}
 else if(a==='region')region(x);else if(a==='node')node(Number(x));
 else if(a==='town')town();else if(a==='talk')talk(x);else if(a==='translate'){translated=!translated;showTalk();}
 else if(a==='nextTalk'){talkStep++;translated=false;showTalk();}
 else if(a==='close')close();else if(a==='roster')roster();else if(a==='active'){state.active=x;save();roster();}
 else if(a==='breed')breeding();else if(a==='previewBreed')previewBreed(x);
 else if(a==='confirmBreed'){if(Rules.breed(state,RECIPES.find(r=>r.id===x))){save();close();breeding();notify('新しい仲間が生まれました！');}}
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
 try{const parsed=JSON.parse(await e.target.files[0].text());if(!validSave(parsed))throw Error();
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
openingScreen();

