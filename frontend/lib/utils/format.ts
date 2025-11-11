import { formatUnits } from 'viem';

/**
 * Format USDC amount (6 decimals) to human-readable string
 */
export function formatUSDC(amount: bigint | undefined): string {
  if (!amount) return '0.00';
  return formatUnits(amount, 6);
}

/**
 * Format USDC amount with 3 decimals
 */
export function formatUSDC3(amount: bigint | undefined): string {
  if (!amount) return '0.000';
  const fullValue = formatUnits(amount, 6);
  const numValue = parseFloat(fullValue);
  return numValue.toFixed(3);
}

/**
 * Format cycle duration in seconds to human-readable string
 */
export function formatDuration(seconds: bigint | undefined): string {
  if (!seconds) return 'Loading...';
  const s = Number(seconds);

  // Common durations
  if (s === 120) return '2 minutes';
  if (s === 3600) return '1 hour';
  if (s === 86400) return 'Daily';
  if (s === 604800) return 'Weekly';
  if (s === 2592000) return 'Monthly';

  // Calculate custom duration
  const minutes = Math.floor(s / 60);
  const hours = Math.floor(s / 3600);
  const days = Math.floor(s / 86400);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;

  return `${s} seconds`;
}

/**
 * Format address to short form
 */
export function formatAddress(address: string | undefined): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format timestamp to date string
 */
export function formatDate(timestamp: bigint | undefined): string {
  if (!timestamp) return '';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format round number with ordinal suffix
 */
export function formatRound(round: bigint | undefined): string {
  if (round === undefined) return '';
  const n = Number(round);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
