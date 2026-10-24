/* One selection for each opening mount, never for a resize or title redraw. */
(function(root){
 const sources=['assets/title-0.png','assets/title-1.png','assets/title-2.png'];
 function order(random=Math.random){
  const first=Math.min(2,Math.max(0,Math.floor(random()*3)));
  return sources.map((_,i)=>sources[(first+i)%sources.length]);
 }
 async function mount(host){
  const sequence=order();
  host.dataset.artState='loading';
  for(const source of sequence){
   if(!host.isConnected)return;
   const img=new Image();img.alt='';img.className='opening-art';img.decoding='async';
   const loaded=await new Promise(resolve=>{
    let settled=false;
    const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);img.onload=img.onerror=null;resolve(ok);};
    const timer=setTimeout(()=>finish(false),5000);
    img.onload=()=>finish(true);img.onerror=()=>finish(false);img.src=source;
   });
   if(!loaded)continue;
   try{await img.decode();}catch{continue;}
   if(!host.isConnected)return;
   host.prepend(img);host.dataset.artState='ready';host.dataset.artSource=source;
   return;
  }
  host.dataset.artState='fallback';
 }
 root.OpeningArt={sources,order,mount};
})(typeof window==='undefined'?globalThis:window);
