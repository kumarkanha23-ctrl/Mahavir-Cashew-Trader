export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function toNumber(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function bucketsToKg(buckets, bucketToKg = 10) {
  return round(toNumber(buckets) * bucketToKg, 3);
}
