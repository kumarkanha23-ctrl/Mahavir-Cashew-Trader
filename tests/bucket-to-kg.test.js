const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dealsPath = path.join(__dirname, '..', 'deals.js');
const source = fs.readFileSync(dealsPath, 'utf8');

function expectContains(text, needle) {
  assert.ok(text.includes(needle), `Expected to find: ${needle}`);
}

function expectNotContains(text, needle) {
  assert.ok(!text.includes(needle), `Did not expect to find: ${needle}`);
}

function test() {
  expectContains(source, 'nextBucket = round');
  expectContains(source, 'nextKg = round');
  expectNotContains(source, 'kgInput.readOnly = true');
}

test();
console.log('Bucket → KG synchronization regression checks passed.');
