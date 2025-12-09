'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Nav from "./components/Nav";
import AdminDashboard from "./components/AdminDashboard";
import UserClaim from "./components/UserClaim";
import { ADMIN_ADDRESS } from '@/app/config/contract';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [activeView, setActiveView] = useState<'admin' | 'user'>('user');
  const isAdmin = address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  return (
    <div className="relative min-h-screen flex flex-col bg-zinc-50 font-sans dark:bg-black pt-24 pb-12">
      <Nav />

      <div className="container mx-auto px-4 mt-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            Referral Rewards Distributor
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Claim your rewards or manage campaigns
          </p>
        </div>

        {/* View Toggle */}
        {isConnected && (
          <div className="flex justify-center mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-1 inline-flex">
              <button
                onClick={() => setActiveView('user')}
                className={`px-6 py-2 rounded-lg font-medium transition ${
                  activeView === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Claim Rewards
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveView('admin')}
                  className={`px-6 py-2 rounded-lg font-medium transition ${
                    activeView === 'admin'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Admin Dashboard
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="w-full">
          {!isConnected ? (
            <div className="text-center">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 max-w-md mx-auto">
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                  Connect Your Wallet
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Please connect your wallet to get started
                </p>
              </div>
            </div>
          ) : activeView === 'admin' ? (
            <AdminDashboard />
          ) : (
            <UserClaim />
          )}
        </div>
      </div>
    </div>
  );
}
