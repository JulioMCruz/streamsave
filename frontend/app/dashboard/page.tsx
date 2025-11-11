'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { DEPLOYED_GROUPS } from '@/lib/contracts/StreamSave';
import { GroupCard } from '@/components/groups/GroupCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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
          {DEPLOYED_GROUPS.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center">
              <div className="text-6xl mb-4">💸</div>
              <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
                No Groups Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Deploy a StreamSave contract using the Hardhat CLI to get started.
                Once deployed, add the contract address to the frontend configuration.
              </p>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-left max-w-xl mx-auto">
                <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
                  # Deploy a new StreamSave group
                </p>
                <p className="font-mono text-sm text-green-600 dark:text-green-400">
                  cd apps/streamsave/contracts
                </p>
                <p className="font-mono text-sm text-green-600 dark:text-green-400">
                  npx hardhat run scripts/deploy-test.ts --network celo
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DEPLOYED_GROUPS.map((group) => (
                <GroupCard key={group.address} address={group.address} name={group.name} />
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

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <span className="text-2xl">🚀</span>
              Create New StreamSave Group
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-4 pt-4">
                <p className="text-base">
                  StreamSave groups are deployed as individual smart contracts using Hardhat.
                </p>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">
                    📋 Deployment Steps:
                  </p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-1">
                        1. Navigate to contracts directory:
                      </p>
                      <code className="block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 rounded text-sm">
                        cd apps/streamsave/contracts
                      </code>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-1">
                        2. Deploy to Celo Mainnet:
                      </p>
                      <code className="block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 rounded text-sm">
                        npx hardhat run scripts/deploy-test.ts --network celo
                      </code>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-1">
                        3. Add contract address to frontend:
                      </p>
                      <code className="block bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 rounded text-sm whitespace-pre-wrap">
                        {`Edit: frontend/lib/contracts/StreamSave.ts
Add new address to DEPLOYED_GROUPS array`}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>⚠️ Note:</strong> Make sure you have configured your .env file with PRIVATE_KEY and CELOSCAN_API_KEY before deploying.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateDialog(false)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Got it!
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
