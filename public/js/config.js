export const APP_NAME = 'Mahavir Cashew Trader';
export const APP_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;

export const BUCKET_TO_KG = 10;
export const DEFAULT_COMMISSION_PER_KG = 5;

export const PAYMENT_MODES = ['CASH', 'CHEQUE', 'UPI', 'NEFT', 'RTGS'];
export const PAYMENT_TYPES = { PARTY: 'PARTY', FACTORY: 'FACTORY' };

export const ROUTES = {
  dashboard: '/dashboard',
  rateMaster: '/rate-master',
  newDeal: '/deals/new',
  recentDeals: '/deals/recent',
  partyLedger: '/ledger/party',
  factoryLedger: '/ledger/factory',
  partyPayment: '/payment/party',
  factoryPayment: '/payment/factory',
  reports: '/reports',
  settings: '/settings',
  backup: '/backup'
};

export const DEFAULT_SETTINGS = {
  companyName: APP_NAME,
  defaultCommissionPerKg: DEFAULT_COMMISSION_PER_KG,
  bucketToKg: BUCKET_TO_KG,
  openingStockKg: 0,
  warehouseName: 'Main Warehouse'
};
