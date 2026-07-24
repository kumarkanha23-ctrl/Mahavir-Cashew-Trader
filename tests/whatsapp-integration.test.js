const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'app.js');
const dealsPath = path.join(__dirname, '..', 'deals.js');
const ledgerPath = path.join(__dirname, '..', 'ledger.js');
const reportsPath = path.join(__dirname, '..', 'reports.js');

const appSource = fs.readFileSync(appPath, 'utf8');
const dealsSource = fs.readFileSync(dealsPath, 'utf8');
const ledgerSource = fs.readFileSync(ledgerPath, 'utf8');
const reportsSource = fs.readFileSync(reportsPath, 'utf8');

function expectContains(text, needle) {
  assert.ok(text.includes(needle), `Expected to find: ${needle}`);
}

function test() {
  expectContains(appSource, 'buildWhatsAppMessage');
  expectContains(appSource, 'openWhatsApp');
  expectContains(dealsSource, 'Send to WhatsApp');
  expectContains(ledgerSource, 'whatsapp');
  expectContains(reportsSource, 'whatsappNumber');
}

test();
console.log('WhatsApp integration regression checks passed.');
