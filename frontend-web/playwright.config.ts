import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',use:{baseURL:'http://127.0.0.1:5174',channel:'msedge',headless:true},webServer:process.env.BENEFY_TEST_SERVER_EXTERNAL ? undefined : {command:'node tests/server.mjs',url:'http://127.0.0.1:5174',reuseExistingServer:false},workers:1});
