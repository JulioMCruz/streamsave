'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <div className="flex justify-end mb-4">
            <ConnectButton />
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            StreamSave
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Stream your income, save while you earn. x402 micropayments for privacy-first savings on Celo.
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
              Turn Your Paycheck Into a Savings Stream
            </h2>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="p-6 bg-green-50 dark:bg-gray-700 rounded-xl">
                <h3 className="text-xl font-semibold mb-3 text-green-700 dark:text-green-400">
                  💧 Stream While You Earn
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Save as little as $0.10/hour using x402 micropayments. No lump sum required - your income flows automatically into savings.
                </p>
              </div>

              <div className="p-6 bg-blue-50 dark:bg-gray-700 rounded-xl">
                <h3 className="text-xl font-semibold mb-3 text-blue-700 dark:text-blue-400">
                  🔒 Privacy by Design
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Anonymous micropayments via x402 protocol. Zero-knowledge proofs protect your identity - no one can track your savings.
                </p>
              </div>

              <div className="p-6 bg-purple-50 dark:bg-gray-700 rounded-xl">
                <h3 className="text-xl font-semibold mb-3 text-purple-700 dark:text-purple-400">
                  📱 Mobile Money Compatible
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Works with M-Pesa, MTN, Airtel Money. Access via smartphone or feature phone (USSD). Built on Celo for mobile-first savings.
                </p>
              </div>

              <div className="p-6 bg-orange-50 dark:bg-gray-700 rounded-xl">
                <h3 className="text-xl font-semibold mb-3 text-orange-700 dark:text-orange-400">
                  💰 Earn While You Save
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Your savings earn 3-5% APY through DeFi integration (Aave/Compound). Build microcredit history for future loans.
                </p>
              </div>
            </div>

            <div className="text-center">
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button
                    onClick={openConnectModal}
                    className="bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold py-4 px-8 rounded-xl text-lg hover:shadow-lg transition-shadow"
                  >
                    Connect Wallet to Start
                  </button>
                )}
              </ConnectButton.Custom>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-100 to-blue-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6">
            <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
              How StreamSave Works
            </h3>
            <ol className="space-y-4 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="font-bold text-green-600 mr-3">1.</span>
                <span>Set your income stream rate (e.g., $0.10/hour = $72/month) using x402 micropayments</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-blue-600 mr-3">2.</span>
                <span>Connect your mobile money (M-Pesa, MTN, Airtel) or crypto wallet on Celo</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-purple-600 mr-3">3.</span>
                <span>Your income streams continuously and privately into your savings vault</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-orange-600 mr-3">4.</span>
                <span>Earn 3-5% APY on your savings through automated DeFi integrations</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-pink-600 mr-3">5.</span>
                <span>Build microcredit history for future loans - access credit when you need it</span>
              </li>
            </ol>
          </div>
        </main>

        <footer className="text-center mt-16 text-gray-600 dark:text-gray-400">
          <p>Built on Celo with x402 Micropayments • Privacy-First Design • Mobile Money Integration</p>
        </footer>
      </div>
    </div>
  );
}
