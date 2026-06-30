import { generateId, formatDealNo, nextSequence } from '../../utils/id.js';
import { timestampISO, parseDateInput } from '../../utils/date.js';
import { getState, setState } from '../../core/state.js';
import { saveDeals, saveSequences } from '../../storage/dataStore.js';
import { calculateDealFields } from '../calculators/dealCalculator.js';
import { findOrCreateParty } from './partyService.js';
import { findOrCreateFactory } from './factoryService.js';
import { emit, Events } from '../../core/eventBus.js';

function validateDealInput(input) {
  if (!input.partyName?.trim()) throw new Error('Party name is required.');
  if (!input.factoryName?.trim()) throw new Error('Factory name is required.');
  if (!input.grade?.trim()) throw new Error('Grade is required.');
  if (!input.date) throw new Error('Date is required.');
  const calc = calculateDealFields(input, getState().settings);
  if (calc.kg <= 0) throw new Error('KG must be greater than zero.');
  if (calc.factoryRate < 0) throw new Error('Factory rate cannot be negative.');
  return calc;
}

export function getAllDeals() {
  return [...getState().deals].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function getDealById(id) {
  return getState().deals.find((d) => d.id === id) || null;
}

export function createDeal(input) {
  const calc = validateDealInput(input);
  const party = findOrCreateParty(input.partyName);
  const factory = findOrCreateFactory(input.factoryName);

  const sequences = { ...getState().sequences };
  const seq = nextSequence(sequences, 'deal');
  saveSequences(sequences);

  const deal = {
    id: generateId('deal'),
    dealNo: formatDealNo('deal', seq),
    date: parseDateInput(input.date),
    partyId: party.id,
    partyName: party.name,
    factoryId: factory.id,
    factoryName: factory.name,
    grade: input.grade.trim(),
    bucket: calc.bucket,
    kg: calc.kg,
    factoryRate: calc.factoryRate,
    commissionPerKg: calc.commissionPerKg,
    partyRate: calc.partyRate,
    purchaseAmount: calc.purchaseAmount,
    saleAmount: calc.saleAmount,
    profit: calc.profit,
    remarks: (input.remarks || '').trim(),
    createdAt: timestampISO(),
    updatedAt: timestampISO()
  };

  const deals = [...getState().deals, deal];
  saveDeals(deals);
  setState({ deals, sequences });
  emit(Events.DEAL_SAVED, { deal });
  emit(Events.DATA_CHANGED);
  return deal;
}

export function updateDeal(id, input) {
  const existing = getDealById(id);
  if (!existing) throw new Error('Deal not found.');

  const calc = validateDealInput(input);
  const party = findOrCreateParty(input.partyName);
  const factory = findOrCreateFactory(input.factoryName);

  const deal = {
    ...existing,
    date: parseDateInput(input.date),
    partyId: party.id,
    partyName: party.name,
    factoryId: factory.id,
    factoryName: factory.name,
    grade: input.grade.trim(),
    bucket: calc.bucket,
    kg: calc.kg,
    factoryRate: calc.factoryRate,
    commissionPerKg: calc.commissionPerKg,
    partyRate: calc.partyRate,
    purchaseAmount: calc.purchaseAmount,
    saleAmount: calc.saleAmount,
    profit: calc.profit,
    remarks: (input.remarks || '').trim(),
    updatedAt: timestampISO()
  };

  const deals = getState().deals.map((d) => (d.id === id ? deal : d));
  saveDeals(deals);
  setState({ deals });
  emit(Events.DEAL_SAVED, { deal });
  emit(Events.DATA_CHANGED);
  return deal;
}

export function deleteDeal(id) {
  const deal = getDealById(id);
  if (!deal) throw new Error('Deal not found.');
  const deals = getState().deals.filter((d) => d.id !== id);
  saveDeals(deals);
  setState({ deals });
  emit(Events.DEAL_DELETED, { dealId: id });
  emit(Events.DATA_CHANGED);
}

export function filterDeals(filters = {}) {
  let deals = getAllDeals();
  const { search, dateFrom, dateTo, partyId, factoryId, grade } = filters;

  if (search) {
    const q = search.toLowerCase();
    deals = deals.filter((d) =>
      d.dealNo.toLowerCase().includes(q) ||
      d.partyName.toLowerCase().includes(q) ||
      d.factoryName.toLowerCase().includes(q) ||
      d.grade.toLowerCase().includes(q) ||
      (d.remarks && d.remarks.toLowerCase().includes(q))
    );
  }
  if (dateFrom) deals = deals.filter((d) => d.date >= dateFrom);
  if (dateTo) deals = deals.filter((d) => d.date <= dateTo);
  if (partyId) deals = deals.filter((d) => d.partyId === partyId);
  if (factoryId) deals = deals.filter((d) => d.factoryId === factoryId);
  if (grade) deals = deals.filter((d) => d.grade.toLowerCase() === grade.toLowerCase());

  return deals;
}

export function previewDeal(input) {
  return calculateDealFields(input, getState().settings);
}
