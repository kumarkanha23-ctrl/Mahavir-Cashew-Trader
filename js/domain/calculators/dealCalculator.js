import { BUCKET_TO_KG, DEFAULT_COMMISSION_PER_KG } from '../config.js';
import { round, toNumber, bucketsToKg } from '../utils/number.js';

export function calculateDealFields(input, settings = {}) {
  const bucketToKg = settings.bucketToKg ?? BUCKET_TO_KG;
  const defaultCommission = settings.defaultCommissionPerKg ?? DEFAULT_COMMISSION_PER_KG;

  const bucket = toNumber(input.bucket);
  const kg = input.kg != null && input.kg !== ''
    ? toNumber(input.kg)
    : bucketsToKg(bucket, bucketToKg);

  const factoryRate = toNumber(input.factoryRate);
  const commissionPerKg = input.commissionPerKg != null && input.commissionPerKg !== ''
    ? toNumber(input.commissionPerKg)
    : defaultCommission;

  const partyRate = round(factoryRate + commissionPerKg, 2);
  const purchaseAmount = round(kg * factoryRate, 2);
  const saleAmount = round(kg * partyRate, 2);
  const profit = round(kg * commissionPerKg, 2);

  return {
    bucket,
    kg,
    factoryRate,
    commissionPerKg,
    partyRate,
    purchaseAmount,
    saleAmount,
    profit
  };
}

export function recalculateFromKg(input, settings) {
  return calculateDealFields({ ...input, kg: input.kg }, settings);
}

export function recalculateFromBucket(input, settings) {
  return calculateDealFields({ ...input, bucket: input.bucket, kg: undefined }, settings);
}
