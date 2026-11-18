// Comprobaciones de lógica con Node y TypeScript ya instalados; no requiere un entorno de pruebas nuevo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filename);
};

try {
  const { validatePeriod, periodDays, periodScale } = require('../data/period.ts');
  const { validateDynamic } = require('../data/dynamicValidation.ts');
  const { validateAlliance } = require('../data/allianceValidation.ts');
  const { initialBranches, initialEmployees, nextId, ownMerchantId } = require('../data/demoData.ts');

  assert.equal(validatePeriod('2026-11-14', '2026-11-14'), '');
  assert.notEqual(validatePeriod('2026-11-15', '2026-11-14'), '');
  assert.notEqual(validatePeriod('', '2026-11-14'), '');
  assert.notEqual(validatePeriod('2026-02-30', '2026-03-02'), '');
  assert.equal(periodDays({ kind: 'custom', start: '2026-11-01', end: '2026-11-14' }), 14);
  assert.equal(periodScale({ kind: '7', start: '', end: '' }), 1);

  const draft = { name: 'Café de regalo', type: 'sellos', goal: '8', conversion: '10', reward: 'Un café', start: '2026-11-14', end: '2026-12-14' };
  assert.deepEqual(validateDynamic(draft, 1), {});
  assert.ok(validateDynamic({ ...draft, name: '   ' }, 1).name);
  assert.ok(validateDynamic({ ...draft, goal: '1.5' }, 1).goal);
  assert.ok(validateDynamic({ ...draft, goal: '0' }, 1).goal);
  assert.ok(validateDynamic({ ...draft, goal: 'Infinity' }, 1).goal);
  assert.ok(validateDynamic({ ...draft, type: 'cupones', goal: '101' }, 1).goal);
  assert.deepEqual(validateDynamic({ ...draft, type: 'cupones', goal: '100' }, 1), {});
  assert.ok(validateDynamic({ ...draft, type: 'puntos', conversion: '-1' }, 1).conversion);
  assert.ok(validateDynamic({ ...draft, end: draft.start }, 2).end);
  assert.ok(validateDynamic({ ...draft, end: '2026-02-30' }, 2).end);

  const alliance = { merchantId: '2', condition: 'Cinco visitas', benefit: 'Diez por ciento', start: draft.start, end: draft.end };
  assert.deepEqual(validateAlliance(alliance, 0), {});
  assert.deepEqual(validateAlliance(alliance, 1), {});
  assert.ok(validateAlliance({ ...alliance, merchantId: String(ownMerchantId) }, 0).merchantId);
  assert.ok(validateAlliance({ ...alliance, merchantId: '999' }, 0).merchantId);
  assert.ok(validateAlliance({ ...alliance, condition: ' ' }, 1).condition);
  assert.ok(validateAlliance({ ...alliance, end: alliance.start }, 1).end);

  assert.equal(new Set(initialBranches.map(b => b.id)).size, initialBranches.length);
  assert.ok(initialEmployees.every(e => initialBranches.some(b => b.id === e.branch)));
  assert.ok(nextId() < nextId());

  for (const name of ['base', 'layout', 'components', 'pages']) {
    const css = fs.readFileSync(path.resolve(__dirname, `../dashboard-${name}.css`), 'utf8');
    for (const match of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(match[1]) >= 12, `Texto menor de 12 px en ${name}`);
    for (const match of css.matchAll(/--(?:text|title)-[a-z]+:\s*(\d+)px/g)) assert.ok(Number(match[1]) >= 12, `Escala menor de 12 px en ${name}`);
  }
  console.log('OK: periodos, dinámicas, alianzas, IDs y tamaño mínimo de texto.');
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}
