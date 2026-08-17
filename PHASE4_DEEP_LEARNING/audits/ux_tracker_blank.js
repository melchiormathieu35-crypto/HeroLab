const { chromium } = require("playwright");
const path=require("path");
const APP="file://"+path.resolve(__dirname,"../../VERSION_PRODUCTION/herolab.html");
(async()=>{
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
for(const W of [360,390,412]){
const c=await b.newContext({viewport:{width:W,height:844},isMobile:true,hasTouch:true});
const p=await c.newPage();
await p.goto(APP);await p.waitForTimeout(500);
await p.fill("#obName","M");await p.click("#obStart");await p.waitForTimeout(250);
await p.evaluate(()=>App.go("tracker"));await p.waitForTimeout(900);
const r=await p.evaluate(()=>{
  const box=document.getElementById("v-tracker");
  const sb=box.querySelector("#sidebar");
  const main=box.querySelector(".main,.ft-main")||box.querySelector(".app>*:nth-child(2)");
  const rect=e=>{if(!e)return null;const q=e.getBoundingClientRect();return{y:Math.round(q.top+window.scrollY),h:Math.round(q.height),w:Math.round(q.width),vis:getComputedStyle(e).display,op:getComputedStyle(e).opacity,txt:(e.innerText||"").trim().length};};
  // premier élément réellement visible avec du texte
  const items=[...box.querySelectorAll("*")].filter(e=>e.offsetParent&&(e.innerText||"").trim()&&!e.children.length)
    .map(e=>({y:Math.round(e.getBoundingClientRect().top+window.scrollY),t:e.innerText.trim().slice(0,30)})).sort((a,b)=>a.y-b.y);
  return {sidebar:rect(sb),main:rect(main),total:box.scrollHeight,premiers:items.slice(0,5)};
});
console.log("W="+W,JSON.stringify(r,null,1));
await c.close();}
await b.close();})();
