'use client';

import { useReadContract } from 'wagmi';
import Link from 'next/link';
import { StreamSaveABI } from '@/lib/contracts/StreamSave';
import { formatUSDC, formatDuration, formatAddress } from '@/lib/utils/format';

interface GroupCardProps {
  address: string;
  name: string;
}

export function GroupCard({ address, name }: GroupCardProps) {
  // Read contract state
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

  const { data: roundContributionCount } = useReadContract({
    address: address as `0x${string}`,
    abi: StreamSaveABI,
    functionName: 'roundContributionCount',
    args: [currentRound ?? 0n],
  });

  // Calculate progress
  const progress = totalParticipants && roundContributionCount
    ? (Number(roundContributionCount) / Number(totalParticipants)) * 100
    : 0;

  return (
    <Link href={`/groups/${address}`}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transition-shadow p-6 cursor-pointer border-2 border-transparent hover:border-green-500">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">
              {name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {formatAddress(address)}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Stats */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Contribution
            </span>
            <span className="font-bold text-gray-800 dark:text-gray-100">
              {formatUSDC(contributionAmount)} USDC
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Cycle Duration
            </span>
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {formatDuration(cycleDuration)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Participants
            </span>
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {participantCount?.toString() ?? '0'} / {totalParticipants?.toString() ?? '0'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Current Round
            </span>
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              Round {currentRound?.toString() ?? '0'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>Round Progress</span>
            <span>{roundContributionCount?.toString() ?? '0'} / {totalParticipants?.toString() ?? '0'} paid</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
            View Details →
          </span>
        </div>
      </div>
    </Link>
  );
}
