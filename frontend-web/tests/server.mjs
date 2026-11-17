import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const auth=fs.readFileSync(new URL('./auth-fixture.js',import.meta.url),'utf8');
// Optional historical probe: install react-router-dom-legacy@npm:react-router-dom@6.30.4
// with --no-save --package-lock=false, then set BENEFY_TEST_AUTH_REVISION=3ce07a3.
// Historical sources are read into memory; the checkout and production build stay unchanged.
const revision=process.env.BENEFY_TEST_AUTH_REVISION;
if(revision && !/^[a-f0-9]{7,40}$/.test(revision))throw Error('Invalid test revision');
const historicModules=new Map();
if(revision)for(const file of ['src/App.tsx','src/auth/AuthProvider.tsx','src/pages/LoginPage.tsx','src/pages/FinishRegistrationPage.tsx','src/auth/guards.tsx']){
 historicModules.set('/'+file,execFileSync('git',['show',revision+':frontend-web/'+file],{encoding:'utf8'}));
}
const server=await createServer({resolve:revision?{alias:{'react-router-dom':createRequire(import.meta.url).resolve('react-router-dom-legacy')}}:undefined,configFile:false,root:process.cwd(),cacheDir:'node_modules/.vite-portal-test',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api/v1')},plugins:[{name:'test-identity',enforce:'pre',load(id){for(const [file,source] of historicModules)if(id.replaceAll('\\','/').endsWith(file))return source;if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return auth;}},react()],server:{host:'127.0.0.1',port:5174,strictPort:true}});
await server.listen();
