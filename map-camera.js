/* One coordinate transform for terrain, paths, markers and pointer hit testing. */
(function(root){
 class MapCamera{
  constructor(w,h,vw,vh){this.w=w;this.h=h;this.vw=vw;this.vh=vh;this.zoom=1;this.x=0;this.y=0;}
  get fit(){return Math.min(this.vw/this.w,this.vh/this.h);}
  get scale(){return this.fit*this.zoom;}
  clamp(){const s=this.scale;this.x=this.w*s<=this.vw?(this.vw-this.w*s)/2:Math.min(0,Math.max(this.vw-this.w*s,this.x));this.y=this.h*s<=this.vh?(this.vh-this.h*s)/2:Math.min(0,Math.max(this.vh-this.h*s,this.y));return this;}
  focus(x,y,zoom=2){this.zoom=Math.max(1,Math.min(5,zoom));this.x=this.vw/2-x*this.scale;this.y=this.vh/2-y*this.scale;return this.clamp();}
  zoomAt(zoom,x=this.vw/2,y=this.vh/2){const old=this.scale,wx=(x-this.x)/old,wy=(y-this.y)/old;this.zoom=Math.max(1,Math.min(5,zoom));this.x=x-wx*this.scale;this.y=y-wy*this.scale;return this.clamp();}
  pan(dx,dy){this.x+=dx;this.y+=dy;return this.clamp();}
  resize(vw,vh){const x=(this.vw/2-this.x)/this.scale,y=(this.vh/2-this.y)/this.scale;this.vw=vw;this.vh=vh;return this.focus(x,y,this.zoom);}
 }
 root.MapCamera=MapCamera;if(typeof module!=='undefined')module.exports=MapCamera;
})(typeof window==='undefined'?globalThis:window);
