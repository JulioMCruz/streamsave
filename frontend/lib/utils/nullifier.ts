import { keccak256, toBytes } from 'viem';

/**
 * Generate a nullifier hash from a secret string
 * For MVP: users can use any secret phrase
 * Production: should use proper ZK circuit
 */
export function generateNullifier(secret: string): `0x${string}` {
  return keccak256(toBytes(secret));
}

/**
 * Generate nullifier from wallet address (simple MVP approach)
 * Production: use more secure method
 */
export function generateNullifierFromAddress(address: string): `0x${string}` {
  return keccak256(toBytes(address + '-streamsave'));
}

/**
 * Validate nullifier format
 */
export function isValidNullifier(nullifier: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(nullifier);
}
