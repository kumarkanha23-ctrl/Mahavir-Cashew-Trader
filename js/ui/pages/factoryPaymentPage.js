import { mountPage, confirmDialog } from '../components/modal.js';
import { summaryGrid } from '../components/statCard.js';
import { el } from '../../utils/dom.js';
import { todayISO } from '../../utils/date.js';
import { formatDate } from '../../utils/date.js';
import { formatCurrency } from '../../utils/currency.js';
import { PAYMENT_MODES, PAYMENT_TYPES } from '../../config.js';
import { getAllFactories } from '../../domain/services/factoryService.js';
import { createPayment, getAllPayments, deletePayment, getOutstanding } from '../../domain/services/paymentService.js';
import { exportPaymentsToExcel } from '../../domain/services/exportService.js';
import { showToast } from '../components/toast.js';
import { on, Events } from '../../core/eventBus.js';

let unsubscribe = null;

function buildPaymentForm(onSaved) {
  const factories = getAllFactories();
  const form = el('form', { className: 'dealBox' });
  form.innerHTML = `
    <h2>Record Factory Payment (Paid)</h2>
    <div class="grid grid-4">
      <select name="factoryId" required>
        <option value="">-- Select Factory --</option>
        ${factories.map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}
      </select>
      <input name="date" type="date" value="${todayISO()}" required />
      <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount (₹)" required />
      <select name="mode">${PAYMENT_MODES.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
      <input name="referenceNo" placeholder="Reference / Cheque / UTR" />
      <input name="remarks" placeholder="Remarks" class="grid-span-2" />
      <div class="outstanding-display" id="factoryOutstanding">Outstanding: —</div>
    </div>
    <button type="submit" class="btn btn-primary">Save Payment</button>
  `;

  const outstandingEl = form.querySelector('#factoryOutstanding');
  form.factoryId.addEventListener('change', () => {
    if (form.factoryId.value) {
      const out = getOutstanding(PAYMENT_TYPES.FACTORY, form.factoryId.value);
      outstandingEl.textContent = `Outstanding: ${formatCurrency(out)}`;
    } else {
      outstandingEl.textContent = 'Outstanding: —';
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      createPayment({
        factoryId: form.factoryId.value,
        date: form.date.value,
        amount: form.amount.value,
        mode: form.mode.value,
        referenceNo: form.referenceNo.value,
        remarks: form.remarks.value
      }, PAYMENT_TYPES.FACTORY);
      showToast('Factory payment recorded.');
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
  const payments = getAllPayments(PAYMENT_TYPES.FACTORY);
  const total = payments.reduce((a, p) => a + p.amount, 0);

  const box = el('div', { className: 'tableBox' }, [
    el('h2', { textContent: 'Factory Payment History' }),
    el('div', { className: 'action-bar' }, [
      el('button', {
        className: 'btn btn-secondary',
        textContent: 'Export Excel',
        onclick: () => exportPaymentsToExcel(payments, 'factory-payments')
      })
    ]),
    el('div', { className: 'tableResponsive' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Date', 'Payment No', 'Factory', 'Amount', 'Mode', 'Reference', 'Remarks', 'Actions'].map((h) => el('th', { textContent: h })))]),
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

export function renderFactoryPaymentPage(container) {
  const content = el('div');
  const refresh = () => {
    content.innerHTML = '';
    const history = buildHistory(refresh);
    content.appendChild(buildPaymentForm(refresh));
    content.appendChild(summaryGrid([
      ['Total Paid', formatCurrency(history._total)],
      ['Payment Count', String(getAllPayments(PAYMENT_TYPES.FACTORY).length)]
    ]));
    content.appendChild(history);
  };
  refresh();
  mountPage(container, 'Factory Payment', content);

  if (unsubscribe) unsubscribe();
  unsubscribe = on(Events.DATA_CHANGED, refresh);
}
