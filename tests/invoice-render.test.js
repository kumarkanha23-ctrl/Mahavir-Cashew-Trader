const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, '..', 'pdf.js');
const dealsPath = path.join(__dirname, '..', 'deals.js');
const appPath = path.join(__dirname, '..', 'app.js');
const source = fs.readFileSync(pdfPath, 'utf8');
const dealsSource = fs.readFileSync(dealsPath, 'utf8');
const appSource = fs.readFileSync(appPath, 'utf8');

function expectContains(text, needle) {
  assert.ok(text.includes(needle), `Expected to find: ${needle}`);
}

function expectNotContains(text, needle) {
  assert.ok(!text.includes(needle), `Did not expect to find: ${needle}`);
}

function test() {
  expectContains(source, "export async function renderPdfCenter(container)");
  expectContains(source, 'Party Invoice');
  expectContains(source, 'Factory Purchase Order');
  expectContains(source, 'Admin Internal Copy');
  expectContains(source, 'Company Logo');
  expectContains(source, 'Signature Area');
  expectContains(source, 'Download PDF');
  expectContains(source, 'Print PDF');
  expectContains(appSource, "pdfCenter: 'pdf-center'");
  expectContains(appSource, "label: 'PDF Center'");
  expectNotContains(dealsSource, 'Party PDF');
  expectNotContains(dealsSource, 'Factory PDF');
  expectNotContains(dealsSource, 'Admin PDF');
}

test();
console.log('Invoice rendering regression checks passed.');
