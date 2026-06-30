import { getState } from '../../core/state.js';
import { saveSettings } from '../../storage/dataStore.js';
import { setState } from '../../core/state.js';
import { emit, Events } from '../../core/eventBus.js';
import { DEFAULT_SETTINGS } from '../../config.js';

export function getSettings() {
  return { ...getState().settings };
}

export function updateSettings(updates) {
  const settings = { ...getState().settings, ...updates };
  saveSettings(settings);
  setState({ settings });
  emit(Events.DATA_CHANGED);
  return settings;
}

export function resetSettings() {
  return updateSettings({ ...DEFAULT_SETTINGS });
}

export function getWarehouseStock() {
  const { settings, deals } = getState();
  const tradedKg = deals.reduce((a, d) => a + d.kg, 0);
  return {
    warehouseName: settings.warehouseName || 'Main Warehouse',
    openingStockKg: settings.openingStockKg || 0,
    totalTradedKg: tradedKg,
    currentStockKg: settings.openingStockKg || 0
  };
}
