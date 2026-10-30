const nf = new Intl.NumberFormat('tr-TR');

export function formatNumber(n) {
  return nf.format(Math.floor(n));
}

export function formatCompact(n) {
  n = Math.floor(n);
  if (n < 10000) return nf.format(n);
  if (n < 1e6) return `${(n / 1000).toFixed(n < 1e5 ? 1 : 0).replace('.', ',')}B`;
  return `${(n / 1e6).toFixed(1).replace('.', ',')}M`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s} sn`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m} dk ${r} sn` : `${m} dk`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} sa ${rm} dk` : `${h} sa`;
}
