import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const auth = "let session={access_token:'fixture',user:{id:'owner'}};let cb;export const supabase={auth:{getSession:async()=>({data:{session}}),onAuthStateChange:f=>{cb=f;return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{session=null;cb?.('SIGNED_OUT',null)}}};";
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.vite-portal-test',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api/v1')},plugins:[{name:'test-identity',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return auth;}},react()],server:{host:'127.0.0.1',port:5174,strictPort:true}});
await server.listen();
