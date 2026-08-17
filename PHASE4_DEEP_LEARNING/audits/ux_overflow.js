const { chromium } = require("playwright");
const path=require("path");
const APP="file://"+path.resolve("/home/user/HeroLab/VERSION_PRODUCTION/herolab.html");
(async()=>{
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
for(const W of [360,390,412]){
const c=await b.newContext({viewport:{width:W,height:800},isMobile:true,hasTouch:true});
const p=await c.newPage();
await p.goto(APP);await p.waitForTimeout(500);
await p.fill("#obName","M");await p.click("#obStart");await p.waitForTimeout(300);
// générer des données
await p.evaluate(()=>{App.go("play");for(let i=0;i<40;i++){App.newHand();let g=0;while(App.phase!=="result"&&g++<12){if(App.phase==="decide"){const o=Spot.options(App.t);const k=o[Math.floor(Math.random()*o.length)];App.choose(k.action,k.amount);}else if(App.phase==="review")App.continueHand();else break;}}});
const views=["home","play","career","stats","hr","pr","bl","daily","leaks","tracker","journey","profiles","theory","profile","setup"];
const out={};
for(const v of views){
  await p.evaluate(vv=>App.go(vv),v);await p.waitForTimeout(300);
  out[v]=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bodySw:document.body.scrollWidth}));
}
console.log("W="+W, JSON.stringify(out));
await c.close();
}
await b.close();
})();
