import { APP_NAME, fmtDate, fmtMoney, fmtNum, normalizeDeal } from './app.js';

const PRINT_STYLE = `
  body { font-family: 'Segoe UI', Poppins, sans-serif; padding: 24px; color: #333; }
  h1 { color: #166534; font-size: 22px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
  th { background: #166534; color: #fff; padding: 10px 8px; text-align: left; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .summary { margin: 16px 0; display: flex; gap: 16px; flex-wrap: wrap; }
  .summary div { background: #f0fdf4; padding: 10px 14px; border-radius: 8px; font-size: 13px; }
  .summary strong { display: block; color: #166534; font-size: 16px; }
  .deal-total-row td { font-weight: 700; background: #ecfdf5 !important; }
  @media print { body { padding: 0; } }
`;

export function printHtmlPdf(title, htmlContent) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Allow pop-ups to print or save as PDF.');
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${PRINT_STYLE}</style></head><body>
    <h1>${APP_NAME}</h1>
    <div class="meta">${title} — ${new Date().toLocaleString('en-IN')}</div>
    ${htmlContent}
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

function dealPdfRows(deals) {
  return deals.map(normalizeDeal).map((d) => {
    if (d.grades.length <= 1) {
      const g = d.grades[0];
      return `<tr>
        <td>${d.dealNo}</td><td>${fmtDate(d.date)}</td><td>${d.partyName}</td><td>${d.factoryName}</td>
        <td>${g?.grade || '—'}</td><td>${fmtNum(d.totalKg, 3)}</td><td>${fmtMoney(d.totalPurchase)}</td>
        <td>${fmtMoney(d.totalSale)}</td><td>${fmtMoney(d.totalProfit)}</td>
      </tr>`;
    }
    const lines = d.grades.map((g, i) => `
      <tr>
        <td>${i === 0 ? d.dealNo : ''}</td><td>${i === 0 ? fmtDate(d.date) : ''}</td>
        <td>${i === 0 ? d.partyName : ''}</td><td>${i === 0 ? d.factoryName : ''}</td>
        <td>${g.grade}</td><td>${fmtNum(g.kg, 3)}</td><td>${fmtMoney(g.purchaseAmount)}</td>
        <td>${fmtMoney(g.saleAmount)}</td><td>${fmtMoney(g.profit)}</td>
      </tr>`).join('');
    const total = `<tr class="deal-total-row">
      <td colspan="5"><strong>Deal Total</strong></td>
      <td><strong>${fmtNum(d.totalKg, 3)}</strong></td>
      <td><strong>${fmtMoney(d.totalPurchase)}</strong></td>
      <td><strong>${fmtMoney(d.totalSale)}</strong></td>
      <td><strong>${fmtMoney(d.totalProfit)}</strong></td>
    </tr>`;
    return lines + total;
  }).join('');
}

export function printDealsPdf(title, deals, totals) {
  const html = `
    <div class="summary">
      <div>Total KG<strong>${fmtNum(totals.kg, 3)}</strong></div>
      <div>Purchase<strong>${fmtMoney(totals.purchase)}</strong></div>
      <div>Sale<strong>${fmtMoney(totals.sale)}</strong></div>
      <div>Profit<strong>${fmtMoney(totals.profit)}</strong></div>
      ${totals.commission != null ? `<div>Commission<strong>${fmtMoney(totals.commission)}</strong></div>` : ''}
    </div>
    <table>
      <thead><tr><th>Deal No</th><th>Date</th><th>Party</th><th>Factory</th><th>Grade</th><th>KG</th><th>Purchase</th><th>Sale</th><th>Profit</th></tr></thead>
      <tbody>${dealPdfRows(deals)}</tbody>
    </table>`;

  printHtmlPdf(title, html);
}

export function printLedgerPdf(title, report, type) {
  const isParty = type === 'PARTY';
  const summary = `
    <div class="summary">
      <div>Total KG<strong>${fmtNum(report.totalKg, 3)}</strong></div>
      <div>${isParty ? 'Total Sale' : 'Total Purchase'}<strong>${fmtMoney(isParty ? report.totalSale : report.totalPurchase)}</strong></div>
      <div>Total Paid<strong>${fmtMoney(report.totalPaid)}</strong></div>
      <div>Outstanding<strong>${fmtMoney(report.outstanding)}</strong></div>
    </div>`;

  const rows = report.rows.map((r) => `
    <tr>
      <td>${fmtDate(r.date)}</td><td>${r.ref}</td><td>${r.desc}</td>
      <td>${r.kg != null ? fmtNum(r.kg, 3) : '—'}</td>
      <td>${isParty ? (r.debit ? fmtMoney(r.debit) : '—') : (r.credit ? fmtMoney(r.credit) : '—')}</td>
      <td>${isParty ? (r.credit ? fmtMoney(r.credit) : '—') : (r.debit ? fmtMoney(r.debit) : '—')}</td>
      <td>${fmtMoney(r.balance)}</td>
    </tr>`).join('');

  const html = `${summary}
    <table>
      <thead><tr><th>Date</th><th>Ref</th><th>Description</th><th>KG</th>
      <th>${isParty ? 'Sale (Dr)' : 'Purchase (Cr)'}</th><th>Payment</th><th>Balance</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  printHtmlPdf(title, html);
}
