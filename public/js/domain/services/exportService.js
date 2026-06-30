import { formatDate } from '../../utils/date.js';
import { formatCurrency, formatNumber } from '../../utils/currency.js';
import { APP_NAME } from '../../config.js';

function escapeCsv(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(rows, columns, filename) {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCsv(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(',')
  ).join('\n');
  const csv = '\uFEFF' + header + '\n' + body;
  downloadBlob(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

export function exportDealsToExcel(deals, filename = 'deals') {
  exportToExcel(deals, [
    { key: 'dealNo', label: 'Deal No' },
    { key: 'date', label: 'Date', value: (r) => formatDate(r.date) },
    { key: 'partyName', label: 'Party' },
    { key: 'factoryName', label: 'Factory' },
    { key: 'grade', label: 'Grade' },
    { key: 'bucket', label: 'Bucket' },
    { key: 'kg', label: 'KG', value: (r) => formatNumber(r.kg, 3) },
    { key: 'factoryRate', label: 'Factory Rate' },
    { key: 'commissionPerKg', label: 'Commission/KG' },
    { key: 'partyRate', label: 'Party Rate' },
    { key: 'purchaseAmount', label: 'Purchase' },
    { key: 'saleAmount', label: 'Sale' },
    { key: 'profit', label: 'Profit' },
    { key: 'remarks', label: 'Remarks' }
  ], filename);
}

export function exportPaymentsToExcel(payments, filename = 'payments') {
  exportToExcel(payments, [
    { key: 'paymentNo', label: 'Payment No' },
    { key: 'date', label: 'Date', value: (r) => formatDate(r.date) },
    { key: 'entityName', label: 'Name' },
    { key: 'amount', label: 'Amount' },
    { key: 'mode', label: 'Mode' },
    { key: 'referenceNo', label: 'Reference' },
    { key: 'remarks', label: 'Remarks' }
  ], filename);
}

export function exportLedgerToExcel(rows, filename = 'ledger') {
  exportToExcel(rows, [
    { key: 'date', label: 'Date', value: (r) => formatDate(r.date) },
    { key: 'reference', label: 'Reference' },
    { key: 'description', label: 'Description' },
    { key: 'kg', label: 'KG', value: (r) => r.kg != null ? formatNumber(r.kg, 3) : '' },
    { key: 'debit', label: 'Debit', value: (r) => r.debit || '' },
    { key: 'credit', label: 'Credit', value: (r) => r.credit || '' },
    { key: 'balance', label: 'Balance' }
  ], filename);
}

export function printReport(title, htmlContent) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print or save as PDF.');
    return;
  }
  printWindow.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; padding: 24px; color: #333; }
  h1 { color: #166534; font-size: 22px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #166534; color: #fff; padding: 10px 8px; text-align: left; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .summary { margin-top: 20px; display: flex; gap: 24px; flex-wrap: wrap; }
  .summary div { background: #f0fdf4; padding: 12px 16px; border-radius: 8px; }
  .summary strong { display: block; color: #166534; font-size: 18px; }
  .summary span { font-size: 12px; color: #666; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>${APP_NAME}</h1>
<div class="meta">${title} — Generated ${new Date().toLocaleString('en-IN')}</div>
${htmlContent}
</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
}

export function exportToPdf(title, htmlContent) {
  printReport(title, htmlContent);
}

export function buildLedgerPrintHtml(report, type) {
  const isParty = type === 'PARTY';
  const summary = `
    <div class="summary">
      <div><span>Total KG</span><strong>${formatNumber(report.totalKg, 3)}</strong></div>
      <div><span>${isParty ? 'Total Sale' : 'Total Purchase'}</span><strong>${formatCurrency(isParty ? report.totalSale : report.totalPurchase)}</strong></div>
      <div><span>Total Paid</span><strong>${formatCurrency(report.totalPaid)}</strong></div>
      <div><span>Outstanding</span><strong>${formatCurrency(report.outstanding)}</strong></div>
    </div>`;

  const rows = report.rows.map((r) => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td>${r.reference}</td>
      <td>${r.description}</td>
      <td>${r.kg != null ? formatNumber(r.kg, 3) : '—'}</td>
      <td>${r.debit ? formatCurrency(r.debit) : '—'}</td>
      <td>${r.credit ? formatCurrency(r.credit) : '—'}</td>
      <td>${formatCurrency(r.balance)}</td>
    </tr>`).join('');

  return `${summary}
    <table>
      <thead><tr>
        <th>Date</th><th>Ref</th><th>Description</th><th>KG</th>
        <th>${isParty ? 'Sale (Dr)' : 'Purchase (Cr)'}</th>
        <th>Payment</th><th>Balance</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildDealsPrintHtml(deals, totals) {
  const rows = deals.map((d) => `
    <tr>
      <td>${d.dealNo}</td>
      <td>${formatDate(d.date)}</td>
      <td>${d.partyName}</td>
      <td>${d.factoryName}</td>
      <td>${d.grade}</td>
      <td>${formatNumber(d.kg, 3)}</td>
      <td>${formatCurrency(d.purchaseAmount)}</td>
      <td>${formatCurrency(d.saleAmount)}</td>
      <td>${formatCurrency(d.profit)}</td>
    </tr>`).join('');

  return `
    <div class="summary">
      <div><span>Total KG</span><strong>${formatNumber(totals.kg, 3)}</strong></div>
      <div><span>Purchase</span><strong>${formatCurrency(totals.purchase)}</strong></div>
      <div><span>Sale</span><strong>${formatCurrency(totals.sale)}</strong></div>
      <div><span>Profit</span><strong>${formatCurrency(totals.profit)}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th>Deal No</th><th>Date</th><th>Party</th><th>Factory</th>
        <th>Grade</th><th>KG</th><th>Purchase</th><th>Sale</th><th>Profit</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
