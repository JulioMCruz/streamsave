import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { celo } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'StreamSave',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [celo], // Only Celo Mainnet - testnet doesn't support EIP-3009
  ssr: true,
});
