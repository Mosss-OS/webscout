"use client";

import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { supabase } from '@/lib/supabase';

interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  source: string;
  ecosystem: string | null;
  payout: string | null;
  url: string;
  is_processed: boolean;
  created_at: string;
}

interface SavedOpportunity {
  id: string;
  opportunity_id: string;
  status: string;
  draft_content: string | null;
  created_at: string;
  opportunities: Opportunity;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'saved'>('overview');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<SavedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const { data: opps, error: oppsError } = await supabase
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (oppsError) throw oppsError;
      setOpportunities(opps || []);

      const { data: saved, error: savedError } = await supabase
        .from('saved_opportunities')
        .select('*, opportunities(*)')
        .order('created_at', { ascending: false });

      if (savedError) throw savedError;
      setSavedOpportunities(saved || []);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const displayedOpps = activeTab === 'overview' ? opportunities : savedOpportunities.map(s => s.opportunities);

  function getMatchScore(opp: Opportunity): number {
    if (!opp.raw_data || typeof opp.raw_data !== 'object') return 50;
    const maybeScore = (opp.raw_data as any).match_score;
    return typeof maybeScore === 'number' ? maybeScore : 50;
  }

  function getEcosystemColor(eco: string | null): string {
    switch (eco?.toLowerCase()) {
      case 'evm': return 'border-blue-500/50 text-blue-400';
      case 'starknet': return 'border-purple-500/50 text-purple-400';
      case 'polkadot': return 'border-pink-500/50 text-pink-400';
      case 'stellar': return 'border-emerald-500/50 text-emerald-400';
      default: return 'border-gray-600 text-gray-400';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Fetching opportunities...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-800/50 rounded-2xl px-8 py-6 max-w-md text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load dashboard</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalOpportunities = opportunities.length;
  const savedCount = savedOpportunities.filter(s => s.status === 'saved' || s.status === 'drafted').length;
  const appliedCount = savedOpportunities.filter(s => s.status === 'applied').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">

        <header className="flex justify-between items-center pb-6 border-b border-gray-800">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              WebScout Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Autonomous Web3 Opportunity Agent</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm transition"
            >
              Refresh
            </button>
            {isConnected ? (
              <button
                onClick={() => disconnect()}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 transition px-6 py-2 rounded-full font-medium border border-emerald-500/50 text-emerald-400"
              >
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </button>
            ) : (
              <button
                onClick={() => connect({ connector: injected() })}
                className="bg-white/10 hover:bg-white/20 transition px-6 py-2 rounded-full font-medium border border-white/10 text-blue-300"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-gray-400 text-sm font-medium">Total Opportunities</h3>
            <p className="text-4xl font-bold mt-2 text-white">{totalOpportunities}</p>
          </div>
          <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 hover:border-blue-900/50 transition">
            <h3 className="text-gray-400 text-sm font-medium">Saved & Drafted</h3>
            <p className="text-4xl font-bold mt-2 text-blue-400">{savedCount}</p>
          </div>
          <div className="bg-gray-900/60 p-6 rounded-2xl border border-gray-800 hover:border-emerald-900/50 transition">
            <h3 className="text-gray-400 text-sm font-medium">Applications</h3>
            <p className="text-4xl font-bold mt-2 text-emerald-400">{appliedCount}</p>
          </div>
        </div>

        <div className="flex gap-4 border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium transition ${activeTab === 'overview' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            All Opportunities
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 font-medium transition ${activeTab === 'saved' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Saved & Applied
          </button>
        </div>

        <div className="bg-gray-900/40 rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-900/80 text-gray-400 text-sm border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 font-medium">Opportunity</th>
                <th className="px-6 py-4 font-medium">Ecosystem</th>
                <th className="px-6 py-4 font-medium">Payout</th>
                <th className="px-6 py-4 font-medium">Source</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayedOpps.map((opp) => {
                const savedInfo = savedOpportunities.find(s => s.opportunity_id === opp.id);
                const status = savedInfo?.status || 'New';
                const statusColor = status === 'New' ? 'border-blue-800/50 text-blue-400' :
                  status === 'drafted' || status === 'saved' ? 'border-yellow-800/50 text-yellow-400' :
                  'border-emerald-800/50 text-emerald-400';

                return (
                  <tr key={opp.id} className="hover:bg-gray-800/30 transition group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-200">{opp.title}</p>
                        {opp.description && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{opp.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs border ${getEcosystemColor(opp.ecosystem)}`}>
                        {opp.ecosystem || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-400">{opp.payout || 'TBD'}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{opp.source}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColor}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {displayedOpps.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {activeTab === 'overview' ? 'No opportunities found. Run /scout in the Telegram bot to discover some!' : 'No saved opportunities yet. Save some from the Telegram bot!'}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
