import { useWatchContractEvent } from 'wagmi';
import { StreamSaveABI } from '@/lib/contracts/StreamSave';
import { formatUSDC } from '@/lib/utils/format';

/**
 * Monitor auto-payout and contribution events for a StreamSave group
 */
export function usePayoutEvents(groupAddress: string) {
  // Watch ContributionTracked events
  useWatchContractEvent({
    address: groupAddress as `0x${string}`,
    abi: StreamSaveABI,
    eventName: 'ContributionTracked',
    onLogs(logs) {
      logs.forEach((log) => {
        console.log('💰 Contribution tracked:', log);
        const { nullifier, amount, timestamp } = log.args;

        // Show notification
        if (typeof window !== 'undefined') {
          const notification = `💰 Contribution tracked!\nAmount: ${formatUSDC(amount)} USDC`;
          console.log(notification);
        }
      });
    },
  });

  // Watch AutoPayoutTriggered events
  useWatchContractEvent({
    address: groupAddress as `0x${string}`,
    abi: StreamSaveABI,
    eventName: 'AutoPayoutTriggered',
    onLogs(logs) {
      logs.forEach((log) => {
        console.log('🎯 Auto payout triggered:', log);
        const { round, recipientNullifier, contributionCount } = log.args;

        // Show notification
        if (typeof window !== 'undefined') {
          alert(`🎉 Auto-payout triggered!\n\nRound ${round?.toString()} is complete with ${contributionCount?.toString()} contributions.\nWinner will receive payment automatically!`);
        }
      });
    },
  });

  // Watch PayoutDistributed events
  useWatchContractEvent({
    address: groupAddress as `0x${string}`,
    abi: StreamSaveABI,
    eventName: 'PayoutDistributed',
    onLogs(logs) {
      logs.forEach((log) => {
        console.log('💸 Payout distributed:', log);
        const { round, recipientNullifier, recipient, amount, isAutomatic } = log.args;

        // Show notification
        if (typeof window !== 'undefined') {
          const message = isAutomatic
            ? `🎉 Automatic payout!\n\nRound ${round?.toString()}\nRecipient: ${recipient}\nAmount: ${formatUSDC(amount)} USDC`
            : `💸 Payout distributed for round ${round?.toString()}`;

          alert(message);
        }
      });
    },
  });

  // Watch ROSCACompleted events
  useWatchContractEvent({
    address: groupAddress as `0x${string}`,
    abi: StreamSaveABI,
    eventName: 'ROSCACompleted',
    onLogs(logs) {
      logs.forEach((log) => {
        console.log('🏁 ROSCA completed:', log);
        const { totalRounds, completedAt } = log.args;

        // Show notification
        if (typeof window !== 'undefined') {
          alert(`🏁 StreamSave Group Complete!\n\nAll ${totalRounds?.toString()} rounds have been completed.\nCongratulations to all participants!`);
        }
      });
    },
  });

  // Watch ParticipantJoined events
  useWatchContractEvent({
    address: groupAddress as `0x${string}`,
    abi: StreamSaveABI,
    eventName: 'ParticipantJoined',
    onLogs(logs) {
      logs.forEach((log) => {
        console.log('👤 Participant joined:', log);
        const { nullifier, payoutAddress } = log.args;

        // Show notification
        if (typeof window !== 'undefined') {
          console.log(`👤 New participant joined: ${payoutAddress}`);
        }
      });
    },
  });
}
