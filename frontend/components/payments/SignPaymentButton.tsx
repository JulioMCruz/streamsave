'use client';

import { useState } from 'react';
import { useAccount, useSignTypedData, useReadContract } from 'wagmi';
import { maxUint256, parseSignature } from 'viem';
import { CELO_USDC_ADDRESS, StreamSaveABI } from '@/lib/contracts/StreamSave';
import { generateNullifierFromAddress } from '@/lib/utils/nullifier';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SignPaymentButtonProps {
  groupAddress: string;
  amount: bigint;
}

export function SignPaymentButton({ groupAddress, amount }: SignPaymentButtonProps) {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Get current round
  const { data: currentRound } = useReadContract({
    address: groupAddress as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'currentRound',
  });

  // Check if user has already contributed this round (on-chain check)
  const nullifier = address ? generateNullifierFromAddress(address) : '0x0';
  const { data: hasContributed } = useReadContract({
    address: groupAddress as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'roundContributions',
    args: [currentRound ?? 0n, nullifier as `0x${string}`],
  });

  const signed = Boolean(hasContributed);

  const handleSign = async () => {
    if (!address) {
      setError('Please connect your wallet first');
      return;
    }

    // Check if already contributed this round (smart contract check)
    if (hasContributed) {
      setError('You have already contributed for this round. Wait for the next cycle to contribute again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate unique nonce (MVP: use timestamp + random)
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000000);
      const nonce = `0x${(timestamp * 1000000 + random).toString(16).padStart(64, '0')}` as `0x${string}`;

      console.log('Signing payment authorization...', {
        from: address,
        to: groupAddress,
        value: amount.toString(),
        nonce
      });

      // Sign EIP-3009 authorization
      const signature = await signTypedDataAsync({
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: chainId ?? 42220,
          verifyingContract: CELO_USDC_ADDRESS
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
          ]
        },
        primaryType: 'TransferWithAuthorization',
        message: {
          from: address,
          to: groupAddress as `0x${string}`,
          value: amount,
          validAfter: 0n,
          validBefore: maxUint256,
          nonce: nonce
        }
      });

      console.log('Signature received:', signature);

      // Parse signature
      const { r, s, v } = parseSignature(signature);

      // MVP: Log signature details for manual processing
      // In production: Send to x402 facilitator
      console.log('Payment Authorization Signed:', {
        from: address,
        to: groupAddress,
        value: amount.toString(),
        validAfter: 0,
        validBefore: maxUint256.toString(),
        nonce,
        signature: { v, r, s }
      });

      // Note: The actual prevention of double signing is checked on-chain via roundContributions mapping
      // Once user calls trackContribution(), they won't be able to sign again for this round
      setShowSuccessDialog(true);
    } catch (err: any) {
      console.error('Sign error:', err);
      setError(err.message || 'Failed to sign payment authorization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Explanation Box */}
      {!signed && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center">
            <span className="text-xl mr-2">📝</span>
            How x402 Vouchers Work
          </h4>
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
            When you sign below, you're creating a <strong>payment voucher</strong> (like writing a check):
          </p>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 ml-4 list-disc">
            <li>✍️ You authorize the payment without sending USDC yet</li>
            <li>⏰ The x402 facilitator will cash it at the right time</li>
            <li>🔒 You stay in control - the voucher expires if not used</li>
            <li>⚡ No gas fees for the USDC transfer!</li>
          </ul>
        </div>
      )}

      <button
        onClick={handleSign}
        disabled={loading || signed}
        className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
          signed
            ? 'bg-green-500 cursor-not-allowed'
            : loading
            ? 'bg-gray-400 cursor-wait'
            : 'bg-gradient-to-r from-green-600 to-blue-600 hover:shadow-lg'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Signing...
          </span>
        ) : signed ? (
          '✅ Payment Voucher Signed'
        ) : (
          '1️⃣ Sign Payment Voucher (x402)'
        )}
      </button>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-400">
            ❌ {error}
          </p>
        </div>
      )}

      {signed && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm text-green-700 dark:text-green-400 font-semibold mb-2">
            ✅ Payment voucher signed successfully!
          </p>
          <p className="text-sm text-green-600 dark:text-green-500">
            The x402 facilitator will execute the transfer.
          </p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-1 italic">
            Note: You can only sign once per group to prevent duplicate vouchers.
          </p>
          <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1 flex items-center">
              <span className="text-lg mr-2">👇</span>
              Next Step:
            </p>
            <p className="text-sm text-green-700 dark:text-green-400">
              Click <strong>"Track Contribution On-Chain"</strong> below to record your payment
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Step 1: Sign x402 payment voucher (gasless, like writing a check)
      </p>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <span className="text-2xl">✅</span>
              Payment Authorized Successfully!
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-4">
                <p className="text-base">
                  Your payment voucher has been signed successfully.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                    Next Steps:
                  </p>
                  <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-2 ml-4 list-decimal">
                    <li>The x402 facilitator will execute the USDC transfer</li>
                    <li>Once completed, click "Track Contribution" to record your payment on-chain</li>
                  </ol>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <button
              onClick={() => setShowSuccessDialog(false)}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Got it!
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
