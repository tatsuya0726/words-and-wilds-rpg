/* Coordinates are percentages of the single world image. Region views are exact crops. */
(function(root){
const areas={
 grass:{bounds:[22,32,42,42],anchor:[31,69],points:[[31,69],[34,59],[40,63],[42,48],[46,58],[51,49],[36,43],[42,52]]},
 forest:{bounds:[5,10,42,42],anchor:[36,43],points:[[34,39],[28,38],[23,44],[22,28],[33,31],[29,21],[31,25],[36,43]]},
 volcano:{bounds:[60,5,38,38],anchor:[81,35],points:[[79,31],[85,29],[89,36],[87,22],[91,27],[86,18],[81,35]]},
 cave:{bounds:[22,32,42,42],anchor:[42,52],points:[[45,48],[44,50],[46,54],[48,47],[50,51],[42,52]],projection:'地下の位置を地表へ投影'},
 sky:{bounds:[5,10,42,42],anchor:[31,25],points:[[34,29],[33,22],[36,26],[38,18],[40,23],[31,25]],projection:'空中の位置を地表へ投影'}
};
function local(id,p){const [x,y,w,h]=areas[id].bounds;return [(p[0]-x)/w*100,(p[1]-y)/h*100];}
const api={areas,local};if(typeof module!=='undefined')module.exports=api;else root.Geography=api;
})(typeof globalThis!=='undefined'?globalThis:this);
