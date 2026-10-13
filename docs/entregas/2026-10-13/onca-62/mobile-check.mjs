import {chromium} from '/home/thivieira/.bun/install/cache/playwright-core@1.64.0@@@1/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome'});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 let page=await context.newPage(); page.on('pageerror',e=>console.error('pageerror',e.message));
 const base='https://oficina-amarela-web-staging.casamarela.workers.dev';
 await page.goto(`${base}/login`);
 await page.getByLabel('Apelido ou e-mail',{exact:true}).fill('ed.j1788179332361');
 await page.getByLabel('Senha',{exact:true}).fill(process.env.OFICINA_STAGING_PASSWORD);
 await page.getByRole('button',{name:'Entrar na Oficina Amarela',exact:true}).click();
 await page.waitForURL('**/editor');
 await page.getByRole('heading',{name:'Mural de missões gratuitas',exact:true}).waitFor();
 await page.getByRole('heading',{name:'ONCA-62 — mural sintético com dois editores',exact:true}).waitFor();
 await page.getByText('Missão indisponível para novos interesses',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Tenho interesse',exact:true}).count(),0);
 const width=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 assert.ok(width.document<=width.viewport,JSON.stringify(width));
 await page.screenshot({path:'/home/thivieira/dev/missao/pactodaconcordia/oficina-amarela/docs/entregas/2026-10-13/onca-62/editor-a-mobile.png',fullPage:true});
 console.log(JSON.stringify({mobile:width,editorA:'mission unavailable, no claim or interest action'}));
 await context.close();
 const voiceContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); page=await voiceContext.newPage();
 await page.goto(`${base}/login`);await page.getByLabel('Apelido ou e-mail',{exact:true}).fill('qs.1791818566.v');await page.getByLabel('Senha',{exact:true}).fill(process.env.OFICINA_STAGING_PASSWORD);await page.getByRole('button',{name:'Entrar na Oficina Amarela',exact:true}).click();await page.waitForURL('**/porta-voz');
 await page.goto(`${base}/porta-voz/missao/db-39`);await page.getByText('Oferta aceita por Editor B — ensaio sintético. A missão segue na produção.',{exact:true}).waitFor();
 const selectionWidth=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(selectionWidth.document<=selectionWidth.viewport,JSON.stringify(selectionWidth));
 await page.screenshot({path:'/home/thivieira/dev/missao/pactodaconcordia/oficina-amarela/docs/entregas/2026-10-13/onca-62/porta-voz-mobile.png',fullPage:true});
 console.log(JSON.stringify({spokespersonMobile:selectionWidth,selectedEditor:'B, acceptance persisted'}));
}finally{await browser.close();}
