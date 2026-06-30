const listeners = new Map();

export const Events = {
  ROUTE_CHANGED: 'ROUTE_CHANGED',
  DATA_CHANGED: 'DATA_CHANGED',
  TOAST: 'TOAST',
  DEAL_SAVED: 'DEAL_SAVED',
  DEAL_DELETED: 'DEAL_DELETED',
  PAYMENT_SAVED: 'PAYMENT_SAVED',
  PAYMENT_DELETED: 'PAYMENT_DELETED'
};

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((handler) => {
    try {
      handler(payload);
    } catch (err) {
      console.error(`Event handler error [${event}]:`, err);
    }
  });
}
