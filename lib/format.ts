export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMarketPrice(value?: number | null) {
  return value === null || value === undefined ? "Unavailable" : formatCurrency(value);
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}
