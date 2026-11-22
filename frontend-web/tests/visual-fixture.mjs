export const routes = ['','clientes','visitas','canjes','cupones','puntos','tarjetas','recompensas','equipo','sucursales','configuracion'];
export async function installVisualFixture(page, options={}) {
 const profile={id:1,nombre:'Ana',apellido:'Mart\u00ednez',correo:'ana@nomada.example.invalid',rol:options.role==='admin'?'admin_sistema':'consumidor',is_active:true};
 const business={id:1,nombre:'Caf\u00e9 N\u00f3mada',slug:'cafe-nomada',status:true,categoria:1,zona_horaria:'America/Tijuana',logo_url:null,plan:{id:1,codigo:'free',nombre:'Free',descripcion:'Todo lo necesario para empezar.',orden:1,status:true}};
 const branches=[{id:11,nombre:'Centro',negocio:1,status:true,ciudad:'Tijuana',direccion:'Av. Revoluci\u00f3n 1200',telefono:'6641234567',codigo_postal:'22000',qr_uuid:'fixture-qr',nfc_uid:null},{id:12,nombre:'Cacho',negocio:1,status:true,ciudad:'Tijuana',direccion:'Av. Brasil 48'}];
 const membership={id:1,negocio:business,rol_comercio:options.role||'dueno',status:true,sucursal:options.role==='empleado'||options.role==='supervisor'?branches[0]:null};
 const context={usuario:profile,es_admin_sistema:options.role==='admin',puede_portal:true,negocios:[business],sucursales:branches,membresias:options.role==='admin'?[]:[membership]};
 const detail={...business,descripcion:'Caf\u00e9 de especialidad y pan reci\u00e9n hecho en el coraz\u00f3n de Tijuana.',direccion:'Av. Revoluci\u00f3n 1200, Zona Centro',telefono:'6641234567',correo:'hola@nomada.example.invalid',banner_url:null};
 const plan={negocio:1,plan:business.plan,suscripcion:null,limites:Object.fromEntries(['sucursales','tarjetas_sellos','recompensas','supervisores','empleados','programas_puntos'].map((k,i)=>[k,{limite:[3,3,5,2,5,1][i],uso:[2,1,3,1,2,1][i],disponible:[1,2,2,1,3,0][i],excedido:false}])),caracteristicas:{metricas_avanzadas:false,exportacion_reportes:false,personalizacion_avanzada:false,alianzas:false},caracteristicas_implementadas:[],excedentes:[]};
 const dynamics=[{id:101,nombre:'Puntos N\u00f3mada',descripcion:'Premiamos cada visita.',tipo:'puntos',negocio:1,regla_conversion:'10',dias_expiracion_puntos:180,fecha_inicio:'2026-10-01T00:00:00Z',fecha_fin:null,status:true,meta:null,es_repetible:true},{id:102,nombre:'Tu caf\u00e9 de siempre',descripcion:'El s\u00e9ptimo va por nosotros.',tipo:'sellos',negocio:1,meta:6,es_repetible:true,fecha_inicio:'2026-10-01T00:00:00Z',fecha_fin:null,status:true}];
 const rewards=[{id:201,titulo:'Caf\u00e9 de la casa',descripcion:'Un americano preparado al momento.',tipo:'gratis',descuento:null,costo_desbloqueo:120,terminos_condiciones:'Una recompensa por visita.',status:true,negocio:1,es_meta:false,dinamica:null,fecha_expiracion:null,vigencia_dias:30,cantidad_disponible:50},{id:202,titulo:'Pan dulce a elegir',descripcion:'Un acompa\u00f1ante para tu caf\u00e9.',tipo:'gratis',descuento:null,costo_desbloqueo:0,terminos_condiciones:'Sujeto a disponibilidad.',status:true,negocio:1,es_meta:true,dinamica:102,fecha_expiracion:null,vigencia_dias:30,cantidad_disponible:null},{id:203,titulo:'20% en tu siguiente visita',descripcion:'Un detalle para que vuelvas.',tipo:'descuento',descuento:'20',costo_desbloqueo:80,terminos_condiciones:'No acumulable.',status:false,negocio:1,es_meta:false,dinamica:null,fecha_expiracion:null,vigencia_dias:15,cantidad_disponible:null}];
 const members=[{id:1,usuario:1,usuario_nombre:'Ana Mart\u00ednez',usuario_correo:profile.correo,negocio:1,sucursal:null,sucursal_nombre:null,rol_comercio:'dueno',status:true},{id:2,usuario:2,usuario_nombre:'Daniel L\u00f3pez',usuario_correo:'daniel@example.invalid',negocio:1,sucursal:11,sucursal_nombre:'Centro',rol_comercio:'supervisor',status:true},{id:3,usuario:3,usuario_nombre:'Sof\u00eda Torres',usuario_correo:'sofia@example.invalid',negocio:1,sucursal:12,sucursal_nombre:'Cacho',rol_comercio:'empleado',status:true}];
 const people=[{id:5,nombre:'Mariana',apellido:'Garc\u00eda',correo:'mariana@example.invalid',visitas:18,puntos:240,cupones:3,ultima_visita:'2026-11-17T16:00:00Z'},{id:6,nombre:'Roberto',apellido:'Navarro',correo:'roberto@example.invalid',visitas:12,puntos:160,cupones:1,ultima_visita:'2026-11-16T15:00:00Z'},{id:7,nombre:'Valeria',apellido:'Cruz',correo:'valeria@example.invalid',visitas:7,puntos:90,cupones:0,ultima_visita:'2026-11-15T16:00:00Z'}];
 const visits=people.map((p,i)=>({id:i+1,usuario:p.id,usuario_correo:p.correo,negocio:1,sucursal:11,sucursal_nombre:'Centro',metodo_validacion:'qr',tipo:'visita',fecha:'2026-11-17T16:00:00Z',fecha_negocio:'2026-11-17',es_valida:i!==2}));
 const coupons=people.map((p,i)=>({id:i+1,uuid:'fixture-'+i,usuario:p.id,usuario_correo:p.correo,negocio:1,recompensa:201,origen:'puntos',status:i===1?'canjeado':'disponible',titulo_beneficio:rewards[i%2].titulo,costo_pagado:120,fecha_emision:'2026-11-10T12:00:00Z',fecha_expiracion:'2026-12-10T12:00:00Z'}));
 const redemptions=people.map((p,i)=>({id:i+1,cupon:i+1,usuario_correo:p.correo,titulo_beneficio:rewards[i%2].titulo,sucursal:11,sucursal_nombre:'Centro',negocio:1,origen:'puntos',metodo:'qr',fecha:'2026-11-17T16:00:00Z',anulado:i===2}));
 const invitations=[{token:'fixture-invite',correo:'lucia@example.invalid',rol_comercio:'empleado',sucursal:{id:11,nombre:'Centro'},negocio:{id:1,nombre:business.nombre},estado:'pendiente',creada_por_correo:profile.correo,motivo:'Turno de tarde',fecha_creacion:'2026-11-15T12:00:00Z',fecha_expiracion:'2026-11-22T12:00:00Z',fecha_respuesta:null}];
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());const path=url.pathname;
  if(url.hostname!=='127.0.0.1'){await route.abort();return;}
  if(!path.startsWith('/api/')){await route.continue();return;}
  const payload=route.request().postDataJSON();const method=route.request().method();
  options.onRequest?.({path,method,payload});
  let data;
  if(path.endsWith('/perfil/'))data=profile;
  else if(path.endsWith('/contexto/'))data=context;
  else if(path.endsWith('/plan/'))data=plan;
  else if(path.endsWith('/metricas/'))data={desde:'2026-10-18',hasta:'2026-11-17',alcance:url.searchParams.has('sucursal')?'sucursal':'negocio',sucursales:[11,12],visitas_validas:1248,clientes_unicos:386,puntos_otorgados:12480,puntos_consumidos:8320,cupones_emitidos:74,cupones_canjeados:58,tarjetas_completadas:32,top_recompensas:[{titulo:'Caf\u00e9 de la casa',total:42},{titulo:'Pan dulce a elegir',total:23},{titulo:'20% en tu siguiente visita',total:9}]};
  else if(path.endsWith('/clientes/'))data={count:45,page:Number(url.searchParams.get('page')||1),page_size:20,results:options.empty?[]:people.filter(p=>(p.nombre+' '+p.correo).toLowerCase().includes((url.searchParams.get('buscar')||'').toLowerCase()))};
  else if(path.endsWith('/visitas/'))data={count:45,next:null,previous:null,results:options.empty?[]:visits};
  else if(path.endsWith('/canjes/'))data={count:45,next:null,previous:null,results:options.empty?[]:redemptions};
  else if(path.endsWith('/cupones/'))data={count:45,next:null,previous:null,results:options.empty?[]:coupons};
  else if(path.includes('/negocio/detalle/'))data=detail;
  else if(path.includes('/negocio/actualizar/'))data={...detail,...payload};
  else if(path.endsWith('/sucursales/listar/'))data=options.empty?[]:branches;
  else if(path.includes('/sucursal/detalle/'))data=branches.find(b=>path.includes('/'+b.id+'/'));
  else if(path.endsWith('/dinamicas/listar/'))data=options.empty?[]:dynamics;
  else if(path.includes('/dinamica/actualizar/')){data=dynamics.find(d=>path.includes('/'+d.id+'/'));Object.assign(data,payload);}
  else if(path.endsWith('/recompensas/listar/'))data=options.empty?[]:rewards;
  else if(path.includes('/recompensa/actualizar/')){const reward=rewards.find(r=>path.includes('/'+r.id+'/'));Object.assign(reward,payload);data=reward;}
  else if(path.endsWith('/usuarios-negocio/listar/'))data=members;
  else if(path.endsWith('/invitaciones/'))data=method==='POST'?{...invitations[0],...payload,token:'fixture-created',sucursal:branches.find(b=>b.id===payload.sucursal)}:invitations;
  else if(path.includes('/invitaciones/')&&path.endsWith('/revocar/')){data=invitations.find(i=>path.includes('/'+i.token+'/'));data.estado='revocada';}
  else if(path.endsWith('/negocios/listar/'))data=[business];
  else if(path.endsWith('/usuarios/listar/'))data=[profile];
  else if(path.endsWith('/categorias-negocio/listar/'))data=[{id:1,nombre:'Cafeter\u00eda'}];
  else if(method!=='GET')data={id:900,...payload};
  else throw Error('Unmapped fixture: '+path);
  await route.fulfill({json:data});
 });
}
