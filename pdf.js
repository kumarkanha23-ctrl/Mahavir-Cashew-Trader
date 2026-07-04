import { APP_NAME, USER_ROLES, getUserProfile, fmtDate, fmtMoney, fmtNum, normalizeDeal, getState, filterDeals } from './app.js';

const PRINT_STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Segoe UI', Poppins, Arial, sans-serif; background: #f3f4f6; color: #1f2937; }
  .pdf-shell { padding: 20px; }
  .pdf-page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 16mm; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.12); border-radius: 12px; }
  .brand { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 2px solid #166534; }
  .brand h1 { margin: 0; font-size: 24px; color: #166534; }
  .brand .badge { padding: 6px 10px; border-radius: 999px; background: #f0fdf4; color: #166534; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .logo-box { display: inline-flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; background: #f0fdf4; }
  .logo-badge { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; background: #166534; color: #fff; font-weight: 700; }
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
  .signature { margin-top: 24px; display: flex; justify-content: space-between; gap: 16px; }
  .signature-box { flex: 1; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 12px; color: #475569; }
  .footer { margin-top: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; }
    .pdf-shell { padding: 0; }
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

function sanitizeFileName(value) {
  return String(value || 'document').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'document';
}

function ensureHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.html2pdf) {
      resolve();
      return;
    }
    if (typeof document === 'undefined') {
      reject(new Error('Document unavailable.'));
      return;
    }
    const existing = document.querySelector('script[data-pdf-engine="html2pdf"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load html2pdf.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js';
    script.async = true;
    script.setAttribute('data-pdf-engine', 'html2pdf');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load html2pdf.'));
    document.head.appendChild(script);
  });
}

async function waitForPdfRender(container) {
  if (typeof window === 'undefined' || !container) {
    return;
  }
  await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  if (document.fonts && typeof document.fonts.ready?.then === 'function') {
    try {
      await document.fonts.ready;
    } catch (err) {
      console.warn('Font wait failed:', err);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
}

async function createPdfBlobFromHtml(htmlContent, options = {}) {
  const fileName = sanitizeFileName(options.fileName || 'document.pdf');
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = '210mm';
  wrapper.style.minHeight = '297mm';
  wrapper.style.padding = '24px';
  wrapper.style.background = '#fff';
  wrapper.style.zIndex = '2147483647';
  wrapper.style.visibility = 'visible';
  wrapper.style.opacity = '1';
  wrapper.style.overflow = 'visible';
  wrapper.style.display = 'block';

  const printable = document.createElement('div');
  printable.style.width = '210mm';
  printable.style.maxWidth = '210mm';
  printable.style.margin = '0 auto';
  printable.style.background = '#fff';
  printable.innerHTML = `<style>${PRINT_STYLE}</style><div class="pdf-shell"><div class="pdf-page">${htmlContent}</div></div>`;
  wrapper.appendChild(printable);
  document.body.appendChild(wrapper);
  try {
    await ensureHtml2Pdf();
    await waitForPdfRender(printable);
    const opt = {
      margin: [12, 12, 12, 12],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    const pdf = await new Promise((resolve, reject) => {
      window.html2pdf().set(opt).from(printable).toPdf().output('blob').then(resolve).catch(reject);
    });
    return pdf;
  } finally {
    wrapper.remove();
  }
}

function openPdfBlob(blob, fileName, autoPrint = false) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (autoPrint && win) {
    setTimeout(() => {
      try { win.focus(); win.print(); } catch (err) { console.warn('Print action failed:', err); }
    }, 700);
  }
  return { url, win };
}

async function buildPdfWindow(title, htmlContent, options = {}) {
  const { autoPrint = false, fileName = 'document.pdf' } = options;
  try {
    const blob = await createPdfBlobFromHtml(htmlContent, { fileName });
    openPdfBlob(blob, fileName, autoPrint);
  } catch (err) {
    const htmlBlob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>${PRINT_STYLE}</style></head><body><div class="pdf-shell"><div class="pdf-page">${htmlContent}</div></div></body></html>`], { type: 'text/html' });
    const url = URL.createObjectURL(htmlBlob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 60 * 1000);
  }
}

export function printHtmlPdf(title, htmlContent, options = {}) {
  buildPdfWindow(title, htmlContent, { ...options, autoPrint: options.autoPrint ?? true, fileName: options.fileName || 'document.pdf' });
}

function getDealTemplateLabel(templateName) {
  if (templateName === 'factory') return 'Factory Purchase Order';
  if (templateName === 'admin') return 'Admin Internal Copy';
  return 'Party Invoice';
}

function buildDealPdfHtml(deal, templateName = 'party') {
  const state = getState();
  const d = normalizeDeal(deal);
  const template = String(templateName || 'party').toLowerCase();
  const settings = state.settings || {};
  const companyName = settings.companyName || APP_NAME;
  const invoiceDate = d.date || new Date().toISOString().slice(0, 10);
  const invoiceNo = d.dealNo || `INV-${String(Date.now()).slice(-6)}`;
  const party = state.parties.find((p) => p.id === d.partyId);
  const factory = state.factories.find((f) => f.id === d.factoryId);
  const firstGrade = d.grades?.[0] || {};
  const logoSvg = `<svg width="46" height="46" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="16" fill="#166534"/><path d="M20 18h24v10H20zM20 36h24v10H20z" fill="#fff"/><circle cx="32" cy="32" r="8" fill="#f0fdf4"/></svg>`;

  const rows = d.grades.map((g) => {
    if (template === 'party') {
      return `<tr><td>${escapeHtml(g.grade || '—')}</td><td>${escapeHtml(fmtNum(g.bucket || 0, 2))}</td><td>${escapeHtml(fmtNum(g.kg || 0, 3))}</td><td>${escapeHtml(fmtMoney(g.partyRate || 0))}</td><td>${escapeHtml(fmtMoney(g.saleAmount || 0))}</td></tr>`;
    }
    if (template === 'factory') {
      return `<tr><td>${escapeHtml(g.grade || '—')}</td><td>${escapeHtml(fmtNum(g.bucket || 0, 2))}</td><td>${escapeHtml(fmtNum(g.kg || 0, 3))}</td><td>${escapeHtml(fmtMoney(g.factoryRate || 0))}</td><td>${escapeHtml(fmtMoney(g.purchaseAmount || 0))}</td></tr>`;
    }
    return `<tr><td>${escapeHtml(g.grade || '—')}</td><td>${escapeHtml(fmtNum(g.bucket || 0, 2))}</td><td>${escapeHtml(fmtNum(g.kg || 0, 3))}</td><td>${escapeHtml(fmtMoney(g.partyRate || 0))}</td><td>${escapeHtml(fmtMoney(g.factoryRate || 0))}</td><td>${escapeHtml(fmtMoney(g.commissionPerKg || 0))}</td><td>${escapeHtml(fmtMoney(g.profit || 0))}</td><td>${escapeHtml(fmtMoney(g.saleAmount || 0))}</td></tr>`;
  }).join('');

  const headerTitle = getDealTemplateLabel(template);
  const summaryPills = template === 'party' ? `
    <div class="summary">
      <div class="pill">Invoice Number<strong>${escapeHtml(invoiceNo)}</strong></div>
      <div class="pill">Date<strong>${escapeHtml(fmtDate(invoiceDate))}</strong></div>
      <div class="pill">Deal Number<strong>${escapeHtml(d.dealNo || '—')}</strong></div>
      <div class="pill">Amount<strong>${escapeHtml(fmtMoney(d.totalSale || 0))}</strong></div>
    </div>` : template === 'factory' ? `
    <div class="summary">
      <div class="pill">PO Number<strong>${escapeHtml(invoiceNo)}</strong></div>
      <div class="pill">Date<strong>${escapeHtml(fmtDate(invoiceDate))}</strong></div>
      <div class="pill">Deal Number<strong>${escapeHtml(d.dealNo || '—')}</strong></div>
      <div class="pill">Amount<strong>${escapeHtml(fmtMoney(d.totalPurchase || 0))}</strong></div>
    </div>` : `
    <div class="summary">
      <div class="pill">Invoice Number<strong>${escapeHtml(invoiceNo)}</strong></div>
      <div class="pill">Date<strong>${escapeHtml(fmtDate(invoiceDate))}</strong></div>
      <div class="pill">Deal Number<strong>${escapeHtml(d.dealNo || '—')}</strong></div>
      <div class="pill">Profit<strong>${escapeHtml(fmtMoney(d.totalProfit || 0))}</strong></div>
    </div>`;

  const partyMeta = template === 'party' ? `
    <div class="card">
      <h3>Customer / Selling Info</h3>
      <p><strong>${escapeHtml(party?.name || d.partyName || '—')}</strong></p>
      ${party?.phone ? `<p>Phone: ${escapeHtml(party.phone)}</p>` : ''}
      ${party?.address ? `<p>Address: ${escapeHtml(party.address)}</p>` : ''}
    </div>` : template === 'factory' ? '' : `
    <div class="card">
      <h3>Party Details</h3>
      <p><strong>${escapeHtml(party?.name || d.partyName || '—')}</strong></p>
      ${party?.phone ? `<p>Phone: ${escapeHtml(party.phone)}</p>` : ''}
      ${party?.address ? `<p>Address: ${escapeHtml(party.address)}</p>` : ''}
    </div>`;

  const factoryMeta = template === 'factory' ? `
    <div class="card">
      <h3>Purchase Info</h3>
      <p><strong>${escapeHtml(factory?.name || d.factoryName || '—')}</strong></p>
      ${factory?.phone ? `<p>Phone: ${escapeHtml(factory.phone)}</p>` : ''}
      ${factory?.address ? `<p>Address: ${escapeHtml(factory.address)}</p>` : ''}
    </div>` : template === 'admin' ? `
    <div class="card">
      <h3>Factory Details</h3>
      <p><strong>${escapeHtml(factory?.name || d.factoryName || '—')}</strong></p>
      ${factory?.phone ? `<p>Phone: ${escapeHtml(factory.phone)}</p>` : ''}
      ${factory?.address ? `<p>Address: ${escapeHtml(factory.address)}</p>` : ''}
    </div>` : '';

  const rateSummary = template === 'admin' ? `
    <div class="card">
      <h3>Internal Summary</h3>
      <p>Selling Rate: ${escapeHtml(fmtMoney(firstGrade.partyRate || 0))}</p>
      <p>Factory Rate: ${escapeHtml(fmtMoney(firstGrade.factoryRate || 0))}</p>
      <p>Commission: ${escapeHtml(fmtMoney(d.totalCommission || 0))}</p>
      <p>Profit: ${escapeHtml(fmtMoney(d.totalProfit || 0))}</p>
    </div>` : template === 'party' ? `
    <div class="card">
      <h3>Invoice Summary</h3>
      <p>Bucket: ${escapeHtml(fmtNum(d.totalBucket || 0, 2))}</p>
      <p>Weight (KG): ${escapeHtml(fmtNum(d.totalKg || 0, 3))}</p>
      <p>Rate: ${escapeHtml(fmtMoney(firstGrade.partyRate || 0))}</p>
      <p>Amount: ${escapeHtml(fmtMoney(d.totalSale || 0))}</p>
    </div>` : `
    <div class="card">
      <h3>Purchase Summary</h3>
      <p>Bucket: ${escapeHtml(fmtNum(d.totalBucket || 0, 2))}</p>
      <p>Weight (KG): ${escapeHtml(fmtNum(d.totalKg || 0, 3))}</p>
      <p>Rate: ${escapeHtml(fmtMoney(firstGrade.factoryRate || 0))}</p>
      <p>Amount: ${escapeHtml(fmtMoney(d.totalPurchase || 0))}</p>
    </div>`;

  return `
    <div class="pdf-shell">
      <div class="pdf-page">
        <div class="brand">
          <div class="logo-box">
            <div class="logo-badge">${escapeHtml((companyName || 'MC').slice(0, 2).toUpperCase())}</div>
            <div>
              <div class="meta">Company Logo</div>
              <h1>${escapeHtml(companyName)}</h1>
              <div class="meta">Broker ERP • ${escapeHtml(headerTitle)}</div>
            </div>
          </div>
          <div class="badge">${escapeHtml(template.toUpperCase())}</div>
        </div>

        ${summaryPills}

        <div class="grid">
          ${partyMeta}
          ${factoryMeta}
        </div>

        <div class="grid">
          ${rateSummary}
          <div class="card">
            <h3>Deal Details</h3>
            <p>Deal Number: ${escapeHtml(d.dealNo || '—')}</p>
            <p>Date: ${escapeHtml(fmtDate(invoiceDate))}</p>
            <p>Item Details: ${escapeHtml(d.grades.map((g) => g.grade).filter(Boolean).join(', ') || '—')}</p>
            <p>Quantity: ${escapeHtml(fmtNum(d.totalBucket || 0, 2))}</p>
            <p>Weight: ${escapeHtml(fmtNum(d.totalKg || 0, 3))} KG</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Grade</th>
              <th>Bucket</th>
              <th>KG</th>
              ${template === 'party' ? '<th>Selling Rate</th><th>Amount</th>' : template === 'factory' ? '<th>Purchase Rate</th><th>Amount</th>' : '<th>Selling Rate</th><th>Purchase Rate</th><th>Commission</th><th>Profit</th><th>Amount</th>'}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="note"><strong>Remarks:</strong> ${escapeHtml(d.remarks || 'No remarks captured.')}</div>

        <div class="signature">
          <div class="signature-box"><strong>Signature Area</strong><br />Prepared By</div>
          <div class="signature-box"><strong>Signature Area</strong><br />Authorized Signatory</div>
          <div class="signature-box"><strong>Signature Area</strong><br />Customer / Factory Sign</div>
        </div>

        <div class="footer">
          <div>${escapeHtml(companyName)} • Generated on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
        </div>
      </div>
    </div>`;
}

function renderPreviewPanel(previewPane, deal, templateName, blob, fileName) {
  const html = buildDealPdfHtml(deal, templateName);
  previewPane.innerHTML = `
    <div class="pdf-preview-card">
      <div class="pdf-preview-actions">
        <button type="button" class="btn btn-primary" id="downloadPdfBtn">Download PDF</button>
        <button type="button" class="btn btn-secondary" id="printPdfBtn">Print PDF</button>
      </div>
      <div class="pdf-preview-document">${html}</div>
    </div>`;

  previewPane.querySelector('#downloadPdfBtn')?.addEventListener('click', () => {
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  });

  previewPane.querySelector('#printPdfBtn')?.addEventListener('click', () => {
    const printUrl = URL.createObjectURL(blob);
    const printWindow = window.open(printUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => {
      try { printWindow?.focus(); printWindow?.print(); } catch (err) { console.warn('Print preview failed:', err); }
    }, 700);
    setTimeout(() => URL.revokeObjectURL(printUrl), 2000);
  });
}

export async function renderPdfCenter(container) {
  const state = getState();
  const allDeals = filterDeals({}).map(normalizeDeal);
  const parties = state.parties || [];
  const factories = state.factories || [];
  const grades = [...new Set(allDeals.flatMap((deal) => deal.grades.map((g) => g.grade).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
  let filters = { search: '', dateFrom: '', dateTo: '', partyId: '', factoryId: '', grade: '', dealNo: '' };

  const applyFilters = () => {
    const q = filters.search.toLowerCase();
    const filtered = allDeals.filter((deal) => {
      const matchesSearch = !q || [deal.dealNo, deal.partyName, deal.factoryName, deal.remarks, ...deal.grades.map((g) => g.grade)].join(' ').toLowerCase().includes(q);
      const matchesDateFrom = !filters.dateFrom || deal.date >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || deal.date <= filters.dateTo;
      const matchesParty = !filters.partyId || deal.partyId === filters.partyId;
      const matchesFactory = !filters.factoryId || deal.factoryId === filters.factoryId;
      const matchesGrade = !filters.grade || deal.grades.some((g) => g.grade === filters.grade);
      const matchesDealNo = !filters.dealNo || String(deal.dealNo || '').toLowerCase().includes(filters.dealNo.toLowerCase());
      return matchesSearch && matchesDateFrom && matchesDateTo && matchesParty && matchesFactory && matchesGrade && matchesDealNo;
    });
    renderTable(filtered);
  };

  const renderTable = (deals) => {
    const rows = deals.length ? deals.map((deal) => `
      <tr>
        <td>${escapeHtml(deal.dealNo || '—')}</td>
        <td>${escapeHtml(fmtDate(deal.date))}</td>
        <td>${escapeHtml(deal.partyName || '—')}</td>
        <td>${escapeHtml(deal.factoryName || '—')}</td>
        <td>${escapeHtml(deal.grades.map((g) => g.grade).filter(Boolean).join(', ') || '—')}</td>
        <td>${escapeHtml(fmtNum(deal.totalKg || 0, 3))}</td>
        <td class="pdf-actions-cell">
          <button type="button" class="btn btn-secondary pdf-action-btn" data-template="party" data-deal-id="${deal.id}">Party Invoice</button>
          <button type="button" class="btn btn-secondary pdf-action-btn" data-template="factory" data-deal-id="${deal.id}">Factory Purchase Order</button>
          <button type="button" class="btn btn-secondary pdf-action-btn" data-template="admin" data-deal-id="${deal.id}">Admin Internal Copy</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="7" class="empty">No deals match the selected filters.</td></tr>';

    container.querySelector('#pdfCenterTableBody').innerHTML = rows;
    container.querySelectorAll('[data-template][data-deal-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        const deal = allDeals.find((item) => item.id === button.dataset.dealId);
        if (!deal) return;
        const previewPane = container.querySelector('#pdfCenterPreview');
        previewPane.classList.add('loading');
        previewPane.innerHTML = '<div class="pdf-preview-loading">Generating PDF…</div>';
        try {
          const fileName = `${button.dataset.template}-${(deal.dealNo || 'deal').replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`;
          const blob = await createPdfBlobFromHtml(buildDealPdfHtml(deal, button.dataset.template), { fileName });
          renderPreviewPanel(previewPane, deal, button.dataset.template, blob, fileName);
          openPdfBlob(blob, fileName, false);
        } catch (err) {
          previewPane.classList.remove('loading');
          previewPane.innerHTML = `<div class="pdf-preview-error">PDF generation failed: ${escapeHtml(err.message || 'unknown error')}</div>`;
        }
      });
    });
  };

  container.innerHTML = `
    <section class="pdf-center-shell">
      <div class="pdf-center-header">
        <div>
          <h2>PDF Center</h2>
          <p>Generate party, factory, and admin PDFs directly from saved deals.</p>
        </div>
      </div>
      <div class="pdf-center-filters">
        <input type="search" id="pdfSearch" placeholder="Search deals, party, factory, grade, or deal number" value="${escapeHtml(filters.search)}" />
        <input type="date" id="pdfDateFrom" value="${escapeHtml(filters.dateFrom)}" />
        <input type="date" id="pdfDateTo" value="${escapeHtml(filters.dateTo)}" />
        <select id="pdfPartyFilter">
          <option value="">All Parties</option>
          ${parties.map((party) => `<option value="${party.id}" ${filters.partyId === party.id ? 'selected' : ''}>${escapeHtml(party.name)}</option>`).join('')}
        </select>
        <select id="pdfFactoryFilter">
          <option value="">All Factories</option>
          ${factories.map((factory) => `<option value="${factory.id}" ${filters.factoryId === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`).join('')}
        </select>
        <select id="pdfGradeFilter">
          <option value="">All Grades</option>
          ${grades.map((grade) => `<option value="${grade}" ${filters.grade === grade ? 'selected' : ''}>${escapeHtml(grade)}</option>`).join('')}
        </select>
        <input type="text" id="pdfDealNoFilter" placeholder="Deal number" value="${escapeHtml(filters.dealNo)}" />
      </div>
      <div class="pdf-center-table-wrap">
        <table class="pdf-center-table">
          <thead>
            <tr>
              <th>Deal No</th>
              <th>Date</th>
              <th>Party</th>
              <th>Factory</th>
              <th>Grade</th>
              <th>Weight</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="pdfCenterTableBody"></tbody>
        </table>
      </div>
      <div class="pdf-center-preview" id="pdfCenterPreview">
        <div class="pdf-preview-placeholder">Select a deal to preview and download a professional A4 PDF.</div>
      </div>
    </section>`;

  renderTable(allDeals);

  const bindFilter = (selector, key) => {
    const input = container.querySelector(selector);
    if (!input) return;
    input.addEventListener('input', () => {
      filters[key] = input.value;
      applyFilters();
    });
    input.addEventListener('change', () => {
      filters[key] = input.value;
      applyFilters();
    });
  };

  bindFilter('#pdfSearch', 'search');
  bindFilter('#pdfDateFrom', 'dateFrom');
  bindFilter('#pdfDateTo', 'dateTo');
  bindFilter('#pdfPartyFilter', 'partyId');
  bindFilter('#pdfFactoryFilter', 'factoryId');
  bindFilter('#pdfGradeFilter', 'grade');
  bindFilter('#pdfDealNoFilter', 'dealNo');
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
