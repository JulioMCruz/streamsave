'use client';

import { useParams } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { StreamSaveABI, CELO_USDC_ADDRESS } from '@/lib/contracts/StreamSave';
import { formatUSDC, formatDuration, formatAddress, formatDate } from '@/lib/utils/format';
import { SignPaymentButton } from '@/components/payments/SignPaymentButton';
import { TrackContributionButton } from '@/components/payments/TrackContributionButton';
import { usePayoutEvents } from '@/lib/hooks/usePayoutEvents';

export default function GroupDetail() {
  const params = useParams();
  const address = params?.address as string;
  const { address: userAddress, isConnected } = useAccount();

  // Read contract state
  const { data: token } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'token',
  });

  const { data: contributionAmount } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'contributionAmount',
  });

  const { data: totalParticipants } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'totalParticipants',
  });

  const { data: currentRound } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'currentRound',
  });

  const { data: participantCount } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'participantCount',
  });

  const { data: cycleDuration } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'cycleDuration',
  });

  const { data: isActive } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'isActive',
  });

  const { data: totalContributed } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'totalContributed',
  });

  const { data: lastPayoutTime } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'lastPayoutTime',
  });

  const { data: createdAt } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'createdAt',
  });

  const { data: roundContributionCount } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'roundContributionCount',
    args: [currentRound ?? 0n],
  });

  // Monitor payout events
  usePayoutEvents(address);

  // Calculate pool size
  const poolSize = contributionAmount && totalParticipants
    ? contributionAmount * totalParticipants
    : 0n;

  // Calculate progress
  const progress = totalParticipants && roundContributionCount
    ? (Number(roundContributionCount) / Number(totalParticipants)) * 100
    : 0;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Connect Your Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Please connect your wallet to view group details
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <ConnectButton />
        </header>

        {/* Main Content */}
        <main>
          {/* Group Header */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                  StreamSave Group
                </h1>
                <p className="text-gray-600 dark:text-gray-400 font-mono text-sm">
                  {address}
                </p>
              </div>
              <span
                className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {isActive ? '🟢 Active' : '⚫ Inactive'}
              </span>
            </div>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Contribution Amount
                </p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {formatUSDC(contributionAmount)} USDC
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Pool Size
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatUSDC(poolSize)} USDC
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Cycle Duration
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatDuration(cycleDuration)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Current Round
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {currentRound?.toString() ?? '0'} / {totalParticipants?.toString() ?? '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column - Round Progress */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                Round {currentRound?.toString() ?? '0'} Progress
              </h2>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>Contributions</span>
                  <span>
                    {roundContributionCount?.toString() ?? '0'} / {totalParticipants?.toString() ?? '0'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold"
                    style={{ width: `${Math.max(progress, 10)}%` }}
                  >
                    {progress > 15 && `${Math.round(progress)}%`}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {progress === 100
                    ? '🎉 All participants have contributed! Winner will be paid automatically.'
                    : `Waiting for ${Number(totalParticipants ?? 0n) - Number(roundContributionCount ?? 0n)} more contribution(s)`}
                </p>
              </div>

              {/* Payment Actions */}
              <div className="space-y-4">
                <SignPaymentButton
                  groupAddress={address}
                  amount={contributionAmount ?? 0n}
                />
                <TrackContributionButton
                  groupAddress={address}
                  amount={contributionAmount ?? 0n}
                />
              </div>
            </div>

            {/* Right Column - Group Info */}
            <div className="space-y-6">
              {/* Participants */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                  Participants
                </h2>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">
                    Joined
                  </span>
                  <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    {participantCount?.toString() ?? '0'} / {totalParticipants?.toString() ?? '0'}
                  </span>
                </div>
              </div>

              {/* Group Details */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                  Group Details
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Token</span>
                    <span className="font-mono text-gray-800 dark:text-gray-100">
                      {token === CELO_USDC_ADDRESS ? 'USDC (Celo)' : formatAddress(token)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Contributed</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">
                      {formatUSDC(totalContributed)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Created At</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">
                      {formatDate(createdAt)}
                    </span>
                  </div>
                  {lastPayoutTime && Number(lastPayoutTime) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Last Payout</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">
                        {formatDate(lastPayoutTime)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
