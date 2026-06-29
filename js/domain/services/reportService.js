import { getState } from '../../core/state.js';
import {
  computePartyLedger,
  computeFactoryLedger,
  computeAllPartyOutstanding,
  computeAllFactoryOutstanding,
  buildLedgerRows
} from '../calculators/ledgerCalculator.js';
import { computeDashboardMetrics } from '../calculators/dashboardCalculator.js';
import { filterDeals } from './dealService.js';
import { getAllPayments } from './paymentService.js';
import { PAYMENT_TYPES } from '../../config.js';

export function getPartyLedgerReport(partyId) {
  const { deals, payments, parties } = getState();
  const party = parties.find((p) => p.id === partyId);
  if (!party) throw new Error('Party not found.');

  const ledger = computePartyLedger(partyId, deals, payments);
  const rows = buildLedgerRows(ledger.deals, ledger.payments, 'PARTY');

  return {
    title: `Party Ledger — ${party.name}`,
    entity: party,
    type: 'PARTY',
    ...ledger,
    rows
  };
}

export function getFactoryLedgerReport(factoryId) {
  const { deals, payments, factories } = getState();
  const factory = factories.find((f) => f.id === factoryId);
  if (!factory) throw new Error('Factory not found.');

  const ledger = computeFactoryLedger(factoryId, deals, payments);
  const rows = buildLedgerRows(ledger.deals, ledger.payments, 'FACTORY');

  return {
    title: `Factory Ledger — ${factory.name}`,
    entity: factory,
    type: 'FACTORY',
    ...ledger,
    rows
  };
}

export function getDashboardReport() {
  const { deals, payments, parties, factories } = getState();
  return computeDashboardMetrics(deals, payments, parties, factories);
}

export function getOutstandingReport() {
  const { deals, payments, parties, factories } = getState();
  return {
    parties: computeAllPartyOutstanding(parties, deals, payments).filter((p) => p.outstanding > 0),
    factories: computeAllFactoryOutstanding(factories, deals, payments).filter((f) => f.outstanding > 0)
  };
}

export function getDealRegisterReport(filters = {}) {
  const deals = filterDeals(filters);
  return {
    title: 'Deal Register',
    deals,
    totals: {
      kg: deals.reduce((a, d) => a + d.kg, 0),
      purchase: deals.reduce((a, d) => a + d.purchaseAmount, 0),
      sale: deals.reduce((a, d) => a + d.saleAmount, 0),
      profit: deals.reduce((a, d) => a + d.profit, 0)
    }
  };
}

export function getPaymentRegisterReport(type, filters = {}) {
  let payments = getAllPayments(type);
  if (filters.dateFrom) payments = payments.filter((p) => p.date >= filters.dateFrom);
  if (filters.dateTo) payments = payments.filter((p) => p.date <= filters.dateTo);
  if (filters.entityId) {
    payments = type === PAYMENT_TYPES.PARTY
      ? payments.filter((p) => p.partyId === filters.entityId)
      : payments.filter((p) => p.factoryId === filters.entityId);
  }
  return {
    title: type === PAYMENT_TYPES.PARTY ? 'Party Payment Register' : 'Factory Payment Register',
    payments,
    total: payments.reduce((a, p) => a + p.amount, 0)
  };
}

export function getProfitReport(filters = {}) {
  const report = getDealRegisterReport(filters);
  return {
    title: 'Profit Report',
    ...report
  };
}
