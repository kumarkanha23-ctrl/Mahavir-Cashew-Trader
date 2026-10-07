import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

let appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
appSource = appSource
  .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/\nbootstrap\(\);\s*$/, '');
const context = vm.createContext({ console, Date, Math, Intl, URLSearchParams });
vm.runInContext(`${appSource}
let persistCalls = 0;
persist = () => { persistCalls += 1; };
globalThis.testApp = {
  state, calcDeal, saveDeal, saveRate, saveFactory, findOrCreateFactory,
  getRateForFactory, copyRatesBetweenFactories, assignLegacyRatesToSiba,
  normalizeDeal, getPersistCalls: () => persistCalls
};`, context);
const app = context.testApp;
const factoryA = 'factory-a';
const factoryB = 'factory-b';
app.state.factories = [
  { id: factoryA, name: 'Factory A', active: true },
  { id: factoryB, name: 'Factory B', active: true }
];
app.state.rates = [
  { id: 'legacy-w240', grade: 'W240', factoryRate: 700, commissionPerKg: 5, partyRate: 705 }
];

app.saveRate({ factoryId: factoryA, grade: 'W240', factoryRate: 805, commissionPerKg: 5 });
app.saveRate({ factoryId: factoryB, grade: 'W240', factoryRate: 820, commissionPerKg: 5 });
app.saveRate({ factoryId: factoryA, grade: 'W320', factoryRate: 785, commissionPerKg: 5 });

assert.equal(app.getRateForFactory('W240', factoryA).factoryRate, 805);
assert.equal(app.getRateForFactory('W240', factoryB).factoryRate, 820);
assert.equal(app.getRateForFactory('W240', factoryA).partyRate, 810);
assert.equal(app.getRateForFactory('W240', factoryB).partyRate, 825);
assert.equal(app.getRateForFactory('W180', factoryA), null);
assert.equal(app.getRateForFactory('W240', 'unknown-factory').factoryRate, 700);
assert.equal(app.findOrCreateFactory(' factory a ').id, factoryA);
assert.throws(() => app.saveFactory({ name: 'factory a' }), /already exists/);
assert.equal(app.saveFactory({ name: 'Factory C', active: false }).active, false);

const originalDeal = app.saveDeal({
  date: '2026-08-10',
  partyName: 'Test Party',
  factoryName: 'Factory A',
  grades: ['W240', 'W320'].map((grade) => ({
    grade,
    bucket: 1,
    ...app.getRateForFactory(grade, factoryA)
  }))
});
assert.deepEqual(JSON.parse(JSON.stringify(originalDeal.grades.map((grade) => grade.factoryRate))), [805, 785]);
assert.deepEqual(JSON.parse(JSON.stringify(originalDeal.grades.map((grade) => grade.kg))), [10, 10]);
assert.deepEqual(JSON.parse(JSON.stringify(originalDeal.grades.map((grade) => grade.purchaseAmount))), [8050, 7850]);
assert.deepEqual(JSON.parse(JSON.stringify(originalDeal.grades.map((grade) => grade.saleAmount))), [8100, 7900]);
assert.deepEqual(JSON.parse(JSON.stringify(originalDeal.grades.map((grade) => grade.profit))), [50, 50]);
const savedSnapshot = JSON.stringify(originalDeal.grades);

app.saveRate({ factoryId: factoryA, grade: 'W240', factoryRate: 850, commissionPerKg: 5 });
assert.equal(JSON.stringify(app.state.deals[0].grades), savedSnapshot);
assert.equal(app.normalizeDeal(app.state.deals[0]).grades[0].factoryRate, 805);

const defaultCopy = app.copyRatesBetweenFactories(factoryA, factoryB);
assert.deepEqual(JSON.parse(JSON.stringify(defaultCopy)), { added: 1, skipped: 1, replaced: 0 });
assert.equal(app.getRateForFactory('W240', factoryB).factoryRate, 820);
assert.equal(app.getRateForFactory('W320', factoryB).factoryRate, 785);

const explicitReplace = app.copyRatesBetweenFactories(factoryA, factoryB, ['W240']);
assert.deepEqual(JSON.parse(JSON.stringify(explicitReplace)), { added: 0, skipped: 1, replaced: 1 });
assert.equal(app.getRateForFactory('W240', factoryB).factoryRate, 850);
assert.equal(app.state.rates.find((rate) => rate.id === 'legacy-w240').factoryRate, 700);

for (const [bucket, expectedKg] of [[5, 50], [10, 100], [28, 280], [40, 400]]) {
  assert.equal(context.calcDeal({ bucket, factoryRate: 805, commissionPerKg: 5 }).kg, expectedKg);
}

const sibaMappingValues = [
  ['1st SW', 695, 700],
  ['2nd SW', 630, 635],
  ['JH', 785, 790],
  ['K', 715, 720],
  ['Special JH', 755, 760],
  ['W160', 850, 855],
  ['W180', 855, 860],
  ['W210', 825, 830],
  ['W240', 805, 810],
  ['W320', 785, 790]
];
app.state.factories = [{ id: 'siba-id', name: 'SIBA' }];
app.state.rates = sibaMappingValues.map(([grade, factoryRate, partyRate]) => ({
  id: `legacy-${grade}`,
  grade,
  factoryRate,
  commissionPerKg: 5,
  partyRate,
  updatedAt: '2026-08-10T00:00:00.000Z'
}));
const ratesBeforeSibaAssignment = JSON.parse(JSON.stringify(app.state.rates));
const persistCallsBeforeAssignment = app.getPersistCalls();
const sibaAssignment = app.assignLegacyRatesToSiba();
assert.deepEqual(JSON.parse(JSON.stringify(sibaAssignment)), { assignedCount: 10, reason: null });
assert.equal(app.state.rates.length, 10);
app.state.rates.forEach((rate, index) => {
  const before = ratesBeforeSibaAssignment[index];
  assert.equal(rate.factoryId, 'siba-id');
  assert.deepEqual(
    JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(rate).filter(([key]) => key !== 'factoryId')))),
    before
  );
});
assert.equal(app.getPersistCalls(), persistCallsBeforeAssignment + 1);
const mappedRatesSnapshot = JSON.stringify(app.state.rates);
assert.deepEqual(JSON.parse(JSON.stringify(app.assignLegacyRatesToSiba())), { assignedCount: 0, reason: null });
assert.equal(JSON.stringify(app.state.rates), mappedRatesSnapshot);
assert.equal(app.getPersistCalls(), persistCallsBeforeAssignment + 1);

app.state.rates = sibaMappingValues.map(([grade, factoryRate, partyRate]) => ({
  id: `legacy-${grade}`,
  grade,
  factoryRate,
  commissionPerKg: 5,
  partyRate,
  updatedAt: '2026-08-10T00:00:00.000Z'
}));
app.state.rates.find((rate) => rate.grade === 'W160').partyRate = 856;
const mismatchRatesSnapshot = JSON.stringify(app.state.rates);
const persistCallsBeforeMismatch = app.getPersistCalls();
const mismatchAssignment = app.assignLegacyRatesToSiba();
assert.equal(mismatchAssignment.assignedCount, 0);
assert.match(mismatchAssignment.reason, /W160/);
assert.equal(JSON.stringify(app.state.rates), mismatchRatesSnapshot);
assert.equal(app.getPersistCalls(), persistCallsBeforeMismatch);

app.state.rates = sibaMappingValues.map(([grade, factoryRate, partyRate]) => ({
  id: `legacy-${grade}`,
  grade,
  factoryRate,
  commissionPerKg: 5,
  partyRate,
  updatedAt: '2026-08-10T00:00:00.000Z'
}));
app.state.factories.push({ id: 'siba-duplicate', name: ' Siba ' });
const duplicateFactoryRatesSnapshot = JSON.stringify(app.state.rates);
const duplicateFactoryAssignment = app.assignLegacyRatesToSiba();
assert.equal(duplicateFactoryAssignment.assignedCount, 0);
assert.match(duplicateFactoryAssignment.reason, /exactly one SIBA factory/);
assert.equal(JSON.stringify(app.state.rates), duplicateFactoryRatesSnapshot);

const dealsSource = await readFile(new URL('../deals.js', import.meta.url), 'utf8');
assert.ok(dealsSource.includes("container.querySelector('[name=factoryName]').addEventListener('change'"));
assert.ok(dealsSource.includes('getRateForFactory(grade, factory?.id)'));
assert.ok(dealsSource.includes('copyRatesBetweenFactories(sourceSelect.value, targetSelect.value'));
assert.ok(dealsSource.includes('READ ONLY — NO DATA WILL BE CHANGED'));
assert.ok(dealsSource.includes('container.querySelector(\'#diagnoseW160Btn\').addEventListener'));
assert.ok(dealsSource.includes('JSON.stringify(rate, null, 2)'));
assert.ok(appSource.includes('if (Array.isArray(data?.rates) && Array.isArray(data?.factories))'));
assert.ok(appSource.includes('const assignment = assignLegacyRatesToSiba();'));

const dealsContext = vm.createContext({ console, JSON, Set, esc: (value) => String(value) });
vm.runInContext(`${dealsSource
  .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/^export\s+/gm, '')}
globalThis.testDiagnosis = diagnoseW160Rates;`, dealsContext);
const diagnose = dealsContext.testDiagnosis;
const exactW160 = { id: 'w160-1', grade: 'W160', factoryRate: 850, commissionPerKg: 5, partyRate: 855 };
const factories = [{ id: 'siba-id', name: 'SIBA' }, { id: 'other-id', name: 'Other Factory' }];
assert.equal(diagnose([], factories).primaryCode, 'E');
assert.equal(diagnose([{ ...exactW160 }], factories).primaryCode, 'A');
assert.equal(diagnose([{ ...exactW160, factoryRate: 851 }], factories).primaryCode, 'B');
assert.equal(diagnose([{ ...exactW160 }, { ...exactW160, id: 'w160-2' }], factories).primaryCode, 'C');
assert.equal(diagnose([{ ...exactW160, factoryId: 'siba-id' }], factories).primaryCode, 'D');
assert.equal(diagnose([{ ...exactW160, factoryId: 'other-id' }], factories).primaryCode, 'F');
const rawDiagnosticRecord = { ...exactW160, factoryRate: '850', customField: { untouched: true } };
const rawBeforeDiagnostic = JSON.stringify(rawDiagnosticRecord);
const diagnosticResult = diagnose([rawDiagnosticRecord], factories);
assert.equal(diagnosticResult.primaryCode, 'B');
assert.equal(JSON.stringify(rawDiagnosticRecord), rawBeforeDiagnostic);

console.log('Factory-wise rate, safe copy, deal snapshot, and bucket/KG regression checks passed.');
