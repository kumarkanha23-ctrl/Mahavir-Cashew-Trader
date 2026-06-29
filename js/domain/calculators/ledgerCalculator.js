import { round } from '../../utils/number.js';

export function sumBy(items, selector) {
  return round(items.reduce((acc, item) => acc + selector(item), 0), 2);
}

export function computePartyLedger(partyId, deals, payments) {
  const partyDeals = deals.filter((d) => d.partyId === partyId);
  const partyPayments = payments.filter((p) => p.type === 'PARTY' && p.partyId === partyId);

  const totalKg = round(partyDeals.reduce((a, d) => a + d.kg, 0), 3);
  const totalSale = sumBy(partyDeals, (d) => d.saleAmount);
  const totalPaid = sumBy(partyPayments, (p) => p.amount);
  const outstanding = round(totalSale - totalPaid, 2);
  const balance = outstanding;

  return {
    deals: partyDeals.sort((a, b) => b.date.localeCompare(a.date)),
    payments: partyPayments.sort((a, b) => b.date.localeCompare(a.date)),
    totalKg,
    totalSale,
    totalPaid,
    outstanding,
    balance
  };
}

export function computeFactoryLedger(factoryId, deals, payments) {
  const factoryDeals = deals.filter((d) => d.factoryId === factoryId);
  const factoryPayments = payments.filter((p) => p.type === 'FACTORY' && p.factoryId === factoryId);

  const totalKg = round(factoryDeals.reduce((a, d) => a + d.kg, 0), 3);
  const totalPurchase = sumBy(factoryDeals, (d) => d.purchaseAmount);
  const totalPaid = sumBy(factoryPayments, (p) => p.amount);
  const outstanding = round(totalPurchase - totalPaid, 2);
  const balance = outstanding;

  return {
    deals: factoryDeals.sort((a, b) => b.date.localeCompare(a.date)),
    payments: factoryPayments.sort((a, b) => b.date.localeCompare(a.date)),
    totalKg,
    totalPurchase,
    totalPaid,
    outstanding,
    balance
  };
}

export function computeAllPartyOutstanding(parties, deals, payments) {
  return parties.map((party) => {
    const ledger = computePartyLedger(party.id, deals, payments);
    return { ...party, ...ledger };
  });
}

export function computeAllFactoryOutstanding(factories, deals, payments) {
  return factories.map((factory) => {
    const ledger = computeFactoryLedger(factory.id, deals, payments);
    return { ...factory, ...ledger };
  });
}

export function buildLedgerRows(deals, payments, type) {
  const rows = [];

  deals.forEach((deal) => {
    rows.push({
      date: deal.date,
      sortKey: `${deal.date}_${deal.createdAt}`,
      type: 'DEAL',
      reference: deal.dealNo,
      description: type === 'PARTY'
        ? `Sale — ${deal.grade} — ${deal.kg} KG`
        : `Purchase — ${deal.grade} — ${deal.kg} KG`,
      kg: deal.kg,
      debit: type === 'PARTY' ? deal.saleAmount : 0,
      credit: type === 'FACTORY' ? deal.purchaseAmount : 0,
      sourceId: deal.id
    });
  });

  payments.forEach((payment) => {
    rows.push({
      date: payment.date,
      sortKey: `${payment.date}_${payment.createdAt}`,
      type: 'PAYMENT',
      reference: payment.paymentNo,
      description: `Payment — ${payment.mode}${payment.remarks ? ' — ' + payment.remarks : ''}`,
      kg: null,
      debit: type === 'FACTORY' ? payment.amount : 0,
      credit: type === 'PARTY' ? payment.amount : 0,
      sourceId: payment.id
    });
  });

  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let running = 0;
  return rows.map((row) => {
    if (type === 'PARTY') {
      running = round(running + row.debit - row.credit, 2);
    } else {
      running = round(running + row.credit - row.debit, 2);
    }
    return { ...row, balance: running };
  });
}
