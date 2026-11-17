import {test,expect} from '@playwright/test';
const biz=(id:number)=>({id,nombre:'Negocio '+id,status:true,zona_horaria:'America/Tijuana',plan:{codigo:'free',nombre:'Free'}});
const ctx={usuario:{id:1},puede_portal:true,es_admin_sistema:false,negocios:[biz(1),biz(2)],sucursales:[{id:11,negocio:1,nombre:'Centro',status:true},{id:12,negocio:1,nombre:'Norte',status:true}],membresias:[1,2].map(id=>({id,negocio:biz(id),rol_comercio:'dueno',status:true,sucursal:null}))};
const metrics=(id:number)=>({desde:'2026-11-01',hasta:'2026-11-17',alcance:'negocio',visitas_validas:id*100,clientes_unicos:10,puntos_otorgados:null,cupones_canjeados:2,top_recompensas:[]});
const clients=(name:string)=>({count:45,page:1,page_size:20,results:[{id:1,nombre:name,apellido:'',correo:'audit@example.invalid',visitas:1,puntos:5,cupones:2,ultima_visita:null}]});
test.beforeEach(async({page})=>{
 await page.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname!=='127.0.0.1'){await route.abort();return;}
 if(!u.pathname.startsWith('/api/')){await route.continue();return;}
 const id=Number(u.pathname.match(/negocios\/(\d+)/)?.[1]||1);
 let body:any={count:0,results:[]};
 if(u.pathname.endsWith('/perfil/'))body={id:1,correo:'owner@example.invalid'};
 if(u.pathname.endsWith('/contexto/'))body=ctx;
 if(u.pathname.endsWith('/metricas/'))body=metrics(id);
 if(u.pathname.endsWith('/plan/'))body={negocio:id,plan:{codigo:'free',nombre:'Free'},limites:Object.fromEntries(['sucursales','tarjetas_sellos','recompensas','supervisores','empleados','programas_puntos'].map(k=>[k,{uso:1,limite:3,disponible:2,excedido:false}])),excedentes:[],caracteristicas:{},caracteristicas_implementadas:[]};
 if(u.pathname.endsWith('/clientes/'))body=clients(u.searchParams.get('buscar')||'Initial');
 if(['/dinamicas/listar/','/recompensas/listar/','/sucursales/listar/','/usuarios-negocio/listar/'].some(p=>u.pathname.endsWith(p))||u.pathname.endsWith('/invitaciones/'))body=[];
 await route.fulfill({json:body});
 });
});
test('search debounce, safe continuity and obsolete responses',async({page})=>{
 await page.goto('/portal/negocio/1/clientes');await expect(page.getByRole('cell',{name:'Initial',exact:true})).toBeVisible();
 let release:any;let started:any;const held=new Promise(r=>started=r);
 await page.route('**/clientes/**',async route=>{
 const q=new URL(route.request().url()).searchParams.get('buscar');
 if(q==='a'){started();await new Promise(r=>release=r);}
 await route.fulfill({json:clients(q||'Initial')});
 });
 const input=page.getByPlaceholder('Cliente o correo');await input.fill('a');await held;
 await expect(page.getByRole('cell',{name:'Initial',exact:true})).toBeVisible();
 await input.fill('ab');await expect(page.getByRole('cell',{name:'ab',exact:true})).toBeVisible();release();
 await expect(page.getByRole('cell',{name:'a',exact:true})).toHaveCount(0);
});
test('changing business discards pending metrics and preserves branch on navigation',async({page})=>{
 await page.goto('/portal/negocio/1');await expect(page.locator('.portal-kpi strong').first()).toHaveText('100');
 let release:any;let started:any;const held=new Promise(r=>started=r);
 await page.route('**/negocios/1/metricas/**',async route=>{started();await new Promise(r=>release=r);await route.fulfill({json:metrics(1)});});
 await page.getByRole('button',{name:'Actualizar',exact:true}).click();await held;
 await page.locator('.portal-selector select').first().selectOption('2');
 await expect(page.locator('.portal-kpi strong').first()).toHaveText('200');release();
 await expect(page.locator('h1')).toHaveText('Negocio 2');await expect(page.locator('.portal-kpi strong').first()).toHaveText('200');
 await page.unroute('**/negocios/1/metricas/**');
 await page.goto('/portal/negocio/1?sucursal=11');await page.getByRole('link',{name:'Visitas',exact:true}).click();
 await expect(page).toHaveURL(/visitas\?sucursal=11/);await expect(page.locator('.portal-filters select').first()).toHaveValue('11');
});
test('mobile drawer, responsive header and fonts',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto('/portal/negocio/1/clientes');await expect(page.locator('table')).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
 const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 const doc=await cdp.send('DOM.getDocument');const node=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'h1'});
 const fonts=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});
 expect(fonts.fonts.some((f:any)=>f.familyName.includes('Jakarta'))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.lang)).toBe('es-MX');
 expect(await page.evaluate(()=>document.querySelector('.portal-topbar')!.scrollWidth<=320)).toBe(true);
 const trigger=page.getByRole('button',{name:/^Abrir/});await trigger.click();
 const drawer=page.getByRole('dialog');await expect(drawer).toBeVisible();
 await page.getByRole('button',{name:/^Cerrar men/}).focus();await page.keyboard.press('Shift+Tab');
 await expect(page.getByRole('button',{name:/^Cerrar sesi/})).toBeFocused();
 await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/portal/negocio/1');await expect(page.locator('.portal-kpi')).not.toHaveCount(0);
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});
});
test('all owner sections and public routes load',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['','clientes','visitas','canjes','cupones','puntos','tarjetas','recompensas','equipo','sucursales']){
 await page.goto('/portal/negocio/1/'+route);await expect(page.locator('h1')).toBeVisible();
 }
 for(const route of ['/','/about','/precios','/login','/registro','/recuperar']){await page.goto(route);await expect(page.locator('h1').first()).toBeVisible();}
 expect(errors).toEqual([]);
});

test('date changes do not reload plan and focus without permission changes does not reload metrics',async({page})=>{
 await page.goto('/portal/negocio/1');await expect(page.locator('.portal-kpi strong').first()).toHaveText('100');
 const calls:string[]=[];page.on('request',r=>{if(r.url().includes('/api/'))calls.push(r.url());});
 const metricsDone=page.waitForResponse(r=>r.url().includes('/metricas/'));
 await page.getByLabel('Desde',{exact:true}).fill('2026-11-01');await metricsDone;
 expect(calls.filter(u=>u.includes('/plan/'))).toHaveLength(0);
 calls.length=0;
 const contextDone=page.waitForResponse(r=>r.url().includes('/mi/contexto/'));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await contextDone;
 await page.waitForTimeout(100);
 expect(calls.filter(u=>u.includes('/metricas/'))).toHaveLength(0);
});

test('an invitation failure does not hide the independently loaded team',async({page})=>{
 await page.route('**/invitaciones/',route=>route.fulfill({status:500,json:{detail:'Invitations unavailable'}}));
 await page.goto('/portal/negocio/1/equipo');
 await expect(page.getByText(/No hay membres/)).toBeVisible();
});
