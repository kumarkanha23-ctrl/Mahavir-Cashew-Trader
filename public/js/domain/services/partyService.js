import { generateId } from '../../utils/id.js';
import { timestampISO } from '../../utils/date.js';
import { getState, setState } from '../../core/state.js';
import { saveParties } from '../../storage/dataStore.js';
import { emit, Events } from '../../core/eventBus.js';

function normalizeName(name) {
  return (name || '').trim();
}

export function getAllParties() {
  return [...getState().parties].sort((a, b) => a.name.localeCompare(b.name));
}

export function findOrCreateParty(name) {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('Party name is required.');

  const existing = getState().parties.find(
    (p) => p.name.toLowerCase() === normalized.toLowerCase()
  );
  if (existing) return existing;

  const party = {
    id: generateId('party'),
    name: normalized,
    phone: '',
    address: '',
    createdAt: timestampISO(),
    updatedAt: timestampISO()
  };

  const parties = [...getState().parties, party];
  saveParties(parties);
  setState({ parties });
  emit(Events.DATA_CHANGED);
  return party;
}

export function updateParty(id, data) {
  const parties = getState().parties.map((p) =>
    p.id === id ? { ...p, ...data, name: normalizeName(data.name || p.name), updatedAt: timestampISO() } : p
  );
  saveParties(parties);
  setState({ parties });
  emit(Events.DATA_CHANGED);
  return parties.find((p) => p.id === id);
}

export function deleteParty(id) {
  const { deals, payments } = getState();
  const hasDeals = deals.some((d) => d.partyId === id);
  const hasPayments = payments.some((p) => p.partyId === id);
  if (hasDeals || hasPayments) {
    throw new Error('Cannot delete party with existing deals or payments.');
  }
  const parties = getState().parties.filter((p) => p.id !== id);
  saveParties(parties);
  setState({ parties });
  emit(Events.DATA_CHANGED);
}

export function searchParties(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return getAllParties();
  return getAllParties().filter((p) =>
    p.name.toLowerCase().includes(q) ||
    (p.phone && p.phone.includes(q))
  );
}
