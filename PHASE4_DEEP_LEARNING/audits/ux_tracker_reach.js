const { chromium } = require("playwright");
const path=require("path");
const APP="file://"+path.resolve(__dirname,"../../VERSION_PRODUCTION/herolab.html");
(async()=>{
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
for(const W of [360,390,412,768,1200]){
const c=await b.newContext({viewport:{width:W,height:844},isMobile:W<600,hasTouch:W<600});
const p=await c.newPage();
await p.goto(APP);await p.waitForTimeout(500);
await p.fill("#obName","M");await p.click("#obStart");await p.waitForTimeout(250);
await p.evaluate(()=>App.go("tracker"));await p.waitForTimeout(900);
const r=await p.evaluate(()=>{
 const sb=document.querySelector("#v-tracker #sidebar");
 const it=sb.querySelector(".ft-nav-item");
 const q=it.getBoundingClientRect();
 // qui est réellement au point central de l'item ?
 const cx=q.left+q.width/2, cy=q.top+q.height/2;
 const hit=document.elementFromPoint(Math.max(1,Math.min(innerWidth-1,cx)),Math.max(1,Math.min(innerHeight-1,cy)));
 return {tx:getComputedStyle(sb).transform,itemX:Math.round(q.left),itemRight:Math.round(q.right),
  horsEcran:q.right<=0,
  cible:hit?hit.className.toString().slice(0,40)+"|"+(hit.innerText||"").trim().slice(0,20):null,
  ftView:window.__ft?null:null};
});
console.log("W="+W,JSON.stringify(r));
await c.close();}
await b.close();})();
