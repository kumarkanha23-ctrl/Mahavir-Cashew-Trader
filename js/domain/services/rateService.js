import { generateId } from '../../utils/id.js';
import { timestampISO } from '../../utils/date.js';
import { round } from '../../utils/number.js';
import { getState, setState } from '../../core/state.js';
import { saveRates } from '../../storage/dataStore.js';
import { calculateDealFields } from '../calculators/dealCalculator.js';
import { emit, Events } from '../../core/eventBus.js';

export function getAllRates() {
  return [...getState().rates].sort((a, b) => a.grade.localeCompare(b.grade));
}

export function upsertRate(input) {
  const grade = (input.grade || '').trim();
  if (!grade) throw new Error('Grade is required.');

  const settings = getState().settings;
  const calc = calculateDealFields(
    {
      bucket: 1,
      factoryRate: input.factoryRate,
      commissionPerKg: input.commissionPerKg
    },
    settings
  );

  const existing = getState().rates.find(
    (r) => r.grade.toLowerCase() === grade.toLowerCase()
  );

  const rate = {
    id: existing?.id || generateId('rate'),
    grade,
    factoryRate: round(calc.factoryRate, 2),
    commissionPerKg: round(calc.commissionPerKg, 2),
    partyRate: calc.partyRate,
    updatedAt: timestampISO()
  };

  const rates = existing
    ? getState().rates.map((r) => (r.id === existing.id ? rate : r))
    : [...getState().rates, rate];

  saveRates(rates);
  setState({ rates });
  emit(Events.DATA_CHANGED);
  return rate;
}

export function deleteRate(id) {
  const rates = getState().rates.filter((r) => r.id !== id);
  saveRates(rates);
  setState({ rates });
  emit(Events.DATA_CHANGED);
}

export function getRateForGrade(grade) {
  const normalized = (grade || '').trim().toLowerCase();
  return getState().rates.find((r) => r.grade.toLowerCase() === normalized) || null;
}
