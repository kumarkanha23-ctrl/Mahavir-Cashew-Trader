import { mountPage, confirmDialog } from '../components/modal.js';
import { summaryGrid } from '../components/statCard.js';
import { el } from '../../utils/dom.js';
import { todayISO } from '../../utils/date.js';
import { formatDate } from '../../utils/date.js';
import { formatCurrency } from '../../utils/currency.js';
import { PAYMENT_MODES, PAYMENT_TYPES } from '../../config.js';
import { getAllParties } from '../../domain/services/partyService.js';
import { createPayment, getAllPayments, deletePayment, getOutstanding } from '../../domain/services/paymentService.js';
import { exportPaymentsToExcel } from '../../domain/services/exportService.js';
import { showToast } from '../components/toast.js';
import { on, Events } from '../../core/eventBus.js';

let unsubscribe = null;

function buildPaymentForm(onSaved) {
  const parties = getAllParties();
  const form = el('form', { className: 'dealBox' });
  form.innerHTML = `
    <h2>Record Party Payment (Received)</h2>
    <div class="grid grid-4">
      <select name="partyId" required>
        <option value="">-- Select Party --</option>
        ${parties.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
      <input name="date" type="date" value="${todayISO()}" required />
      <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount (₹)" required />
      <select name="mode">${PAYMENT_MODES.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
      <input name="referenceNo" placeholder="Reference / Cheque / UTR" />
      <input name="remarks" placeholder="Remarks" class="grid-span-2" />
      <div class="outstanding-display" id="partyOutstanding">Outstanding: —</div>
    </div>
    <button type="submit" class="btn btn-primary">Save Payment</button>
  `;

  const outstandingEl = form.querySelector('#partyOutstanding');
  form.partyId.addEventListener('change', () => {
    if (form.partyId.value) {
      const out = getOutstanding(PAYMENT_TYPES.PARTY, form.partyId.value);
      outstandingEl.textContent = `Outstanding: ${formatCurrency(out)}`;
    } else {
      outstandingEl.textContent = 'Outstanding: —';
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      createPayment({
        partyId: form.partyId.value,
        date: form.date.value,
        amount: form.amount.value,
        mode: form.mode.value,
        referenceNo: form.referenceNo.value,
        remarks: form.remarks.value
      }, PAYMENT_TYPES.PARTY);
      showToast('Party payment recorded.');
      form.reset();
      form.date.value = todayISO();
      outstandingEl.textContent = 'Outstanding: —';
      onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  return form;
}

function buildHistory(onSaved) {
  const payments = getAllPayments(PAYMENT_TYPES.PARTY);
  const total = payments.reduce((a, p) => a + p.amount, 0);

  const box = el('div', { className: 'tableBox' }, [
    el('h2', { textContent: 'Party Payment History' }),
    el('div', { className: 'action-bar' }, [
      el('button', {
        className: 'btn btn-secondary',
        textContent: 'Export Excel',
        onclick: () => exportPaymentsToExcel(payments, 'party-payments')
      })
    ]),
    el('div', { className: 'tableResponsive' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Date', 'Payment No', 'Party', 'Amount', 'Mode', 'Reference', 'Remarks', 'Actions'].map((h) => el('th', { textContent: h })))]),
        el('tbody', {}, payments.length ? payments.map((p) => el('tr', {}, [
          el('td', { textContent: formatDate(p.date) }),
          el('td', { textContent: p.paymentNo }),
          el('td', { textContent: p.entityName }),
          el('td', { textContent: formatCurrency(p.amount) }),
          el('td', { textContent: p.mode }),
          el('td', { textContent: p.referenceNo || '—' }),
          el('td', { textContent: p.remarks || '—' }),
          el('td', {}, [
            el('button', {
              className: 'deleteBtn',
              textContent: 'Delete',
              onclick: () => confirmDialog('Delete this payment?', () => {
                deletePayment(p.id);
                showToast('Payment deleted.');
                onSaved();
              })
            })
          ])
        ])) : [el('tr', {}, [el('td', { colSpan: '8', textContent: 'No payments recorded.' })])])
      ])
    ])
  ]);

  box._total = total;
  return box;
}

export function renderPartyPaymentPage(container) {
  const content = el('div');
  const refresh = () => {
    content.innerHTML = '';
    const history = buildHistory(refresh);
    content.appendChild(buildPaymentForm(refresh));
    content.appendChild(summaryGrid([
      ['Total Received', formatCurrency(history._total)],
      ['Payment Count', String(getAllPayments(PAYMENT_TYPES.PARTY).length)]
    ]));
    content.appendChild(history);
  };
  refresh();
  mountPage(container, 'Party Payment', content);

  if (unsubscribe) unsubscribe();
  unsubscribe = on(Events.DATA_CHANGED, refresh);
}
