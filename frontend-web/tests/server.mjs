import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
const auth=fs.readFileSync(new URL('./auth-fixture.js',import.meta.url),'utf8');
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.vite-portal-test',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api/v1')},plugins:[{name:'test-identity',enforce:'pre',load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return auth;}},react()],server:{host:'127.0.0.1',port:5174,strictPort:true}});
await server.listen();
