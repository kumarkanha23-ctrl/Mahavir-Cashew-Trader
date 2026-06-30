import { round } from '../../utils/number.js';
import { sumBy, computeAllPartyOutstanding, computeAllFactoryOutstanding } from './ledgerCalculator.js';

export function computeDashboardMetrics(deals, payments, parties, factories) {
  const totalDeals = deals.length;
  const totalKg = round(deals.reduce((a, d) => a + d.kg, 0), 3);
  const totalPurchase = sumBy(deals, (d) => d.purchaseAmount);
  const totalSale = sumBy(deals, (d) => d.saleAmount);
  const totalProfit = sumBy(deals, (d) => d.profit);
  const totalCommission = totalProfit;

  const partyOutstanding = computeAllPartyOutstanding(parties, deals, payments)
    .reduce((a, p) => a + p.outstanding, 0);

  const factoryOutstanding = computeAllFactoryOutstanding(factories, deals, payments)
    .reduce((a, f) => a + f.outstanding, 0);

  return {
    totalDeals,
    totalKg,
    totalPurchase,
    totalSale,
    totalProfit,
    totalCommission,
    outstandingParty: round(partyOutstanding, 2),
    outstandingFactory: round(factoryOutstanding, 2)
  };
}
