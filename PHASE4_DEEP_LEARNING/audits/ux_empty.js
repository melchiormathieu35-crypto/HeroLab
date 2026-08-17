const { chromium } = require("playwright");
const path=require("path");
const APP="file://"+path.resolve(__dirname,"../../VERSION_PRODUCTION/herolab.html");
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await c.newPage();
await p.goto(APP);await p.waitForTimeout(500);await p.fill("#obName","M");await p.click("#obStart");await p.waitForTimeout(250);
for(const v of ["stats","leaks","career","profiles","theory","hrstats","prstats","blstats"]){
 await p.evaluate(x=>App.go(x),v);await p.waitForTimeout(300);
 const r=await p.evaluate(x=>{const e=document.getElementById("v-"+x);if(!e)return null;
  return {h:e.scrollHeight,txt:(e.innerText||"").trim().slice(0,320),btns:[...e.querySelectorAll("button")].map(b=>b.innerText.trim().split("\n")[0]).filter(Boolean)};},v);
 console.log("### "+v, JSON.stringify(r,null,1));}
await b.close();})();
