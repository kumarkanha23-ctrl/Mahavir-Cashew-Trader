import { generateId, formatDealNo, nextSequence } from '../../utils/id.js';
import { timestampISO, parseDateInput } from '../../utils/date.js';
import { getState, setState } from '../../core/state.js';
import { savePayments, saveSequences } from '../../storage/dataStore.js';
import { PAYMENT_TYPES } from '../../config.js';
import { emit, Events } from '../../core/eventBus.js';

function validatePayment(input, type) {
  if (!input.date) throw new Error('Payment date is required.');
  const amount = parseFloat(input.amount);
  if (!amount || amount <= 0) throw new Error('Payment amount must be greater than zero.');

  if (type === PAYMENT_TYPES.PARTY) {
    if (!input.partyId) throw new Error('Party is required.');
  } else {
    if (!input.factoryId) throw new Error('Factory is required.');
  }
  return amount;
}

export function getAllPayments(type = null) {
  let payments = [...getState().payments];
  if (type) payments = payments.filter((p) => p.type === type);
  return payments.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function createPayment(input, type) {
  const amount = validatePayment(input, type);
  const { parties, factories } = getState();

  let entityName = '';
  if (type === PAYMENT_TYPES.PARTY) {
    const party = parties.find((p) => p.id === input.partyId);
    if (!party) throw new Error('Party not found.');
    entityName = party.name;
  } else {
    const factory = factories.find((f) => f.id === input.factoryId);
    if (!factory) throw new Error('Factory not found.');
    entityName = factory.name;
  }

  const sequences = { ...getState().sequences };
  const seq = nextSequence(sequences, 'payment');
  saveSequences(sequences);

  const payment = {
    id: generateId('payment'),
    paymentNo: formatDealNo('payment', seq),
    date: parseDateInput(input.date),
    type,
    partyId: type === PAYMENT_TYPES.PARTY ? input.partyId : null,
    factoryId: type === PAYMENT_TYPES.FACTORY ? input.factoryId : null,
    entityName,
    amount,
    mode: input.mode || 'CASH',
    referenceNo: (input.referenceNo || '').trim(),
    remarks: (input.remarks || '').trim(),
    createdAt: timestampISO(),
    updatedAt: timestampISO()
  };

  const allPayments = [...getState().payments, payment];
  savePayments(allPayments);
  setState({ payments: allPayments, sequences });
  emit(Events.PAYMENT_SAVED, { payment });
  emit(Events.DATA_CHANGED);
  return payment;
}

export function deletePayment(id) {
  const payment = getState().payments.find((p) => p.id === id);
  if (!payment) throw new Error('Payment not found.');
  const allPayments = getState().payments.filter((p) => p.id !== id);
  savePayments(allPayments);
  setState({ payments: allPayments });
  emit(Events.PAYMENT_DELETED, { paymentId: id });
  emit(Events.DATA_CHANGED);
}

export function getPaymentHistory(type, entityId) {
  const payments = getAllPayments(type);
  if (!entityId) return payments;
  if (type === PAYMENT_TYPES.PARTY) {
    return payments.filter((p) => p.partyId === entityId);
  }
  return payments.filter((p) => p.factoryId === entityId);
}

export function getOutstanding(type, entityId) {
  const { deals, payments } = getState();
  if (type === PAYMENT_TYPES.PARTY) {
    return computePartyLedger(entityId, deals, payments).outstanding;
  }
  return computeFactoryLedger(entityId, deals, payments).outstanding;
}
