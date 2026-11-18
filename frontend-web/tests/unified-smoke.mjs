// Comprueba el servidor real sin credenciales de usuario ni capturas de pantalla.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let releaseUpdate;
const update = new Promise(resolve => { releaseUpdate = resolve; });
page.on('websocket', socket => socket.on('framereceived', frame => {
  try {
    const data = JSON.parse(String(frame.payload));
    if (data.type === 'update' && data.updates.some(item => item.path.includes('/src/styles/portal.css'))) releaseUpdate();
  } catch { /* Ping o frame no JSON. */ }
}));
const path = fileURLToPath(new URL('../src/styles/portal.css', import.meta.url));
let original;
try {
  for (const url of ['/health/db/', '/api/v1/mi/contexto/']) {
    const response = await page.request.get(base + url);
    const expected = url.startsWith('/health') ? 200 : 401;
    if (response.status() !== expected) throw Error(`Estado inesperado en ${url}: ${response.status()}`);
  }
  const rejected = await page.request.get(base + '/api/v1/mi/contexto/', { headers: { Authorization: 'Bearer invalid-test-token' } });
  if (rejected.status() !== 401) throw Error('El backend no rechazó el token inválido contra Supabase Auth.');
  await page.goto(base + '/login');
  await page.locator('h1').waitFor();
  await page.locator('#btn-primary-login').waitFor();
  original = await readFile(path);
  await writeFile(path, Buffer.concat([original, Buffer.from('\n/* Probe temporal de HMR; se restaura al terminar. */\n')]));
  let deadline;
  try {
    await Promise.race([update, new Promise((_, reject) => { deadline = setTimeout(() => reject(Error('No llegó la actualización HMR')), 15000); })]);
  } finally { clearTimeout(deadline); }
  if (errors.length) throw Error('Errores de JavaScript al cargar el servidor real.');
  console.log(JSON.stringify({ frontend: 'ok', proxy_database_health: 'ok', unauthenticated_api: 401, invalid_token_api: 401, vite_websocket_hmr: 'ok', screenshots: false }));
} finally {
  if (original) await writeFile(path, original);
  await browser.close();
}
