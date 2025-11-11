'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { FACTORY_V3_ADDRESS, StreamSaveFactoryV3ABI } from '@/lib/contracts/StreamSaveFactoryV3';
import { SimpleMerkleTree } from '@/lib/utils/merkle';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

interface CreateGroupDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated?: () => void;
}

export function CreateGroupDialogV2({ open, onOpenChange, onGroupCreated }: CreateGroupDialogV2Props) {
  const { address, isConnected } = useAccount();
  const [participantCount, setParticipantCount] = useState(3);
  const [participantAddresses, setParticipantAddresses] = useState<string[]>(['', '', '']);
  const [contributionAmount, setContributionAmount] = useState('0.001');
  const [roundDates, setRoundDates] = useState<(Date | undefined)[]>([undefined, undefined, undefined]);
  const [roundTimes, setRoundTimes] = useState<string[]>(['12:00', '12:00', '12:00']);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [hasShownSuccess, setHasShownSuccess] = useState(false);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Prepopulate first participant with creator's address when dialog opens
  useEffect(() => {
    if (open && address && participantAddresses[0] === '') {
      const newAddresses = [address, ...participantAddresses.slice(1)];
      setParticipantAddresses(newAddresses);
    }
  }, [open, address]);

  // Watch for transaction success with useEffect
  useEffect(() => {
    if (isSuccess && hash && !hasShownSuccess) {
      setShowSuccessDialog(true);
      setHasShownSuccess(true);
      onOpenChange(false);

      // Trigger refetch in parent component
      if (onGroupCreated) {
        onGroupCreated();
      }
    }
  }, [isSuccess, hash, hasShownSuccess, onOpenChange, onGroupCreated]);

  // Reset success flag when create dialog opens
  useEffect(() => {
    if (open) {
      setHasShownSuccess(false);
    }
  }, [open]);

  // Update arrays when participant count changes
  const handleParticipantCountChange = (count: number) => {
    setParticipantCount(count);
    const newAddresses = Array(count).fill('').map((_, idx) => {
      if (idx === 0 && !participantAddresses[idx] && address) {
        return address;
      }
      return participantAddresses[idx] || '';
    });
    const newDates = Array(count).fill(undefined).map((_, idx) => roundDates[idx] || undefined);
    const newTimes = Array(count).fill('12:00').map((_, idx) => roundTimes[idx] || '12:00');
    setParticipantAddresses(newAddresses);
    setRoundDates(newDates);
    setRoundTimes(newTimes);
    setValidationError('');
  };

  // Update specific participant address
  const handleParticipantAddressChange = (index: number, value: string) => {
    const newAddresses = [...participantAddresses];
    newAddresses[index] = value.trim();
    setParticipantAddresses(newAddresses);
    setValidationError('');
  };

  // Update specific round date
  const handleRoundDateChange = (index: number, date: Date | undefined) => {
    const newDates = [...roundDates];
    newDates[index] = date;
    setRoundDates(newDates);
    setValidationError('');
  };

  // Validate participant addresses
  const validateAddresses = (): { valid: boolean; error?: string } => {
    if (participantAddresses.some(addr => !addr || addr.trim() === '')) {
      return { valid: false, error: 'All participant addresses must be filled' };
    }

    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    const invalidAddress = participantAddresses.find(addr => !addressRegex.test(addr));
    if (invalidAddress) {
      return { valid: false, error: `Invalid address format: ${invalidAddress.slice(0, 10)}...` };
    }

    const uniqueAddresses = new Set(participantAddresses.map(addr => addr.toLowerCase()));
    if (uniqueAddresses.size !== participantAddresses.length) {
      return { valid: false, error: 'Duplicate addresses detected' };
    }

    return { valid: true };
  };

  // Validate round dates and times
  const validateDates = (): { valid: boolean; error?: string } => {
    // Check all dates are selected
    if (roundDates.some(date => !date)) {
      return { valid: false, error: 'All round dates must be selected' };
    }

    const now = new Date();

    // Combine date and time for each round and validate
    const roundDateTimes: Date[] = [];
    for (let i = 0; i < roundDates.length; i++) {
      const [hours, minutes] = roundTimes[i].split(':').map(Number);
      const dateTime = new Date(roundDates[i]!);
      dateTime.setHours(hours, minutes, 0, 0);
      roundDateTimes.push(dateTime);

      // Check datetime is in the future (allow today with future time)
      if (dateTime <= now) {
        return { valid: false, error: `Round ${i + 1} date/time must be in the future` };
      }
    }

    // Check datetimes are in ascending order
    for (let i = 1; i < roundDateTimes.length; i++) {
      if (roundDateTimes[i] <= roundDateTimes[i - 1]) {
        return { valid: false, error: `Round ${i + 1} must be after Round ${i}` };
      }
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
    const addressValidation = validateAddresses();
    if (!addressValidation.valid) {
      setValidationError(addressValidation.error || 'Invalid addresses');
      return;
    }

    // Validate dates
    const dateValidation = validateDates();
    if (!dateValidation.valid) {
      setValidationError(dateValidation.error || 'Invalid dates');
      return;
    }

    try {
      // Build merkle tree from participant addresses
      const merkleTree = new SimpleMerkleTree(participantAddresses);
      const merkleRoot = merkleTree.getRoot();

      // Store merkle tree data in localStorage
      const treeData = merkleTree.exportTreeData();
      const storageKey = `streamsave-tree-${Date.now()}`;
      localStorage.setItem(storageKey, JSON.stringify(treeData));

      // Convert dates + times to Unix timestamps (seconds)
      const roundTimestamps = roundDates.map((date, i) => {
        const [hours, minutes] = roundTimes[i].split(':').map(Number);
        const dateTime = new Date(date!);
        dateTime.setHours(hours, minutes, 0, 0);
        return BigInt(Math.floor(dateTime.getTime() / 1000));
      });

      console.log('Creating Calendar-Based Group:', {
        root: merkleRoot,
        participants: participantAddresses,
        roundDates: roundDates.map(d => d?.toISOString()),
        roundTimes: roundTimes,
        roundTimestamps: roundTimestamps.map(t => t.toString()),
        storageKey
      });

      const contributionAmountUSDC = parseUnits(contributionAmount, 6);

      writeContract({
        address: FACTORY_V3_ADDRESS,
        abi: StreamSaveFactoryV3ABI,
        functionName: 'createGroup',
        args: [merkleRoot, contributionAmountUSDC, roundTimestamps, BigInt(participantCount), participantAddresses as `0x${string}`[]],
      });
    } catch (err) {
      console.error('Error creating group:', err);
      setValidationError(err instanceof Error ? err.message : 'Failed to create group');
    }
  };

  // Add participant function
  const addParticipant = () => {
    if (participantCount >= 20) return;
    const newCount = participantCount + 1;
    setParticipantCount(newCount);
    setParticipantAddresses([...participantAddresses, '']);
    setRoundDates([...roundDates, undefined]);
    setRoundTimes([...roundTimes, '12:00']);
  };

  // Remove participant function
  const removeParticipant = (index: number) => {
    if (participantCount <= 3) return;
    const newCount = participantCount - 1;
    setParticipantCount(newCount);
    setParticipantAddresses(participantAddresses.filter((_, i) => i !== index));
    setRoundDates(roundDates.filter((_, i) => i !== index));
    setRoundTimes(roundTimes.filter((_, i) => i !== index));
  };

  // Update specific round time
  const handleRoundTimeChange = (index: number, time: string) => {
    const newTimes = [...roundTimes];
    newTimes[index] = time;
    setRoundTimes(newTimes);
    setValidationError('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New StreamSave Group</DialogTitle>
            <DialogDescription asChild>
              <div className="pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Step 1: Add participants → Step 2: Set contribution amount → Step 3: Schedule payment dates
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateGroup} className="space-y-6">
            {/* STEP 1: Participant Addresses */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium">
                  Step 1: Participants ({participantCount})
                </label>
                <button
                  type="button"
                  onClick={addParticipant}
                  disabled={participantCount >= 20}
                  className="text-sm px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Participant
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {participantAddresses.map((addr, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-xs text-gray-500">
                          Participant {index + 1}
                        </label>
                        {index === 0 && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            (You - Creator)
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={addr}
                        onChange={(e) => handleParticipantAddressChange(index, e.target.value)}
                        placeholder="0x..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                        required
                      />
                    </div>
                    {index > 0 && participantCount > 3 && (
                      <button
                        type="button"
                        onClick={() => removeParticipant(index)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm px-2 py-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Minimum 3 participants, maximum 20. First participant is auto-filled with your address.
              </p>
            </div>

            {/* STEP 2: Contribution Amount */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <label className="block text-sm font-medium mb-2">
                Step 2: Contribution Amount (USDC)
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
                Amount each participant contributes per round
              </p>
            </div>

            {/* STEP 3: Round Payment Dates & Times */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <label className="block text-sm font-medium mb-3">
                Step 3: Schedule Payment Date & Time for Each Round
              </label>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {roundDates.map((date, index) => (
                  <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      Round {index + 1} Payment Schedule
                    </label>

                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, 'PPP') : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(selectedDate) => handleRoundDateChange(index, selectedDate)}
                            disabled={(calendarDate) => {
                              const yesterday = new Date();
                              yesterday.setDate(yesterday.getDate() - 1);
                              return calendarDate < yesterday;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Time Input */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Time</label>
                      <input
                        type="time"
                        value={roundTimes[index]}
                        onChange={(e) => handleRoundTimeChange(index, e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Each round must have a future date/time. Rounds must be scheduled in ascending order.
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
                  Your calendar-based StreamSave ROSCA group has been deployed on-chain.
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
                    <strong>📅 Calendar-Based ROSCA:</strong> Each round has a specific payment date. Participants must contribute before their scheduled date.
                  </p>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Refresh the page to see your new group in the dashboard.
                </p>

                {/* Close Button */}
                <button
                  onClick={() => setShowSuccessDialog(false)}
                  className="w-full bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
