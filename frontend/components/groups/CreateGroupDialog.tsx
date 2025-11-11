'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FACTORY_ADDRESS, StreamSaveFactoryABI } from '@/lib/contracts/StreamSaveFactory';
import { SimpleMerkleTree } from '@/lib/utils/merkle';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const { address, isConnected } = useAccount();
  const [participantCount, setParticipantCount] = useState(3);
  const [participantAddresses, setParticipantAddresses] = useState<string[]>(['', '', '']);
  const [contributionAmount, setContributionAmount] = useState('0.001');
  const [cycleDuration, setCycleDuration] = useState('2'); // in minutes
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Watch for transaction success with useEffect
  useEffect(() => {
    if (isSuccess && hash && !showSuccessDialog) {
      // Transaction succeeded, show success dialog
      setShowSuccessDialog(true);
      onOpenChange(false); // Close create dialog
    }
  }, [isSuccess, hash, showSuccessDialog, onOpenChange]);

  // Update participant address array when count changes
  const handleParticipantCountChange = (count: number) => {
    setParticipantCount(count);
    const newAddresses = Array(count).fill('').map((_, idx) =>
      participantAddresses[idx] || ''
    );
    setParticipantAddresses(newAddresses);
    setValidationError('');
  };

  // Update specific participant address
  const handleParticipantAddressChange = (index: number, value: string) => {
    const newAddresses = [...participantAddresses];
    newAddresses[index] = value.trim();
    setParticipantAddresses(newAddresses);
    setValidationError('');
  };

  // Validate participant addresses
  const validateAddresses = (): { valid: boolean; error?: string } => {
    // Check all addresses are filled
    if (participantAddresses.some(addr => !addr || addr.trim() === '')) {
      return { valid: false, error: 'All participant addresses must be filled' };
    }

    // Check all addresses are valid Ethereum addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    const invalidAddress = participantAddresses.find(addr => !addressRegex.test(addr));
    if (invalidAddress) {
      return { valid: false, error: `Invalid address format: ${invalidAddress}` };
    }

    // Check for duplicate addresses
    const uniqueAddresses = new Set(participantAddresses.map(addr => addr.toLowerCase()));
    if (uniqueAddresses.size !== participantAddresses.length) {
      return { valid: false, error: 'Duplicate addresses detected. Each participant must have a unique address' };
    }

    return { valid: true };
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !address) {
      setValidationError('Please connect your wallet');
      return;
    }

    // Validate addresses
    const validation = validateAddresses();
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid addresses');
      return;
    }

    try {
      // Build merkle tree from participant addresses
      const merkleTree = new SimpleMerkleTree(participantAddresses);
      const merkleRoot = merkleTree.getRoot();

      // Store merkle tree data in localStorage for participants to generate proofs later
      const treeData = merkleTree.exportTreeData();
      const storageKey = `streamsave-tree-${Date.now()}`;
      localStorage.setItem(storageKey, JSON.stringify(treeData));

      console.log('Merkle Tree Created:', {
        root: merkleRoot,
        participants: participantAddresses,
        storageKey
      });

      const contributionAmountUSDC = parseUnits(contributionAmount, 6); // USDC has 6 decimals
      const cycleDurationSeconds = BigInt(parseInt(cycleDuration) * 60); // Convert minutes to seconds

      writeContract({
        address: FACTORY_ADDRESS,
        abi: StreamSaveFactoryABI,
        functionName: 'createGroup',
        args: [merkleRoot, contributionAmountUSDC, cycleDurationSeconds, BigInt(participantCount)],
      });
    } catch (err) {
      console.error('Error creating group:', err);
      setValidationError(err instanceof Error ? err.message : 'Failed to create group');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New StreamSave Group</DialogTitle>
            <DialogDescription asChild>
              <div className="pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Configure your ROSCA group parameters and add participant wallet addresses
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateGroup} className="space-y-4">
            {/* Number of Participants */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Number of Participants (3-20)
              </label>
              <input
                type="number"
                min="3"
                max="20"
                value={participantCount}
                onChange={(e) => handleParticipantCountChange(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* Participant Addresses */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Participant Wallet Addresses
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                {participantAddresses.map((addr, index) => (
                  <div key={index}>
                    <label className="block text-xs text-gray-500 mb-1">
                      Participant {index + 1}
                    </label>
                    <input
                      type="text"
                      value={addr}
                      onChange={(e) => handleParticipantAddressChange(index, e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                      required
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter the wallet address for each participant. These addresses will be used to generate privacy-preserving nullifiers.
              </p>
            </div>

            {/* Contribution Amount */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Contribution Amount (USDC)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Amount each participant contributes per cycle
              </p>
            </div>

            {/* Cycle Duration */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Cycle Duration (minutes)
              </label>
              <input
                type="number"
                min="2"
                value={cycleDuration}
                onChange={(e) => setCycleDuration(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Time between each payout (minimum 2 minutes)
              </p>
            </div>

            {/* Validation Error Display */}
            {validationError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {validationError}
                </p>
              </div>
            )}

            {/* Contract Error Display */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error.message}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending || isConfirming || !isConnected}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Confirm in wallet...' : isConfirming ? 'Creating group...' : 'Create Group'}
            </button>

            {!isConnected && (
              <p className="text-sm text-center text-red-600 dark:text-red-400">
                Please connect your wallet to create a group
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <span className="text-2xl">✅</span>
              Group Created Successfully!
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-4">
                <p className="text-base">
                  Your StreamSave ROSCA group has been deployed on-chain.
                </p>

                {hash && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium mb-1">Transaction Hash:</p>
                    <a
                      href={`https://celoscan.io/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {hash}
                    </a>
                  </div>
                )}

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>📋 Important:</strong> Participant merkle tree data has been stored in your browser's localStorage. Participants will need this data to generate proofs when signing payment vouchers.
                  </p>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Refresh the page to see your new group in the dashboard.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
