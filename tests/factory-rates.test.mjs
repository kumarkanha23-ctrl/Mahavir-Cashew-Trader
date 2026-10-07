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
persist = () => {};
globalThis.testApp = {
  state, calcDeal, saveDeal, saveRate, saveFactory, findOrCreateFactory,
  getRateForFactory, copyRatesBetweenFactories, assignLegacyRatesToSiba, normalizeDeal
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

const sibaValues = [
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
app.state.rates = sibaValues.map(([grade, factoryRate, partyRate]) => ({
  id: `legacy-${grade}`,
  grade,
  factoryRate,
  commissionPerKg: 5,
  partyRate,
  updatedAt: '2026-08-10T00:00:00.000Z'
}));
const sibaRatesBefore = JSON.parse(JSON.stringify(app.state.rates));
app.state.rates[9].partyRate++;
const invalidSibaRates = JSON.stringify(app.state.rates);
assert.throws(() => app.assignLegacyRatesToSiba(), /Cannot safely assign W320/);
assert.equal(JSON.stringify(app.state.rates), invalidSibaRates);
app.state.rates[9].partyRate = 790;
assert.equal(app.assignLegacyRatesToSiba(), 10);
app.state.rates.forEach((rate, index) => {
  const { factoryId: _factoryId, ...beforeAssignment } = sibaRatesBefore[index];
  const { factoryId, ...afterAssignment } = rate;
  assert.equal(factoryId, 'siba-id');
  assert.equal(JSON.stringify(afterAssignment), JSON.stringify(beforeAssignment));
});
assert.equal(app.assignLegacyRatesToSiba(), 0);

const dealsSource = await readFile(new URL('../deals.js', import.meta.url), 'utf8');
assert.ok(dealsSource.includes("container.querySelector('[name=factoryName]').addEventListener('change'"));
assert.ok(dealsSource.includes('getRateForFactory(grade, factory?.id)'));
assert.ok(dealsSource.includes('copyRatesBetweenFactories(sourceSelect.value, targetSelect.value'));

console.log('Factory-wise rate, safe copy, deal snapshot, and bucket/KG regression checks passed.');
