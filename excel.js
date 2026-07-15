import { fmtDate, fmtMoney, fmtNum, normalizeDeal, toast } from './app.js';

function csvCell(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows, filename) {
  const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function parseCsvRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function exportDealsExcel(deals, filename = 'deals') {
  const rows = [
    ['Deal No', 'Date', 'Party', 'Factory', 'Grade', 'Bucket', 'KG', 'Factory Rate', 'Commission/KG', 'Party Rate', 'Purchase', 'Sale', 'Profit', 'Remarks']
  ];

  deals.map(normalizeDeal).forEach((d) => {
    d.grades.forEach((g, i) => {
      rows.push([
        d.dealNo,
        fmtDate(d.date),
        d.partyName,
        d.factoryName,
        g.grade,
        g.bucket,
        fmtNum(g.kg, 3),
        g.factoryRate,
        g.commissionPerKg,
        g.partyRate,
        g.purchaseAmount,
        g.saleAmount,
        g.profit,
        i === 0 ? (d.remarks || '') : ''
      ]);
    });
    if (d.grades.length > 1) {
      rows.push([
        d.dealNo, '', '', '', 'DEAL TOTAL', d.totalBucket, fmtNum(d.totalKg, 3),
        '', '', '', d.totalPurchase, d.totalSale, d.totalProfit, ''
      ]);
    }
  });

  downloadCsv(rows, filename);
}

export function exportPaymentsExcel(payments, filename = 'payments') {
  const rows = [
    ['Payment No', 'Date', 'Name', 'Amount', 'Mode', 'Reference', 'Remarks'],
    ...payments.map((p) => [p.paymentNo, fmtDate(p.date), p.entityName, p.amount, p.mode, p.referenceNo || '', p.remarks || ''])
  ];
  downloadCsv(rows, filename);
}

export function exportLedgerExcel(rows, filename = 'ledger') {
  const data = [
    ['Date', 'Reference', 'Description', 'KG', 'Debit', 'Credit', 'Balance'],
    ...rows.map((r) => [
      fmtDate(r.date), r.ref, r.desc,
      r.kg != null ? fmtNum(r.kg, 3) : '',
      r.debit || '', r.credit || '', r.balance
    ])
  ];
  downloadCsv(data, filename);
}

export function exportReportCsv(rows, filename = 'report') {
  const header = Object.keys(rows[0] || {}).map((key) => key.replace(/([A-Z])/g, ' $1').trim());
  const data = [header, ...rows.map((row) => header.map((key) => row[key] ?? ''))];
  downloadCsv(data, filename);
}

export function importDealsFromCsv(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) throw new Error('CSV file is empty or has no data rows.');
        
        const headers = parseCsvRow(lines[0]);
        let imported = 0;
        const errors = [];
        const dealsData = [];
        
        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCsvRow(lines[i]);
            if (values.length < headers.length) continue;
            
            const row = {};
            headers.forEach((h, idx) => row[h] = values[idx]);
            
            if (row['Deal No'] && row['Date'] && row['Party'] && row['Factory']) {
              const grade = row['Grade'] || 'Standard';
              const bucket = parseFloat(row['Bucket']) || 0;
              const kg = parseFloat(row['KG']) || 0;
              const factoryRate = parseFloat(row['Factory Rate']) || 0;
              const commissionPerKg = parseFloat(row['Commission/KG']) || 0;
              
              if (kg > 0 && factoryRate > 0) {
                dealsData.push({
                  date: row['Date'],
                  partyName: row['Party'],
                  factoryName: row['Factory'],
                  grades: [{
                    grade,
                    bucket,
                    kg,
                    factoryRate,
                    commissionPerKg
                  }],
                  remarks: row['Remarks'] || ''
                });
                imported++;
              }
            }
          } catch (err) {
            errors.push(`Row ${i + 1}: ${err.message}`);
          }
        }
        
        resolve({ imported, errors, dealsData });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read CSV file.'));
    reader.readAsText(file);
  });
}

export function importRatesFromCsv(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) throw new Error('CSV file is empty or has no data rows.');
        
        const headers = parseCsvRow(lines[0]);
        let imported = 0;
        const errors = [];
        const ratesData = [];
        
        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCsvRow(lines[i]);
            if (values.length < headers.length) continue;
            
            const row = {};
            headers.forEach((h, idx) => row[h] = values[idx]);
            
            if (row['Grade']) {
              const factoryRate = parseFloat(row['Factory Rate']) || 0;
              const commissionPerKg = parseFloat(row['Commission/KG']) || 0;
              
              ratesData.push({
                grade: row['Grade'],
                factoryRate,
                commissionPerKg
              });
              imported++;
            }
          } catch (err) {
            errors.push(`Row ${i + 1}: ${err.message}`);
          }
        }
        
        resolve({ imported, errors, ratesData });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read CSV file.'));
    reader.readAsText(file);
  });
}
