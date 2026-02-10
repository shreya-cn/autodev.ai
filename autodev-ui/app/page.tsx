'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import JiraBoard from '@/components/JiraBoard';
import Backlog from '@/components/Backlog';
import PRComments from '@/components/PRComments';
import RelatedTickets from '@/components/RelatedTickets';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<'sprint' | 'backlog'>('sprint');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
        {/* Hero Section */}
        <div className="rounded-2xl px-7 py-7 text-white border border-green-500/20 shadow-xl" style={{background: 'linear-gradient(135deg, #1a1a1a 0%, #2d4a2e 50%, #1a1a1a 100%)'}}>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 leading-tight">
            Welcome to <span style={{color: '#b9ff66'}}>AutoDev.ai</span>
          </h1>
          <p className="text-sm md:text-base lg:text-lg text-gray-300 leading-relaxed max-w-4xl">
            Your intelligent development assistant for automated workflows and project management
          </p>
        </div>

        {/* Jira Board with Sub-tabs */}
        <div className="space-y-0">
          {/* Sub-tab Navigation */}
          <div className="flex gap-3 bg-gray-900 p-2 rounded-t-2xl border border-gray-800">
            <button
              onClick={() => setActiveSubTab('sprint')}
              className={`flex-1 px-6 py-4 font-bold text-base rounded-xl transition-all ${
                activeSubTab === 'sprint'
                  ? 'bg-primary text-dark shadow-lg'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 shadow-sm border border-gray-700'
              }`}
            >
              Current Sprint
            </button>
            <button
              onClick={() => setActiveSubTab('backlog')}
              className={`flex-1 px-6 py-4 font-bold text-base rounded-xl transition-all ${
                activeSubTab === 'backlog'
                  ? 'bg-primary text-dark shadow-lg'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 shadow-sm border border-gray-700'
              }`}
            >
              Backlog
            </button>
          </div>

          {/* Content */}
          <div className="bg-dark rounded-b-2xl shadow-lg border border-gray-800">
            {activeSubTab === 'sprint' ? <JiraBoard /> : <Backlog />}
          </div>
        </div>

        {/* PR Comments Section */}
        <PRComments />

        {/* Related Tickets Section */}
        <RelatedTickets />
        </div>
      </div>
    </div>
  );
}
