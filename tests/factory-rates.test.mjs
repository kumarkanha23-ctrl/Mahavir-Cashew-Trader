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
  getRateForFactory, copyRatesBetweenFactories, normalizeDeal
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
assert.ok(dealsSource.includes('READ ONLY — NO DATA WILL BE CHANGED'));
assert.ok(dealsSource.includes('container.querySelector(\'#diagnoseSibaBtn\').addEventListener'));
assert.ok(dealsSource.includes('JSON.stringify(rate, null, 2)'));
assert.ok(dealsSource.includes(".get({ source: 'server' })"));
assert.ok(!appSource.includes('assignLegacyRatesToSiba'));
assert.ok(!appSource.includes('SIBA_RATE_ASSIGNMENT_EXPECTED'));

const serverSnapshot = (id, payload) => ({
  exists: true,
  ref: { id },
  data: () => ({ payload })
});
let serverReadCalls = 0;
const serverDocuments = {
  rates: sibaMappingValues.map(([grade, factoryRate, partyRate]) => ({
    id: `legacy-${grade}`, grade, factoryRate, commissionPerKg: 5, partyRate
  })),
  factories: [{ id: 'siba-id', name: ' Siba ', active: true }]
};
const fakeFirestore = {
  collection: (collectionName) => {
    assert.equal(collectionName, 'users');
    return { doc: (userId) => {
      assert.equal(userId, 'live-user');
      return { collection: (subcollection) => {
        assert.equal(subcollection, 'erp');
        return { doc: (docId) => ({
          get: async (options) => {
            assert.deepEqual(JSON.parse(JSON.stringify(options)), { source: 'server' });
            serverReadCalls++;
            return serverSnapshot(docId, serverDocuments[docId]);
          }
        }) };
      } };
    } };
  }
};
const dealsContext = vm.createContext({
  console,
  JSON,
  Set,
  Number,
  Promise,
  isFirestoreReady: () => true,
  isUserSignedIn: () => true,
  getAuth: () => ({ currentUser: { uid: 'live-user' } }),
  getFirestore: () => fakeFirestore
});
vm.runInContext(`${dealsSource
  .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/^export\s+/gm, '')}
globalThis.testDiagnosis = diagnoseSibaMapping;
globalThis.testReadSibaMapping = readSibaMappingFromFirestore;`, dealsContext);
const diagnose = dealsContext.testDiagnosis;
const exactRecords = sibaMappingValues.map(([grade, factoryRate, partyRate]) => ({
  id: `legacy-${grade}`, grade, factoryRate, commissionPerKg: 5, partyRate
}));
const sibaFactory = [{ id: 'siba-id', name: ' Siba ', active: true }];
assert.equal(diagnose(exactRecords, sibaFactory).finalResult, 'All conditions pass');
assert.equal(diagnose(exactRecords, []).finalResult, 'SIBA factory not found');
assert.equal(diagnose(exactRecords, [...sibaFactory, { id: 'siba-2', name: 'SIBA' }]).finalResult, 'Multiple SIBA factories found');
assert.equal(diagnose([...exactRecords, { ...exactRecords[0], id: 'duplicate' }], sibaFactory).finalResult, 'Legacy grade mismatch');
assert.equal(diagnose([...exactRecords, { ...exactRecords[0], id: 'siba-copy', factoryId: 'siba-id' }], sibaFactory).finalResult, 'Existing SIBA rate conflict');
assert.equal(diagnose(exactRecords.map((rate) => rate.grade === 'W160' ? { ...rate, grade: ' w160 ' } : rate), sibaFactory).finalResult, 'Grade normalization problem');
assert.equal(diagnose(exactRecords.map((rate) => rate.grade === 'W160' ? { ...rate, partyRate: 856 } : rate), sibaFactory).finalResult, 'Rate value mismatch');
assert.equal(diagnose(exactRecords.map((rate) => rate.grade === 'W160' ? { ...rate, factoryId: 'missing-factory' } : rate), sibaFactory).finalResult, 'Factory ID resolution problem');
const diagnosticInputSnapshot = JSON.stringify(exactRecords);
diagnose(exactRecords, sibaFactory);
assert.equal(JSON.stringify(exactRecords), diagnosticInputSnapshot);
assert.equal(serverReadCalls, 0);
const readLiveData = await dealsContext.testReadSibaMapping();
assert.equal(serverReadCalls, 2);
assert.deepEqual(JSON.parse(JSON.stringify(readLiveData.factories)), serverDocuments.factories);
assert.deepEqual(JSON.parse(JSON.stringify(readLiveData.rates)), serverDocuments.rates);
assert.equal(diagnose(readLiveData.rates, readLiveData.factories).finalResult, 'All conditions pass');

console.log('Factory-wise rate, read-only SIBA diagnostics, deal snapshot, and bucket/KG regression checks passed.');
