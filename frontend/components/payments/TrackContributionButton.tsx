'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { StreamSaveABI } from '@/lib/contracts/StreamSave';
import { generateNullifierFromAddress } from '@/lib/utils/nullifier';

interface TrackContributionButtonProps {
  groupAddress: string;
  amount: bigint;
}

export function TrackContributionButton({ groupAddress, amount }: TrackContributionButtonProps) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const [customNullifier, setCustomNullifier] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const handleTrack = async () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    // Generate nullifier (MVP: simple derivation from address)
    const nullifier = useCustom && customNullifier
      ? customNullifier as `0x${string}`
      : generateNullifierFromAddress(address);

    console.log('Tracking contribution with nullifier:', nullifier);

    try {
      await writeContract({
        address: groupAddress as `0x${string}`,
        abi: StreamSaveABI,
        functionName: 'trackContribution',
        args: [nullifier, amount]
      });
    } catch (err: any) {
      console.error('Track contribution error:', err);
    }
  };

  return (
    <div className="space-y-2">
      {/* Custom Nullifier Option (Advanced) */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
        <label className="flex items-center text-sm text-gray-700 dark:text-gray-300 mb-2">
          <input
            type="checkbox"
            checked={useCustom}
            onChange={(e) => setUseCustom(e.target.checked)}
            className="mr-2"
          />
          Use custom nullifier (advanced)
        </label>
        {useCustom && (
          <input
            type="text"
            placeholder="0x..."
            value={customNullifier}
            onChange={(e) => setCustomNullifier(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          />
        )}
        {!useCustom && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Using auto-generated nullifier from your wallet address
          </p>
        )}
      </div>

      <button
        onClick={handleTrack}
        disabled={isPending || isConfirming || isSuccess}
        className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
          isSuccess
            ? 'bg-green-500 cursor-not-allowed'
            : isPending || isConfirming
            ? 'bg-gray-400 cursor-wait'
            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg'
        }`}
      >
        {isPending || isConfirming ? (
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
            {isPending ? 'Confirming...' : 'Processing...'}
          </span>
        ) : isSuccess ? (
          '✅ Contribution Tracked'
        ) : (
          '2️⃣ Track Contribution On-Chain'
        )}
      </button>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-400">
            ❌ Error: {error.message}
          </p>
        </div>
      )}

      {hash && !isSuccess && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            ⏳ Transaction submitted...
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-1 font-mono break-all">
            {hash}
          </p>
        </div>
      )}

      {isSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-sm text-green-700 dark:text-green-400">
            ✅ Contribution tracked successfully!
          </p>
          {hash && (
            <a
              href={`https://celoscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 dark:text-green-500 hover:underline mt-1 block"
            >
              View on Celoscan →
            </a>
          )}
          <p className="text-xs text-green-600 dark:text-green-500 mt-2">
            🎉 If all participants have contributed, the winner will be paid automatically!
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Step 2: Record your contribution on the smart contract
      </p>
    </div>
  );
}
