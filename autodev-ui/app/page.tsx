'use client';

import { useState } from 'react';
import JiraBoard from '@/components/JiraBoard';
import Backlog from '@/components/Backlog';
import PRComments from '@/components/PRComments';
import RelatedTickets from '@/components/RelatedTickets';

export default function Home() {
  const [activeSubTab, setActiveSubTab] = useState<'sprint' | 'backlog'>('sprint');

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
        {/* Hero Section */}
        <div className="bg-dark rounded-2xl p-8 text-white">
          <h1 className="text-4xl font-bold mb-2">
            Welcome to <span className="text-primary">AutoDev.ai</span>
          </h1>
          <p className="text-lg text-gray-300">
            Your intelligent development assistant for automated workflows and project management
          </p>
        </div>

        {/* Jira Board with Sub-tabs */}
        <div className="space-y-0">
          {/* Sub-tab Navigation */}
          <div className="flex gap-3 bg-gray-light p-2 rounded-t-2xl">
            <button
              onClick={() => setActiveSubTab('sprint')}
              className={`flex-1 px-6 py-4 font-bold text-base rounded-xl transition-all ${
                activeSubTab === 'sprint'
                  ? 'bg-primary text-dark shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
              }`}
            >
              Current Sprint
            </button>
            <button
              onClick={() => setActiveSubTab('backlog')}
              className={`flex-1 px-6 py-4 font-bold text-base rounded-xl transition-all ${
                activeSubTab === 'backlog'
                  ? 'bg-primary text-dark shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
              }`}
            >
              Backlog
            </button>
          </div>

          {/* Content */}
          <div className="bg-white rounded-b-2xl shadow-lg">
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
