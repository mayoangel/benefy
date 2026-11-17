import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['tests/server.mjs'],{stdio:'inherit'});
let result=1;
try {
 let ready=false;
 for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:5174');if(r.ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('Test server did not start');
 result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test'],{stdio:'inherit',env:{...process.env,BENEFY_TEST_SERVER_EXTERNAL:'1'}});child.on('error',reject);child.on('exit',code=>resolve(code??1));});
} finally {server.kill();process.exitCode=result;}
