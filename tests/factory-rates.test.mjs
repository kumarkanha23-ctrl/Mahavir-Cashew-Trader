import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

let appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
appSource = appSource
  .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/\nbootstrap\(\);\s*$/, '');
const firestoreRateWrites = [];
const localStorageWrites = [];
const context = vm.createContext({
  console, Date, Math, Intl, URLSearchParams,
  saveRatesDocumentToFirestore: async (rates) => firestoreRateWrites.push(JSON.parse(JSON.stringify(rates))),
  localStorage: { setItem: (key, value) => localStorageWrites.push([key, value]) }
});
vm.runInContext(`${appSource}
persist = () => {};
globalThis.testApp = {
  state, calcDeal, saveDeal, saveRate, saveFactory, findOrCreateFactory,
  getRateForFactory, copyRatesBetweenFactories, assignExistingRatesToSiba, normalizeDeal
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
const dealsSource = await readFile(new URL('../deals.js', import.meta.url), 'utf8');
assert.ok(dealsSource.includes("container.querySelector('[name=factoryName]').addEventListener('change'"));
assert.ok(dealsSource.includes('getRateForFactory(grade, factory?.id)'));
assert.ok(dealsSource.includes('copyRatesBetweenFactories(sourceSelect.value, targetSelect.value'));
assert.ok(dealsSource.includes('Assign Existing Rates to SIBA'));
assert.ok(!dealsSource.includes('diagnoseSibaMapping'));
assert.ok(!dealsSource.includes('READ ONLY — NO DATA WILL BE CHANGED'));
assert.ok(!appSource.includes('assignLegacyRatesToSiba'));
assert.ok(!appSource.includes('SIBA_RATE_ASSIGNMENT_EXPECTED'));

app.state.factories = [{ id: 'siba-id', name: ' Siba ' }];
app.state.rates = sibaMappingValues.map(([grade, factoryRate, partyRate], index) => ({
  id: `legacy-${index}`,
  grade,
  factoryRate,
  commissionPerKg: 5,
  partyRate,
  updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
}));
app.state.rates.find((rate) => rate.grade === 'W160').factoryRate = 1234;
const ratesBeforeAssignment = JSON.parse(JSON.stringify(app.state.rates));
const dealsBeforeAssignment = JSON.stringify(app.state.deals);
assert.equal(await app.assignExistingRatesToSiba(), 10);
assert.equal(app.state.rates.length, 10);
assert.equal(firestoreRateWrites.length, 1);
assert.equal(firestoreRateWrites[0].length, 10);
app.state.rates.forEach((rate, index) => {
  const { factoryId: _factoryId, ...actualUnassignedFields } = rate;
  assert.deepEqual(JSON.parse(JSON.stringify(actualUnassignedFields)), ratesBeforeAssignment[index]);
  assert.equal(rate.factoryId, 'siba-id');
  assert.deepEqual(firestoreRateWrites[0][index], JSON.parse(JSON.stringify(rate)));
});
assert.equal(localStorageWrites.length, 1);
assert.equal(localStorageWrites[0][0], 'mct:rates');
assert.ok(!appSource.includes('assignExistingRatesToSiba();'));
assert.equal(JSON.stringify(app.state.deals), dealsBeforeAssignment);
assert.equal(await app.assignExistingRatesToSiba(), 0);
assert.equal(firestoreRateWrites.length, 1);

app.state.rates.find((rate) => rate.grade === 'W160').factoryRate = 1;
assert.equal(await app.assignExistingRatesToSiba(), 0);
assert.equal(firestoreRateWrites.length, 1);

app.state.rates = sibaMappingValues.map(([grade, factoryRate, partyRate], index) => ({
  id: `legacy-${index}`, grade, factoryRate, commissionPerKg: 5, partyRate
}));
app.state.factories.push({ id: 'siba-duplicate', name: 'siba' });
const stateBeforeDuplicateFactory = JSON.stringify(app.state.rates);
await assert.rejects(app.assignExistingRatesToSiba(), /exactly one factory named SIBA/);
assert.equal(JSON.stringify(app.state.rates), stateBeforeDuplicateFactory);
assert.equal(firestoreRateWrites.length, 1);

app.state.factories = [{ id: 'siba-id', name: 'SIBA' }];
app.state.rates = sibaMappingValues.slice(1).map(([grade, factoryRate, partyRate], index) => ({
  id: `legacy-${index}`, grade, factoryRate, commissionPerKg: 5, partyRate
}));
const stateBeforeMissingGrade = JSON.stringify(app.state.rates);
await assert.rejects(app.assignExistingRatesToSiba(), /exactly one existing 1st SW/);
assert.equal(JSON.stringify(app.state.rates), stateBeforeMissingGrade);
assert.equal(firestoreRateWrites.length, 1);

app.state.rates = sibaMappingValues.map(([grade, factoryRate, partyRate], index) => ({
  id: `legacy-${index}`, grade, factoryRate, commissionPerKg: 5, partyRate
}));
app.state.rates.push({ ...app.state.rates[0], id: 'duplicate-grade' });
const stateBeforeDuplicateGrade = JSON.stringify(app.state.rates);
await assert.rejects(app.assignExistingRatesToSiba(), /exactly one existing 1st SW rate record/);
assert.equal(JSON.stringify(app.state.rates), stateBeforeDuplicateGrade);
assert.equal(firestoreRateWrites.length, 1);

console.log('Factory-wise rate, explicit SIBA assignment, deal snapshot, and bucket/KG regression checks passed.');
