import { DEFAULT_SETTINGS } from '../config.js';
import { KEYS } from './storageKeys.js';
import { getItem, setItem } from './storageAdapter.js';

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...getItem(KEYS.SETTINGS, DEFAULT_SETTINGS) };
}

export function saveSettings(settings) {
  setItem(KEYS.SETTINGS, settings);
  return settings;
}

export function loadSequences() {
  return getItem(KEYS.SEQUENCES, { deal: 0, payment: 0 });
}

export function saveSequences(sequences) {
  setItem(KEYS.SEQUENCES, sequences);
  return sequences;
}

export function loadParties() {
  return getItem(KEYS.PARTIES, []);
}

export function saveParties(parties) {
  setItem(KEYS.PARTIES, parties);
  return parties;
}

export function loadFactories() {
  return getItem(KEYS.FACTORIES, []);
}

export function saveFactories(factories) {
  setItem(KEYS.FACTORIES, factories);
  return factories;
}

export function loadDeals() {
  return getItem(KEYS.DEALS, []);
}

export function saveDeals(deals) {
  setItem(KEYS.DEALS, deals);
  return deals;
}

export function loadPayments() {
  return getItem(KEYS.PAYMENTS, []);
}

export function savePayments(payments) {
  setItem(KEYS.PAYMENTS, payments);
  return payments;
}

export function loadRates() {
  return getItem(KEYS.RATES, []);
}

export function saveRates(rates) {
  setItem(KEYS.RATES, rates);
  return rates;
}

export function loadAll() {
  return {
    settings: loadSettings(),
    sequences: loadSequences(),
    parties: loadParties(),
    factories: loadFactories(),
    deals: loadDeals(),
    payments: loadPayments(),
    rates: loadRates()
  };
}
