const { chromium } = require("playwright");
const path=require("path");
const APP="file://"+path.resolve(__dirname,"../../VERSION_PRODUCTION/herolab.html");
const OUT=path.resolve(__dirname,"screens");
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await c.newPage();
await p.goto(APP);await p.waitForTimeout(500);await p.fill("#obName","M");await p.click("#obStart");await p.waitForTimeout(250);
// jouer 3 spots BL
await p.evaluate(()=>App.go("bl"));await p.waitForTimeout(300);
for(let i=0;i<3;i++){
 await p.evaluate(()=>BLUI.begin());await p.waitForTimeout(350);
 await p.evaluate(()=>{const o=document.querySelector("#v-bl .bl-opt");if(o)o.click();});await p.waitForTimeout(150);
 await p.evaluate(()=>{if(BLUI.canValidate())BLUI.validate();});await p.waitForTimeout(300);
}
await p.evaluate(()=>BLUI.quit());await p.waitForTimeout(400);
await p.screenshot({path:path.join(OUT,"46-bl-after-quit-with-data.png"),fullPage:true});
console.log(JSON.stringify(await p.evaluate(()=>{
 const box=document.getElementById("v-bl");
 const cards=[...box.querySelectorAll(".card")].map(e=>({t:(e.innerText||"").trim().split("\n")[0],y:Math.round(e.getBoundingClientRect().top+window.scrollY)}));
 return {h:box.scrollHeight,vh:innerHeight,cards,premierMot:(box.innerText||"").trim().split("\n").slice(0,4)};
}),null,1));
await b.close();})();
