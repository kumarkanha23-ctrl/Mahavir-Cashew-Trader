const fs = require('fs');
const path = require('path');

const root = process.cwd();
const publicDir = path.join(root, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const filesToCopy = [
  'index.html',
  'style.css',
  'app.js',
  'auth.js',
  'dashboard.js',
  'deals.js',
  'excel.js',
  'firebase.js',
  'ledger.js',
  'payment.js',
  'pdf.js',
  'reports.js',
  'vercel.json',
  'css',
  'js',
];

for (const item of filesToCopy) {
  const source = path.join(root, item);
  const destination = path.join(publicDir, item);

  if (!fs.existsSync(source)) {
    continue;
  }

  if (fs.statSync(source).isDirectory()) {
    fs.cpSync(source, destination, { recursive: true });
  } else {
    fs.copyFileSync(source, destination);
  }
}

console.log('Prepared public directory for Vercel static hosting');
