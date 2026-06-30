import { generateId } from '../../utils/id.js';
import { timestampISO } from '../../utils/date.js';
import { getState, setState } from '../../core/state.js';
import { saveFactories } from '../../storage/dataStore.js';
import { emit, Events } from '../../core/eventBus.js';

function normalizeName(name) {
  return (name || '').trim();
}

export function getAllFactories() {
  return [...getState().factories].sort((a, b) => a.name.localeCompare(b.name));
}

export function findOrCreateFactory(name) {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('Factory name is required.');

  const existing = getState().factories.find(
    (f) => f.name.toLowerCase() === normalized.toLowerCase()
  );
  if (existing) return existing;

  const factory = {
    id: generateId('factory'),
    name: normalized,
    phone: '',
    address: '',
    createdAt: timestampISO(),
    updatedAt: timestampISO()
  };

  const factories = [...getState().factories, factory];
  saveFactories(factories);
  setState({ factories });
  emit(Events.DATA_CHANGED);
  return factory;
}

export function updateFactory(id, data) {
  const factories = getState().factories.map((f) =>
    f.id === id ? { ...f, ...data, name: normalizeName(data.name || f.name), updatedAt: timestampISO() } : f
  );
  saveFactories(factories);
  setState({ factories });
  emit(Events.DATA_CHANGED);
  return factories.find((f) => f.id === id);
}

export function deleteFactory(id) {
  const { deals, payments } = getState();
  const hasDeals = deals.some((d) => d.factoryId === id);
  const hasPayments = payments.some((p) => p.factoryId === id);
  if (hasDeals || hasPayments) {
    throw new Error('Cannot delete factory with existing deals or payments.');
  }
  const factories = getState().factories.filter((f) => f.id !== id);
  saveFactories(factories);
  setState({ factories });
  emit(Events.DATA_CHANGED);
}

export function searchFactories(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return getAllFactories();
  return getAllFactories().filter((f) =>
    f.name.toLowerCase().includes(q) ||
    (f.phone && f.phone.includes(q))
  );
}
