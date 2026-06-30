let cache = {
  settings: null,
  parties: [],
  factories: [],
  deals: [],
  payments: [],
  rates: [],
  sequences: {}
};

export function getState() {
  return cache;
}

export function setState(partial) {
  cache = { ...cache, ...partial };
}

export function resetState() {
  cache = {
    settings: null,
    parties: [],
    factories: [],
    deals: [],
    payments: [],
    rates: [],
    sequences: {}
  };
}

export function getPartyById(id) {
  return cache.parties.find((p) => p.id === id) || null;
}

export function getFactoryById(id) {
  return cache.factories.find((f) => f.id === id) || null;
}

export function getDealsByPartyId(partyId) {
  return cache.deals.filter((d) => d.partyId === partyId);
}

export function getDealsByFactoryId(factoryId) {
  return cache.deals.filter((d) => d.factoryId === factoryId);
}

export function getPaymentsByPartyId(partyId) {
  return cache.payments.filter((p) => p.type === 'PARTY' && p.partyId === partyId);
}

export function getPaymentsByFactoryId(factoryId) {
  return cache.payments.filter((p) => p.type === 'FACTORY' && p.factoryId === factoryId);
}

export function getRateByGrade(grade) {
  const normalized = (grade || '').trim().toLowerCase();
  return cache.rates.find((r) => r.grade.trim().toLowerCase() === normalized) || null;
}
