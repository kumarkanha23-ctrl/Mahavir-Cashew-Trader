export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nextSequence(sequences, key) {
  const current = sequences[key] || 0;
  const next = current + 1;
  sequences[key] = next;
  return next;
}

export function formatDealNo(type, seq) {
  const prefix = type === 'deal' ? 'D' : type === 'payment' ? 'PMT' : 'DOC';
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
