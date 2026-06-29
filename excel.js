import { fmtDate, fmtMoney, fmtNum, normalizeDeal } from './app.js';

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
