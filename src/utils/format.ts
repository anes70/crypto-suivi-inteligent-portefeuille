export function formatUsd(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';

  if (compact && Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  }

  const abs = Math.abs(value);
  let maxDecimals = 2;
  if (abs > 0 && abs < 0.01) maxDecimals = 6;
  else if (abs > 0 && abs < 1) maxDecimals = 4;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: abs >= 1 || abs === 0 ? 2 : 2,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function formatTokenPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || !Number.isFinite(price)) return 'Non coté';
  if (price === 0) return '$0.00';

  if (price < 0.0001) {
    return `$${price.toFixed(7).replace(/0+$/, '')}`;
  }
  if (price < 1) {
    return `$${price.toFixed(4)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatTokenAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return '0';
  if (amount < 0.0001) return '< 0.0001';
  if (amount < 1) {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }
  if (amount < 10_000) {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  }
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Jamais actualisé';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 5) return "À l'instant";
  if (diffSec < 60) return `Il y a ${diffSec} s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  return `Il y a ${diffHr} h`;
}
