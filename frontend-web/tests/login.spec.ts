import {test,expect} from '@playwright/test';
const profile={id:1,nombre:'Owner',apellido:'Test',correo:'owner@example.invalid',rol:'consumidor',is_active:true};
const business={id:1,nombre:'Existing business',status:true,zona_horaria:'America/Tijuana',plan:{codigo:'free',nombre:'Free'}};
const context={usuario:profile,puede_portal:true,es_admin_sistema:false,negocios:[business],sucursales:[],membresias:[{id:1,negocio:business,rol_comercio:'dueno',status:true,sucursal:null}]};
async function observe(page:any){
 await page.addInitScript(()=>{
  sessionStorage.setItem('benefy-test-signed-out','1');
  const trace={paths:[] as string[],errors:[] as string[]};(window as any).__loginTrace=trace;
  for(const method of ['pushState','replaceState'] as const){
   const original=history[method].bind(history);
   history[method]=(...args:any[])=>{original(...args as [any,string,string]);trace.paths.push(location.pathname);};
  }
  new MutationObserver(()=>{const title=document.querySelector('h1')?.textContent??'';if(title.includes('No pudimos terminar'))trace.errors.push(title);}).observe(document,{childList:true,subtree:true});
 });
}
async function submit(page:any){
 await page.goto('/login');await page.locator('#login-user').fill(profile.correo);
 await page.locator('#login-pass').fill('synthetic-password');
 await page.locator('#btn-primary-login').click();
}
async function fixture(page:any,handle:any){
 await page.route('**/*',async(route:any)=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='127.0.0.1'){await route.abort();return;}
  if(url.pathname==='/__test-auth/login'){await route.fulfill({json:{data:{session:{access_token:'fixture',user:{id:'owner'}}},error:null}});return;}
  if(!url.pathname.startsWith('/api/')){await route.continue();return;}
  if(await handle(route,url))return;
  if(url.pathname.endsWith('/perfil/')){await route.fulfill({json:profile});return;}
  if(url.pathname.endsWith('/contexto/')){await route.fulfill({json:context});return;}
  if(url.pathname.endsWith('/plan/')){await route.fulfill({json:{negocio:1,plan:business.plan,limites:{},excedentes:[],caracteristicas:{},caracteristicas_implementadas:[]}});return;}
  if(url.pathname.endsWith('/metricas/')){await route.fulfill({json:{desde:'2026-11-01',hasta:'2026-11-17',alcance:'negocio',visitas_validas:100,clientes_unicos:10,puntos_otorgados:null,cupones_canjeados:2,top_recompensas:[]}});return;}
  throw Error('Unexpected request '+url.pathname);
 });
}
test('existing business login awaits hydration instead of entering registration error',async({page})=>{
 await observe(page);
 const profileGate=Promise.withResolvers<void>();
 const profileRequested=Promise.withResolvers<void>();
 const contextGate=Promise.withResolvers<void>();
 const contextRequested=Promise.withResolvers<void>();
 const http:{path:string,status:number}[]=[];
 const requests:string[]=[];
 page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/api/'))http.push({path:url.pathname,status:response.status()});});
 await fixture(page,async(route:any,url:URL)=>{
  requests.push(url.pathname);
  if(url.pathname.endsWith('/perfil/')){profileRequested.resolve();await profileGate.promise;await route.fulfill({json:profile});return true;}
  if(url.pathname.endsWith('/contexto/')){contextRequested.resolve();await contextGate.promise;await route.fulfill({json:context});return true;}
  return false;
 });
 await submit(page);await profileRequested.promise;
 if(process.env.BENEFY_TEST_AUTH_REVISION){
  await expect(page.getByRole('heading',{name:'No pudimos terminar de crear tu negocio'})).toBeVisible();
  console.log('Historical reproduction: registration error while profile is pending; HTTP failures:',http.filter(r=>r.status>=400).length);
 }else{
  await expect(page.locator('#btn-primary-login')).toBeDisabled();
  expect((await page.evaluate(()=>(window as any).__loginTrace)).errors).toEqual([]);
 }
 profileGate.resolve();
 await contextRequested.promise;
 if(!process.env.BENEFY_TEST_AUTH_REVISION)await expect(page.locator('#btn-primary-login')).toBeDisabled();
 contextGate.resolve();
 await expect(page.locator('.portal-kpi strong').first()).toHaveText('100');
 const trace=await page.evaluate(()=>(window as any).__loginTrace);
 if(!process.env.BENEFY_TEST_AUTH_REVISION){expect(trace.paths).not.toContain('/completar-registro');expect(trace.errors).toEqual([]);}
 expect(http.some(r=>r.status>=400)).toBe(false);
 expect(requests.filter(path=>path.endsWith('/perfil/'))).toHaveLength(1);
 expect(requests.filter(path=>path.endsWith('/contexto/'))).toHaveLength(1);
 expect(requests.some(path=>path.includes('/onboarding/'))).toBe(false);
});
test('a real incomplete registration reports its failure and retry recovers it',async({page})=>{
 test.skip(Boolean(process.env.BENEFY_TEST_AUTH_REVISION),'Historical probe only exercises the existing-business race');
 await observe(page);
 let complete=false;let attempts=0;
 await fixture(page,async(route:any,url:URL)=>{
  if(url.pathname.endsWith('/perfil/')&&!complete){await route.fulfill({status:404,json:{detail:'Profile missing'}});return true;}
  if(url.pathname.endsWith('/onboarding/comercial/')){
   attempts++;
   if(attempts===1){await route.fulfill({status:500,json:{detail:'Controlled registration failure'}});}
   else {complete=true;await route.fulfill({json:{contexto:context,completado:true}});}
   return true;
  }
  return false;
 });
 await submit(page);
 await expect(page.getByRole('heading',{name:'No pudimos terminar de crear tu negocio'})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('Controlled registration failure');
 await page.getByRole('button',{name:'Reintentar',exact:true}).click();
 await expect(page.locator('.portal-kpi strong').first()).toHaveText('100');
 expect(attempts).toBe(2);
});

test('missing registration data requests profile completion without a commercial failure',async({page})=>{
 test.skip(Boolean(process.env.BENEFY_TEST_AUTH_REVISION),'Historical probe only exercises the existing-business race');
 await observe(page);
 await fixture(page,async(route:any,url:URL)=>{
  if(url.pathname.endsWith('/perfil/')){await route.fulfill({status:404,json:{detail:'Profile missing'}});return true;}
  if(url.pathname.endsWith('/onboarding/comercial/')){await route.fulfill({status:409,json:{codigo:'sin_registro_comercial',detalle:'Complete your profile'}});return true;}
  return false;
 });
 await submit(page);
 await expect(page.getByRole('heading',{name:'Completa tu perfil'})).toBeVisible();
 expect((await page.evaluate(()=>(window as any).__loginTrace)).errors).toEqual([]);
});
