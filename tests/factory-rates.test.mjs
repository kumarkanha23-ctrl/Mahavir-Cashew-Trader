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
let liveFirestoreRates = [];
const context = vm.createContext({
  console, Date, Math, Intl, URLSearchParams,
  readRatesDocumentFromFirestore: async () => ({
    documentId: 'rates',
    exists: true,
    rates: liveFirestoreRates
  }),
  updateRatesDocumentInFirestore: async (updateRates) => {
    const updatedRates = updateRates(liveFirestoreRates);
    if (updatedRates !== liveFirestoreRates) {
      liveFirestoreRates = updatedRates;
      firestoreRateWrites.push(JSON.parse(JSON.stringify(updatedRates)));
    }
    return updatedRates;
  },
  localStorage: { setItem: (key, value) => localStorageWrites.push([key, value]) }
});
vm.runInContext(`${appSource}
persist = () => {};
globalThis.testApp = {
  state, calcDeal, saveDeal, saveRate, saveFactory, findOrCreateFactory,
  getRateForFactory, copyRatesBetweenFactories, assignExistingRatesToSiba,
  getSibaRateAssignmentPreflight, normalizeDeal
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
const firebaseSource = await readFile(new URL('../firebase.js', import.meta.url), 'utf8');
assert.ok(dealsSource.includes("container.querySelector('[name=factoryName]').addEventListener('change'"));
assert.ok(dealsSource.includes('getRateForFactory(grade, factory?.id)'));
assert.ok(dealsSource.includes('copyRatesBetweenFactories(sourceSelect.value, targetSelect.value'));
assert.ok(dealsSource.includes('Assign Existing Rates to SIBA'));
assert.ok(dealsSource.includes('getSibaRateAssignmentPreflight()'));
assert.ok(dealsSource.includes('Firestore Doc ID'));
assert.ok(!dealsSource.includes('diagnoseSibaMapping'));
assert.ok(!dealsSource.includes('READ ONLY — NO DATA WILL BE CHANGED'));
assert.ok(!appSource.includes('assignLegacyRatesToSiba'));
assert.ok(!appSource.includes('SIBA_RATE_ASSIGNMENT_EXPECTED'));
assert.ok(firebaseSource.includes("erpRef('rates').get({ source: 'server' })"));
assert.ok(firebaseSource.includes('firestore.runTransaction'));

app.state.factories = [{ id: 'siba-id', name: ' Siba ' }];
liveFirestoreRates = sibaMappingValues.map(([grade, factoryRate, partyRate], index) => ({
  id: `legacy-${index}`,
  grade: grade === 'Special JH' ? ' Special jh ' : grade === 'W160' ? ' W-160 ' : grade,
  factoryRate,
  commissionPerKg: 5,
  partyRate,
  updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
}));
app.state.rates = JSON.parse(JSON.stringify(liveFirestoreRates));
app.state.rates.find((rate) => rate.grade.includes('W-160')).factoryRate = 1;
const ratesBeforeAssignment = JSON.parse(JSON.stringify(liveFirestoreRates));
const dealsBeforeAssignment = JSON.stringify(app.state.deals);
const sibaPreflight = await app.getSibaRateAssignmentPreflight();
assert.equal(sibaPreflight.documentId, 'rates');
assert.equal(sibaPreflight.totalRecords, 10);
assert.equal(sibaPreflight.canAssign, true);
assert.equal(sibaPreflight.rows.find((rate) => rate.rawGrade === ' W-160 ').normalizedGrade, 'w160');
assert.equal(sibaPreflight.gradeResults.find((result) => result.grade === 'W160').matches[0].recordId, 'legacy-5');
assert.equal(await app.assignExistingRatesToSiba(sibaPreflight.selectedRecordIds), 10);
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
const alreadyAssignedPreflight = await app.getSibaRateAssignmentPreflight();
assert.equal(alreadyAssignedPreflight.canAssign, true);
assert.equal(await app.assignExistingRatesToSiba(alreadyAssignedPreflight.selectedRecordIds), 0);
assert.equal(firestoreRateWrites.length, 1);

liveFirestoreRates = JSON.parse(JSON.stringify(ratesBeforeAssignment));
const stalePreflight = await app.getSibaRateAssignmentPreflight();
liveFirestoreRates.find((rate) => rate.grade.includes('W-160')).id = 'changed-w160-id';
const beforeStaleAttempt = JSON.stringify(liveFirestoreRates);
await assert.rejects(app.assignExistingRatesToSiba(stalePreflight.selectedRecordIds), /Live rate records changed since preflight.*No rates were changed/);
assert.equal(JSON.stringify(liveFirestoreRates), beforeStaleAttempt);
assert.equal(firestoreRateWrites.length, 1);

liveFirestoreRates = JSON.parse(JSON.stringify(ratesBeforeAssignment));
liveFirestoreRates.find((rate) => rate.grade.includes('W-160')).factoryRate = 1;
const mismatchPreflight = await app.getSibaRateAssignmentPreflight();
assert.equal(mismatchPreflight.canAssign, false);
assert.match(mismatchPreflight.gradeResults.find((result) => result.grade === 'W160').issue, /no record matches/);
await assert.rejects(app.assignExistingRatesToSiba(mismatchPreflight.selectedRecordIds), /No rates were changed/);
assert.equal(firestoreRateWrites.length, 1);

liveFirestoreRates = sibaMappingValues.map(([grade, factoryRate, partyRate], index) => ({
  id: `legacy-${index}`, grade, factoryRate, commissionPerKg: 5, partyRate
}));
app.state.rates = JSON.parse(JSON.stringify(liveFirestoreRates));
app.state.factories.push({ id: 'siba-duplicate', name: 'siba' });
const stateBeforeDuplicateFactory = JSON.stringify(liveFirestoreRates);
const duplicateFactoryPreflight = await app.getSibaRateAssignmentPreflight();
assert.equal(duplicateFactoryPreflight.canAssign, false);
await assert.rejects(app.assignExistingRatesToSiba(duplicateFactoryPreflight.selectedRecordIds), /exactly one factory named SIBA/);
assert.equal(JSON.stringify(liveFirestoreRates), stateBeforeDuplicateFactory);
assert.equal(firestoreRateWrites.length, 1);

app.state.factories = [{ id: 'siba-id', name: 'SIBA' }];
liveFirestoreRates = sibaMappingValues.slice(1).map(([grade, factoryRate, partyRate], index) => ({
  id: `legacy-${index}`, grade, factoryRate, commissionPerKg: 5, partyRate
}));
app.state.rates = JSON.parse(JSON.stringify(liveFirestoreRates));
const stateBeforeMissingGrade = JSON.stringify(liveFirestoreRates);
const missingGradePreflight = await app.getSibaRateAssignmentPreflight();
assert.equal(missingGradePreflight.canAssign, false);
await assert.rejects(app.assignExistingRatesToSiba(missingGradePreflight.selectedRecordIds), /1st SW: no live Firestore rate record/);
assert.equal(JSON.stringify(liveFirestoreRates), stateBeforeMissingGrade);
assert.equal(firestoreRateWrites.length, 1);

liveFirestoreRates = sibaMappingValues.map(([grade, factoryRate, partyRate], index) => ({
  id: `legacy-${index}`, grade, factoryRate, commissionPerKg: 5, partyRate
}));
const w160Rate = liveFirestoreRates.find((rate) => rate.grade === 'W160');
liveFirestoreRates.push({ ...w160Rate, id: 'duplicate-w160', grade: 'W-160' });
app.state.rates = JSON.parse(JSON.stringify(liveFirestoreRates));
const stateBeforeDuplicateGrade = JSON.stringify(liveFirestoreRates);
const duplicateGradePreflight = await app.getSibaRateAssignmentPreflight();
assert.equal(duplicateGradePreflight.canAssign, false);
assert.match(duplicateGradePreflight.gradeResults.find((result) => result.grade === 'W160').issue, /2 live Firestore records/);
await assert.rejects(app.assignExistingRatesToSiba(duplicateGradePreflight.selectedRecordIds), /W160: 2 live Firestore records/);
assert.equal(JSON.stringify(liveFirestoreRates), stateBeforeDuplicateGrade);
assert.equal(firestoreRateWrites.length, 1);

console.log('Factory-wise rate, explicit SIBA assignment, deal snapshot, and bucket/KG regression checks passed.');
