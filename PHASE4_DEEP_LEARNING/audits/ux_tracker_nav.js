const { chromium } = require("playwright");
const path=require("path");
const APP="file://"+path.resolve(__dirname,"../../VERSION_PRODUCTION/herolab.html");
(async()=>{
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const p=await c.newPage();
await p.goto(APP);await p.waitForTimeout(500);
await p.fill("#obName","M");await p.click("#obStart");await p.waitForTimeout(250);
await p.evaluate(()=>App.go("tracker"));await p.waitForTimeout(900);
console.log(JSON.stringify(await p.evaluate(()=>{
const sb=document.querySelector("#v-tracker #sidebar");
const cs=getComputedStyle(sb);
const items=[...sb.querySelectorAll(".ft-nav-item")].slice(0,3).map(e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();
 return {t:e.innerText.trim(),color:s.color,bg:s.backgroundColor,op:s.opacity,vis:s.visibility,y:Math.round(r.top+window.scrollY),h:Math.round(r.height),w:Math.round(r.width),clip:s.clipPath,ov:s.overflow};});
return {sidebar:{h:Math.round(sb.getBoundingClientRect().height),color:cs.color,bg:cs.backgroundColor,transform:cs.transform,op:cs.opacity,vis:cs.visibility,pos:cs.position,overflow:cs.overflow,zIndex:cs.zIndex},items,
 nItems:sb.querySelectorAll(".ft-nav-item").length};
}),null,1));
await b.close();})();
