import { APP_NAME, USER_ROLES, getUserProfile, fmtDate, fmtMoney, fmtNum, normalizeDeal, getState } from './app.js';

const PRINT_STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Segoe UI', Poppins, Arial, sans-serif; background: #f3f4f6; color: #1f2937; }
  .pdf-shell { padding: 20px; }
  .pdf-fallback-overlay { position: fixed; inset: 0; background: rgba(17, 24, 39, 0.7); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 99999; }
  .pdf-fallback-card { width: min(920px, 100%); max-height: 90vh; overflow: auto; background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.28); padding: 18px; }
  .pdf-fallback-card h3 { margin: 0 0 8px; color: #166534; }
  .pdf-fallback-card .pdf-actions { display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 14px; }
  .pdf-actions button { border: none; border-radius: 999px; padding: 8px 14px; background: #166534; color: #fff; cursor: pointer; font-weight: 600; }
  .pdf-actions button.secondary { background: #4b5563; }
  .pdf-page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 16mm; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.12); border-radius: 12px; }
  .brand { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 2px solid #166534; }
  .brand h1 { margin: 0; font-size: 24px; color: #166534; }
  .brand .badge { padding: 6px 10px; border-radius: 999px; background: #f0fdf4; color: #166534; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .meta { color: #6b7280; font-size: 12px; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .card { border: 1px solid #e5e7eb; padding: 12px; border-radius: 10px; background: #fafafa; }
  .card h3 { margin: 0 0 8px 0; color: #166534; font-size: 14px; }
  .card p { margin: 4px 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
  th { background: #166534; color: #fff; padding: 10px 8px; text-align: left; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .summary { display: flex; gap: 10px; flex-wrap: wrap; margin: 16px 0; }
  .summary .pill { flex: 1; min-width: 140px; background: #f0fdf4; padding: 10px 12px; border-radius: 8px; font-size: 13px; }
  .summary .pill strong { display: block; color: #166534; font-size: 16px; margin-top: 3px; }
  .status { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #dcfce7; color: #166534; }
  .status.pending { background: #fef3c7; color: #92400e; }
  .note { margin-top: 14px; padding: 10px 12px; border-left: 4px solid #166534; background: #f9fafb; font-size: 13px; }
  .muted { color: #6b7280; }
  .footer { margin-top: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; }
    .pdf-shell { padding: 0; }
    .pdf-actions { display: none !important; }
    .pdf-page { box-shadow: none; border-radius: 0; max-width: none; padding: 0; }
  }
  @media (max-width: 700px) {
    .grid { grid-template-columns: 1fr; }
    .pdf-shell { padding: 10px; }
  }
`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPdfWindow(title, htmlContent, options = {}) {
  const { autoPrint = false, showActions = true, shareText = '', windowName = '' } = options;
  const actions = showActions ? `
    <div class="pdf-actions">
      <button id="downloadPdfBtn">Download PDF</button>
      <button id="sharePdfBtn" class="secondary">Share PDF</button>
    </div>` : '';
  const documentHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>${PRINT_STYLE}</style></head><body>
    <div class="pdf-shell">${actions}<div class="pdf-page">${htmlContent}</div></div>
    <script>
      const downloadBtn = document.getElementById('downloadPdfBtn');
      const shareBtn = document.getElementById('sharePdfBtn');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => window.print());
      // If options.pdf is true, try to generate a real PDF blob and open that in a new tab.
      if (options.pdf && typeof window.html2pdf !== 'undefined') {
        try {
          const container = document.createElement('div');
          container.style.position = 'fixed'; container.style.left = '-9999px';
          container.innerHTML = htmlContent;
          document.body.appendChild(container);
          const opt = {
            margin: 10,
            filename: (options.fileName || `${windowName || 'document'}.pdf`),
            jsPDF: { unit: 'pt', format: 'a4' },
            html2canvas: { scale: 2 },
          };
          // html2pdf returns a Promise when using output('blob') after toPdf()
          html2pdf().from(container).set(opt).toPdf().output('blob').then((blob) => {
            try {
              const url = URL.createObjectURL(blob);
              window.open(url, windowName || '_blank', 'noopener');
              setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 60 * 1000);
            } finally {
              try { document.body.removeChild(container); } catch (e) {}
            }
          }).catch((e) => {
            try { document.body.removeChild(container); } catch (er) {}
            // fallback to opening HTML if PDF generation fails
            const blob = new Blob([documentHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const win = window.open(url, windowName || '_blank', 'noopener');
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch (err) {} }, 60 * 1000);
            return win;
          });
          return null;
        } catch (err) {
          // fall through to HTML preview fallback
        }
      }

      try {
        const blob = new Blob([documentHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, windowName || '_blank', 'noopener');
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 60 * 1000);
        return win;
      } catch (err) {
        const win = window.open('', windowName || '_blank');
        if (win) {
          try { win.document.write(documentHtml); win.document.close(); win.focus(); } catch (e) {}
          if (autoPrint) { try { setTimeout(() => win.print(), 350); } catch (e) {} }
          return win;
        }
      }
    </script>
  </body></html>`;

  try {
    const blob = new Blob([documentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, windowName || '_blank', 'noopener');
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 60 * 1000);
    return win;
  } catch (err) {
    const win = window.open('', windowName || '_blank');
    if (win) {
      try { win.document.write(documentHtml); win.document.close(); win.focus(); } catch (e) {}
      if (autoPrint) { try { setTimeout(() => win.print(), 350); } catch (e) {} }
      return win;
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'pdf-fallback-overlay';
  overlay.innerHTML = `
    <div class="pdf-fallback-card">
      <div class="pdf-actions">
        <button id="fallbackPrintBtn">Print / Save as PDF</button>
        <button id="fallbackShareBtn" class="secondary">Share</button>
      </div>
      <h3>${escapeHtml(title)}</h3>
      <div class="pdf-page">${htmlContent}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#fallbackPrintBtn').addEventListener('click', () => window.print());
  overlay.querySelector('#fallbackShareBtn').addEventListener('click', async () => {
    const text = shareText;
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(text); alert('Invoice details copied to clipboard.'); return; } catch {}
    }
    alert('Sharing is not available in this browser.');
  });
  if (autoPrint) {
    setTimeout(() => window.print(), 350);
  }
  return null;
}

export function printHtmlPdf(title, htmlContent, options = {}) {
  buildPdfWindow(title, htmlContent, { ...options, autoPrint: options.autoPrint ?? true, showActions: options.showActions ?? true });
}

function dealPdfRows(deals) {
  return deals.map(normalizeDeal).map((d) => {
    if (d.grades.length <= 1) {
      const g = d.grades[0];
      return `<tr>
        <td>${escapeHtml(d.dealNo)}</td><td>${escapeHtml(fmtDate(d.date))}</td><td>${escapeHtml(d.partyName)}</td><td>${escapeHtml(d.factoryName)}</td>
        <td>${escapeHtml(g?.grade || '—')}</td><td>${escapeHtml(fmtNum(d.totalKg, 3))}</td><td>${escapeHtml(fmtMoney(d.totalPurchase))}</td>
        <td>${escapeHtml(fmtMoney(d.totalSale))}</td><td>${escapeHtml(fmtMoney(d.totalProfit))}</td>
      </tr>`;
    }
    const lines = d.grades.map((g, i) => `
      <tr>
        <td>${i === 0 ? escapeHtml(d.dealNo) : ''}</td><td>${i === 0 ? escapeHtml(fmtDate(d.date)) : ''}</td>
        <td>${i === 0 ? escapeHtml(d.partyName) : ''}</td><td>${i === 0 ? escapeHtml(d.factoryName) : ''}</td>
        <td>${escapeHtml(g.grade)}</td><td>${escapeHtml(fmtNum(g.kg, 3))}</td><td>${escapeHtml(fmtMoney(g.purchaseAmount))}</td>
        <td>${escapeHtml(fmtMoney(g.saleAmount))}</td><td>${escapeHtml(fmtMoney(g.profit))}</td>
      </tr>`).join('');
    const total = `<tr class="deal-total-row">
      <td colspan="5"><strong>Deal Total</strong></td>
      <td><strong>${escapeHtml(fmtNum(d.totalKg, 3))}</strong></td>
      <td><strong>${escapeHtml(fmtMoney(d.totalPurchase))}</strong></td>
      <td><strong>${escapeHtml(fmtMoney(d.totalSale))}</strong></td>
      <td><strong>${escapeHtml(fmtMoney(d.totalProfit))}</strong></td>
    </tr>`;
    return lines + total;
  }).join('');
}

export function printDealsPdf(title, deals, totals) {
  const html = `
    <div class="summary">
      <div class="pill">Total KG<strong>${escapeHtml(fmtNum(totals.kg, 3))}</strong></div>
      <div class="pill">Purchase<strong>${escapeHtml(fmtMoney(totals.purchase))}</strong></div>
      <div class="pill">Sale<strong>${escapeHtml(fmtMoney(totals.sale))}</strong></div>
      <div class="pill">Profit<strong>${escapeHtml(fmtMoney(totals.profit))}</strong></div>
      ${totals.commission != null ? `<div class="pill">Commission<strong>${escapeHtml(fmtMoney(totals.commission))}</strong></div>` : ''}
    </div>
    <table>
      <thead><tr><th>Deal No</th><th>Date</th><th>Party</th><th>Factory</th><th>Grade</th><th>KG</th><th>Purchase</th><th>Sale</th><th>Profit</th></tr></thead>
      <tbody>${dealPdfRows(deals)}</tbody>
    </table>`;

  printHtmlPdf(title, html, { autoPrint: true, showActions: true });
}

export function printLedgerPdf(title, report, type) {
  const isParty = type === 'PARTY';
  const summary = `
    <div class="summary">
      <div class="pill">Total KG<strong>${escapeHtml(fmtNum(report.totalKg, 3))}</strong></div>
      <div class="pill">${isParty ? 'Total Sale' : 'Total Purchase'}<strong>${escapeHtml(fmtMoney(isParty ? report.totalSale : report.totalPurchase))}</strong></div>
      <div class="pill">Total Paid<strong>${escapeHtml(fmtMoney(report.totalPaid))}</strong></div>
      <div class="pill">Outstanding<strong>${escapeHtml(fmtMoney(report.outstanding))}</strong></div>
    </div>`;

  const rows = report.rows.map((r) => `
    <tr>
      <td>${escapeHtml(fmtDate(r.date))}</td><td>${escapeHtml(r.ref)}</td><td>${escapeHtml(r.desc)}</td>
      <td>${r.kg != null ? escapeHtml(fmtNum(r.kg, 3)) : '—'}</td>
      <td>${isParty ? (r.debit ? escapeHtml(fmtMoney(r.debit)) : '—') : (r.credit ? escapeHtml(fmtMoney(r.credit)) : '—')}</td>
      <td>${isParty ? (r.credit ? escapeHtml(fmtMoney(r.credit)) : '—') : (r.debit ? escapeHtml(fmtMoney(r.debit)) : '—')}</td>
      <td>${escapeHtml(fmtMoney(r.balance))}</td>
    </tr>`).join('');

  const html = `${summary}
    <table>
      <thead><tr><th>Date</th><th>Ref</th><th>Description</th><th>KG</th>
      <th>${isParty ? 'Sale (Dr)' : 'Purchase (Cr)'}</th><th>Payment</th><th>Balance</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  printHtmlPdf(title, html, { autoPrint: true, showActions: true });
}

function getDealPayments(state, deal) {
  const partyPayments = (state.payments || []).filter((p) => p.type === 'PARTY' && p.partyId === deal.partyId);
  const factoryPayments = (state.payments || []).filter((p) => p.type === 'FACTORY' && p.factoryId === deal.factoryId);
  return [...partyPayments, ...factoryPayments].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function getRoleTemplate(role) {
  if (role === USER_ROLES.PARTY) return 'party';
  if (role === USER_ROLES.FACTORY) return 'factory';
  return 'admin';
}

function openWhatsAppShare(text, fileName) {
  const encodedText = encodeURIComponent(text);
  const encodedFile = encodeURIComponent(fileName);
  const url = `https://wa.me/?text=${encodedText}${encodedFile ? `&file=${encodedFile}` : ''}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function printBrokerDealPdfs(dealId) {
  const state = getState();
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return;
  const d = normalizeDeal(deal);
  const role = USER_ROLES.ADMIN;
  const settings = state.settings || {};
  const party = state.parties.find((p) => p.id === d.partyId);
  const factory = state.factories.find((f) => f.id === d.factoryId);
  const invoiceDate = d.date || new Date().toISOString().slice(0, 10);
  const invoiceNo = d.dealNo || `INV-${String(Date.now()).slice(-6)}`;
  const firstGrade = d.grades?.[0] || {};
  const productName = settings.productName || 'Cashew';
  const paymentTerms = settings.paymentTerms || 'Payment due within 7 days of delivery.';

  const buildPartyHtml = () => `
    <div class="brand">
      <div>
        <h1>${escapeHtml(APP_NAME)}</h1>
        <div class="meta">Broker ERP • Party Invoice</div>
      </div>
      <div class="badge">PARTY</div>
    </div>
    <div class="summary">
      <div class="pill">Invoice Number<strong>${escapeHtml(invoiceNo)}</strong></div>
      <div class="pill">Date<strong>${escapeHtml(fmtDate(invoiceDate))}</strong></div>
      <div class="pill">Party Name<strong>${escapeHtml(party?.name || d.partyName || '—')}</strong></div>
      <div class="pill">Grand Total<strong>${escapeHtml(fmtMoney(d.totalSale || 0))}</strong></div>
    </div>
    <div class="card" style="margin-bottom: 14px;">
      <p><strong>Product:</strong> ${escapeHtml(productName)}</p>
    </div>
    <table>
      <thead><tr><th>Grade</th><th>Bucket</th><th>KG</th><th>Selling Rate</th><th>Amount</th></tr></thead>
      <tbody>${d.grades.map((g) => `<tr><td>${escapeHtml(g.grade || '—')}</td><td>${escapeHtml(fmtNum(g.bucket || 0, 2))}</td><td>${escapeHtml(fmtNum(g.kg || 0, 3))}</td><td>${escapeHtml(fmtMoney(g.partyRate || 0))}</td><td>${escapeHtml(fmtMoney(g.saleAmount || 0))}</td></tr>`).join('')}</tbody>
      <tfoot>
        <tr>
          <td colspan="4"><strong>Grand Total</strong></td>
          <td><strong>${escapeHtml(fmtMoney(d.totalSale || 0))}</strong></td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">Generated for ${escapeHtml(settings.companyName || APP_NAME)} • ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>`;

  const buildFactoryHtml = () => `
    <div class="brand">
      <div>
        <h1>${escapeHtml(APP_NAME)}</h1>
        <div class="meta">Broker ERP • Factory Purchase Order</div>
      </div>
      <div class="badge">FACTORY</div>
    </div>
    <div class="summary">
      <div class="pill">PO Number<strong>${escapeHtml(invoiceNo)}</strong></div>
      <div class="pill">Date<strong>${escapeHtml(fmtDate(invoiceDate))}</strong></div>
      <div class="pill">Quantity<strong>${escapeHtml(fmtNum(d.totalKg || 0, 3))}</strong></div>
      <div class="pill">Total<strong>${escapeHtml(fmtMoney(d.totalPurchase || 0))}</strong></div>
    </div>
    <div class="grid">
      <div class="card">
        <h3>Factory Details</h3>
        <p><strong>${escapeHtml(factory?.name || d.factoryName || '—')}</strong></p>
        <p>Product: ${escapeHtml(productName)}</p>
        <p>Date: ${escapeHtml(fmtDate(invoiceDate))}</p>
      </div>
      <div class="card">
        <h3>Order Summary</h3>
        <p>Bucket: ${escapeHtml(fmtNum(d.totalBucket || 0, 2))}</p>
        <p>KG: ${escapeHtml(fmtNum(d.totalKg || 0, 3))}</p>
        <p>Purchase Rate: ${escapeHtml(fmtMoney(firstGrade.factoryRate || 0))}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Grade</th><th>Bucket</th><th>KG</th><th>Purchase Rate</th><th>Total Amount</th></tr></thead>
      <tbody>${d.grades.map((g) => `<tr><td>${escapeHtml(g.grade || '—')}</td><td>${escapeHtml(fmtNum(g.bucket || 0, 2))}</td><td>${escapeHtml(fmtNum(g.kg || 0, 3))}</td><td>${escapeHtml(fmtMoney(g.factoryRate || 0))}</td><td>${escapeHtml(fmtMoney(g.purchaseAmount || 0))}</td></tr>`).join('')}</tbody>
    </table>
    <div class="footer">Generated for ${escapeHtml(settings.companyName || APP_NAME)} • ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>`;

  const buildAdminHtml = () => `
    <div class="brand">
      <div>
        <h1>${escapeHtml(APP_NAME)}</h1>
        <div class="meta">Broker ERP • Admin Internal Copy</div>
      </div>
      <div class="badge">ADMIN</div>
    </div>
    <div class="summary">
      <div class="pill">Invoice No.<strong>${escapeHtml(invoiceNo)}</strong></div>
      <div class="pill">Date<strong>${escapeHtml(fmtDate(invoiceDate))}</strong></div>
      <div class="pill">Deal ID<strong>${escapeHtml(d.id || '—')}</strong></div>
      <div class="pill">Quantity<strong>${escapeHtml(fmtNum(d.totalKg || 0, 3))}</strong></div>
      <div class="pill">Purchase Amount<strong>${escapeHtml(fmtMoney(d.totalPurchase || 0))}</strong></div>
      <div class="pill">Sale Amount<strong>${escapeHtml(fmtMoney(d.totalSale || 0))}</strong></div>
      <div class="pill">Profit<strong>${escapeHtml(fmtMoney(d.totalProfit || 0))}</strong></div>
      <div class="pill">Outstanding<strong>${escapeHtml(fmtMoney(Math.max(0, Number(d.totalSale || 0) - (state.payments || []).filter((p) => p.type === 'PARTY' && p.partyId === d.partyId).reduce((sum, payment) => sum + Number(payment.amount || 0), 0))))}</strong></div>
    </div>
    <div class="grid">
      <div class="card">
        <h3>Party Details</h3>
        <p><strong>${escapeHtml(party?.name || d.partyName || '—')}</strong></p>
        ${party?.phone ? `<p>Phone: ${escapeHtml(party.phone)}</p>` : ''}
        ${party?.address ? `<p>Address: ${escapeHtml(party.address)}</p>` : ''}
      </div>
      <div class="card">
        <h3>Factory Details</h3>
        <p><strong>${escapeHtml(factory?.name || d.factoryName || '—')}</strong></p>
        ${factory?.phone ? `<p>Phone: ${escapeHtml(factory.phone)}</p>` : ''}
        ${factory?.address ? `<p>Address: ${escapeHtml(factory.address)}</p>` : ''}
      </div>
    </div>
    <div class="grid">
      <div class="card">
        <h3>Rates & Profitability</h3>
        <p>Party Rate: ${escapeHtml(fmtMoney(firstGrade.partyRate || 0))}</p>
        <p>Factory Rate: ${escapeHtml(fmtMoney(firstGrade.factoryRate || 0))}</p>
        <p>Commission: ${escapeHtml(fmtMoney(d.totalCommission || 0))}</p>
        <p>Profit: ${escapeHtml(fmtMoney(d.totalProfit || 0))}</p>
      </div>
      <div class="card">
        <h3>Payment Summary</h3>
        <p>Outstanding: ${escapeHtml(fmtMoney(Math.max(0, Number(d.totalSale || 0) - (state.payments || []).filter((p) => p.type === 'PARTY' && p.partyId === d.partyId).reduce((sum, payment) => sum + Number(payment.amount || 0), 0))))}</p>
        <p>Paid: ${escapeHtml(fmtMoney((state.payments || []).filter((p) => p.type === 'PARTY' && p.partyId === d.partyId).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)))}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Grade</th><th>Bucket</th><th>KG</th><th>Selling Rate</th><th>Purchase Rate</th><th>Commission</th><th>Profit</th><th>Amount</th></tr></thead>
      <tbody>${d.grades.map((g) => `<tr><td>${escapeHtml(g.grade || '—')}</td><td>${escapeHtml(fmtNum(g.bucket || 0, 2))}</td><td>${escapeHtml(fmtNum(g.kg || 0, 3))}</td><td>${escapeHtml(fmtMoney(g.partyRate || 0))}</td><td>${escapeHtml(fmtMoney(g.factoryRate || 0))}</td><td>${escapeHtml(fmtMoney(g.commissionPerKg || 0))}</td><td>${escapeHtml(fmtMoney(g.profit || 0))}</td><td>${escapeHtml(fmtMoney(g.saleAmount || 0))}</td></tr>`).join('')}</tbody>
    </table>
    <div class="note"><strong>Remarks:</strong> ${escapeHtml(d.remarks || 'No notes captured.')}</div>
    <div class="footer">Generated for ${escapeHtml(settings.companyName || APP_NAME)} • ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>`;

  const partyText = `${APP_NAME} Party Invoice\nInvoice No: ${invoiceNo}\nDate: ${fmtDate(invoiceDate)}\nAmount: ${fmtMoney(d.totalSale || 0)}`;
  const factoryText = `${APP_NAME} Factory Purchase Order\nPurchase Order No: ${invoiceNo}\nDate: ${fmtDate(invoiceDate)}\nAmount: ${fmtMoney(d.totalPurchase || 0)}`;

  const partyFileName = `party-invoice-${invoiceNo}.html`;
  const factoryFileName = `factory-po-${invoiceNo}.html`;
  const adminFileName = `admin-copy-${invoiceNo}.html`;

  buildPdfWindow(`Party Invoice - ${invoiceNo}`, buildPartyHtml(), { autoPrint: true, showActions: true, shareText: partyText, windowName: `party-invoice-${invoiceNo}` });
  buildPdfWindow(`Factory Purchase Order - ${invoiceNo}`, buildFactoryHtml(), { autoPrint: true, showActions: true, shareText: factoryText, windowName: `factory-po-${invoiceNo}` });
  buildPdfWindow(`Admin Copy - ${invoiceNo}`, buildAdminHtml(), { autoPrint: true, showActions: true, shareText: `${APP_NAME} Admin Copy\nInvoice No: ${invoiceNo}`, windowName: `admin-copy-${invoiceNo}` });

  const partyWindow = window.open('', `party-text-${invoiceNo}`, 'noopener,noreferrer');
  if (partyWindow) {
    partyWindow.document.write(`<pre>${escapeHtml(partyText)}</pre>`);
    partyWindow.document.close();
  }

  return { partyFileName, factoryFileName, adminFileName };
}

export function generatePartyPDF(deal) {
  const dealId = deal && typeof deal === 'object' ? deal.id : deal;
  if (!dealId) {
    alert('Deal not found.');
    return;
  }
  return printInvoicePdf(dealId, 'party');
}

export function generateFactoryPDF(deal) {
  const dealId = deal && typeof deal === 'object' ? deal.id : deal;
  if (!dealId) {
    alert('Deal not found.');
    return;
  }
  return printInvoicePdf(dealId, 'factory');
}

export function generateAdminPDF(deal) {
  const dealId = deal && typeof deal === 'object' ? deal.id : deal;
  if (!dealId) {
    alert('Deal not found.');
    return;
  }
  return printInvoicePdf(dealId, 'admin');
}

export function printInvoicePdf(dealId, templateName = 'party') {
  const state = getState();
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) {
    alert('Deal not found.');
    return;
  }

  const d = normalizeDeal(deal);
  const role = getUserProfile().role || USER_ROLES.ADMIN;
  const template = ['party', 'factory', 'admin'].includes(String(templateName).toLowerCase())
    ? String(templateName).toLowerCase()
    : getRoleTemplate(role);
  const settings = state.settings || {};
  const party = state.parties.find((p) => p.id === d.partyId);
  const factory = state.factories.find((f) => f.id === d.factoryId);
  const payments = getDealPayments(state, d);
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstanding = Math.max(0, Number(d.totalSale || 0) - totalPaid);
  const paymentStatus = outstanding > 0 ? 'Pending' : 'Paid';
  const invoiceNo = d.dealNo || `INV-${String(Date.now()).slice(-6)}`;
  const invoiceDate = d.date || new Date().toISOString().slice(0, 10);
  const firstGrade = d.grades?.[0] || {};
  const productName = settings.productName || 'Cashew';
  const shareText = [
    `${APP_NAME} ${template === 'party' ? 'Party Invoice' : template === 'factory' ? 'Factory Purchase Order' : 'Admin Copy'}`,
    `Invoice No: ${invoiceNo}`,
    `Date: ${fmtDate(invoiceDate)}`,
    `Amount: ${fmtMoney(template === 'factory' ? d.totalPurchase : d.totalSale)}`
  ].join('\n');

  let rowsHtml = '';
  if (template === 'party') {
    rowsHtml = d.grades.map((g) => `
      <tr>
        <td>${escapeHtml(g.grade || '—')}</td>
        <td>${escapeHtml(fmtNum(g.bucket || 0, 2))}</td>
        <td>${escapeHtml(fmtNum(g.kg || 0, 3))}</td>
        <td>${escapeHtml(fmtMoney(g.partyRate || 0))}</td>
        <td>${escapeHtml(fmtMoney(g.saleAmount || 0))}</td>
      </tr>`).join('');
  } else if (template === 'factory') {
    rowsHtml = d.grades.map((g) => `
      <tr>
        <td>${escapeHtml(g.grade || '—')}</td>
        <td>${escapeHtml(fmtNum(g.bucket || 0, 2))}</td>
        <td>${escapeHtml(fmtNum(g.kg || 0, 3))}</td>
        <td>${escapeHtml(fmtMoney(g.factoryRate || 0))}</td>
        <td>${escapeHtml(fmtMoney(g.purchaseAmount || 0))}</td>
      </tr>`).join('');
  } else {
    rowsHtml = d.grades.map((g) => `
      <tr>
        <td>${escapeHtml(g.grade || '—')}</td>
        <td>${escapeHtml(fmtNum(g.bucket || 0, 2))}</td>
        <td>${escapeHtml(fmtNum(g.kg || 0, 3))}</td>
        <td>${escapeHtml(fmtMoney(g.partyRate || 0))}</td>
        <td>${escapeHtml(fmtMoney(g.factoryRate || 0))}</td>
        <td>${escapeHtml(fmtMoney(g.commissionPerKg || 0))}</td>
        <td>${escapeHtml(fmtMoney(g.profit || 0))}</td>
        <td>${escapeHtml(fmtMoney(g.saleAmount || 0))}</td>
      </tr>`).join('');
  }

  const summaryHtml = template === 'party' ? `
    <div class="summary">
      <div class="pill">Invoice Number<strong>${escapeHtml(invoiceNo)}</strong></div>
      <div class="pill">Date<strong>${escapeHtml(fmtDate(invoiceDate))}</strong></div>
      <div class="pill">Party Name<strong>${escapeHtml(party?.name || d.partyName || '—')}</strong></div>
      <div class="pill">Grand Total<strong>${escapeHtml(fmtMoney(d.totalSale || 0))}</strong></div>
    </div>` : template === 'factory' ? `
    <div class="summary">
      <div class="pill">PO Number<strong>${escapeHtml(invoiceNo)}</strong></div>
      <div class="pill">Date<strong>${escapeHtml(fmtDate(invoiceDate))}</strong></div>
      <div class="pill">Quantity<strong>${escapeHtml(fmtNum(d.totalKg || 0, 3))}</strong></div>
      <div class="pill">Total<strong>${escapeHtml(fmtMoney(d.totalPurchase || 0))}</strong></div>
    </div>` : `
    <div class="summary">
      <div class="pill">Invoice No.<strong>${escapeHtml(invoiceNo)}</strong></div>
      <div class="pill">Deal ID<strong>${escapeHtml(d.id || '—')}</strong></div>
      <div class="pill">Outstanding<strong>${escapeHtml(fmtMoney(outstanding))}</strong></div>
      <div class="pill">Total KG<strong>${escapeHtml(fmtNum(d.totalKg || 0, 3))}</strong></div>
      <div class="pill">Total Profit<strong>${escapeHtml(fmtMoney(d.totalProfit || 0))}</strong></div>
    </div>`;

  const partySection = template === 'party' ? `
    <div class="card">
      <h3>Party Invoice Details</h3>
      <p><strong>Party Name:</strong> ${escapeHtml(party?.name || d.partyName || '—')}</p>
      <p><strong>Product:</strong> ${escapeHtml(productName)}</p>
      <p><strong>Invoice Number:</strong> ${escapeHtml(invoiceNo)}</p>
      <p><strong>Date:</strong> ${escapeHtml(fmtDate(invoiceDate))}</p>
    </div>` : template === 'admin' ? `
    <div class="card">
      <h3>Party Details</h3>
      <p><strong>${escapeHtml(party?.name || d.partyName || '—')}</strong></p>
      ${party?.phone ? `<p>Phone: ${escapeHtml(party.phone)}</p>` : ''}
      ${party?.address ? `<p>Address: ${escapeHtml(party.address)}</p>` : ''}
    </div>` : '';

  const factorySection = template === 'factory' ? `
    <div class="card">
      <h3>Factory Details</h3>
      <p><strong>${escapeHtml(factory?.name || d.factoryName || '—')}</strong></p>
      ${factory?.phone ? `<p>${escapeHtml(factory.phone)}</p>` : ''}
      ${factory?.address ? `<p>${escapeHtml(factory.address)}</p>` : ''}
    </div>` : template === 'admin' ? `
    <div class="card">
      <h3>Factory Details</h3>
      <p><strong>${escapeHtml(factory?.name || d.factoryName || '—')}</strong></p>
      ${factory?.phone ? `<p>Phone: ${escapeHtml(factory.phone)}</p>` : ''}
      ${factory?.address ? `<p>Address: ${escapeHtml(factory.address)}</p>` : ''}
    </div>` : '';

  const adminSections = template === 'admin' ? `
    <div class="grid">
      ${partySection}
      ${factorySection}
    </div>
    <div class="grid">
      <div class="card">
        <h3>Rates & Profitability</h3>
        <p>Selling Rate: ${escapeHtml(fmtMoney(firstGrade.partyRate || 0))}</p>
        <p>Purchase Rate: ${escapeHtml(fmtMoney(firstGrade.factoryRate || 0))}</p>
        <p>Commission: ${escapeHtml(fmtMoney(d.totalCommission || 0))}</p>
        <p>Profit: ${escapeHtml(fmtMoney(d.totalProfit || 0))}</p>
      </div>
      <div class="card">
        <h3>Payment Summary</h3>
        <p>Outstanding: ${escapeHtml(fmtMoney(outstanding))}</p>
        <p>Paid: ${escapeHtml(fmtMoney(totalPaid))}</p>
        <p>Status: <span class="status ${paymentStatus === 'Pending' ? 'pending' : ''}">${escapeHtml(paymentStatus)}</span></p>
      </div>
    </div>` : template === 'party' ? `
    <div class="grid">
      ${partySection}
      <div class="card">
        <h3>Invoice Summary</h3>
        <p><strong>Bucket:</strong> ${escapeHtml(fmtNum(d.totalBucket || 0, 2))}</p>
        <p><strong>KG:</strong> ${escapeHtml(fmtNum(d.totalKg || 0, 3))}</p>
      </div>
    </div>` : '';

  const paymentRows = payments.length ? payments.map((payment) => `
    <tr>
      <td>${escapeHtml(fmtDate(payment.date))}</td>
      <td>${escapeHtml(payment.paymentNo || '—')}</td>
      <td>${escapeHtml(payment.mode || '—')}</td>
      <td>${escapeHtml(fmtMoney(payment.amount || 0))}</td>
    </tr>`).join('') : `<tr><td colspan="4" class="muted">No payment history found.</td></tr>`;

  const paymentHistoryBlock = template === 'admin' ? `
    <div class="card" style="margin-top: 14px;">
      <h3>Payment History</h3>
      <table>
        <thead><tr><th>Date</th><th>Ref</th><th>Mode</th><th>Amount</th></tr></thead>
        <tbody>${paymentRows}</tbody>
      </table>
    </div>` : '';

  const notesBlock = template === 'admin' ? `<div class="note"><strong>Internal Notes:</strong> ${escapeHtml(d.remarks || 'No notes captured.')}</div>` : template === 'party' ? '' : `<div class="note"><strong>Remarks:</strong> ${escapeHtml(d.remarks || 'No remarks captured.')}</div>`;

  const headerTitle = template === 'party' ? 'Party Invoice' : template === 'factory' ? 'Factory Purchase Order / Invoice' : 'Admin Copy';
  const amountLabel = template === 'factory' ? 'Total Amount' : 'Total Amount';
  const amountValue = template === 'factory' ? fmtMoney(d.totalPurchase || 0) : fmtMoney(d.totalSale || 0);
  const html = `
    <div class="brand">
      <div>
        <h1>${escapeHtml(APP_NAME)}</h1>
        <div class="meta">Broker ERP • ${escapeHtml(headerTitle)}</div>
      </div>
      <div class="badge">${escapeHtml(template.toUpperCase())}</div>
    </div>

    ${summaryHtml}
    ${template === 'party' ? '' : `<div class="grid">
      <div class="card">
        <h3>${template === 'party' ? 'Party Details' : template === 'factory' ? 'Factory Details' : 'Trade Summary'}</h3>
        <p><strong>${escapeHtml(template === 'party' ? party?.name || d.partyName || '—' : template === 'factory' ? factory?.name || d.factoryName || '—' : `${party?.name || d.partyName || '—'} / ${factory?.name || d.factoryName || '—'}`)}</strong></p>
        <p>Product: ${escapeHtml(productName)}</p>
        <p>Date: ${escapeHtml(fmtDate(invoiceDate))}</p>
        <p>Invoice No: ${escapeHtml(invoiceNo)}</p>
      </div>
      <div class="card">
        <h3>Amount Summary</h3>
        <p>${escapeHtml(amountLabel)}: <strong>${escapeHtml(amountValue)}</strong></p>
        <p>Bucket: ${escapeHtml(fmtNum(d.totalBucket || 0, 2))}</p>
        <p>KG: ${escapeHtml(fmtNum(d.totalKg || 0, 3))}</p>
        <p>Rate: ${escapeHtml(fmtMoney(template === 'factory' ? firstGrade.factoryRate || 0 : firstGrade.partyRate || 0))}</p>
      </div>
    </div>`}

    ${adminSections}

    <table>
      <thead>
        <tr>
          <th>Grade</th>
          <th>Bucket</th>
          <th>KG</th>
          ${template === 'party' ? '<th>Selling Rate</th><th>Amount</th>' : template === 'factory' ? '<th>Rate</th><th>Amount</th>' : '<th>Selling Rate</th><th>Purchase Rate</th><th>Commission</th><th>Profit</th><th>Amount</th>'}
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    ${paymentHistoryBlock}
    ${notesBlock}

    <div class="footer">
      <div>Generated for ${escapeHtml(settings.companyName || APP_NAME)} on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
    </div>`;

  buildPdfWindow(`${headerTitle} - ${invoiceNo}`, html, { autoPrint: true, showActions: true, shareText, pdf: true, fileName: `${template}-${invoiceNo}.pdf` });
}
