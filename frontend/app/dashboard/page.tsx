'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { FACTORY_V3_ADDRESS, StreamSaveFactoryV3ABI } from '@/lib/contracts/StreamSaveFactoryV3';
import { GroupCard } from '@/components/groups/GroupCard';
import { CreateGroupDialogV2 } from '@/components/groups/CreateGroupDialogV2';
import { Address } from 'viem';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [userGroups, setUserGroups] = useState<Address[]>([]);

  // Fetch groups where user is a participant (includes created and invited groups)
  const { data: participantGroups, refetch } = useReadContract({
    address: FACTORY_V3_ADDRESS,
    abi: StreamSaveFactoryV3ABI,
    functionName: 'getUserGroups',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    }
  });

  useEffect(() => {
    if (participantGroups && Array.isArray(participantGroups)) {
      setUserGroups(participantGroups as Address[]);
    }
  }, [participantGroups]);

  // Refetch when dialog closes (new group created)
  useEffect(() => {
    if (!showCreateDialog) {
      refetch();
    }
  }, [showCreateDialog, refetch]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Connect Your Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Please connect your wallet to view your StreamSave groups
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
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              StreamSave
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your savings groups
            </p>
          </div>
          <ConnectButton />
        </header>

        {/* Main Content */}
        <main>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              My StreamSave Groups
            </h2>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-shadow"
            >
              + Create New Group
            </button>
          </div>

          {/* Groups Grid */}
          {userGroups.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center">
              <div className="text-6xl mb-4">💸</div>
              <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
                No Groups Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Create a new calendar-based StreamSave group to get started with your savings journey.
              </p>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-shadow"
              >
                + Create Your First Group
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userGroups.map((groupAddress) => (
                <GroupCard key={groupAddress} address={groupAddress} name="Calendar-Based Group" />
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-600 dark:text-gray-400">
          <p>Connected: {address}</p>
          <p className="mt-2 text-sm">
            Built on Celo with x402 Micropayments • Privacy-First Design
          </p>
        </footer>
      </div>

      {/* Create Group Dialog V2 (Calendar-based) */}
      <CreateGroupDialogV2
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onGroupCreated={refetch}
      />
    </div>
  );
}
