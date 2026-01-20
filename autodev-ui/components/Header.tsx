'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Header() {
  const [activeTab, setActiveTab] = useState('jira');

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-md">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 lg:px-16 xl:px-24">
        <div className="flex items-center justify-between h-16 md:h-18 lg:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <div className="shrink-0">
              <span className="text-lg md:text-xl lg:text-2xl font-bold text-dark">
                AutoDev<span className="text-primary">.ai</span>
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-3 md:gap-4 lg:gap-6">
            <Link
              href="/"
              onClick={() => setActiveTab('jira')}
              className={`inline-flex items-center px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-sm md:text-base font-bold transition-all ${
                activeTab === 'jira'
                  ? 'bg-primary text-dark shadow-md'
                  : 'text-gray-600 hover:bg-gray-light hover:shadow-sm'
              }`}
            >
              Jira Board
            </Link>
            <Link
              href="/documentation"
              onClick={() => setActiveTab('documentation')}
              className={`inline-flex items-center px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-sm md:text-base font-bold transition-all ${
                activeTab === 'documentation'
                  ? 'bg-primary text-dark shadow-md'
                  : 'text-gray-600 hover:bg-gray-light hover:shadow-sm'
              }`}
            >
              Documentation
            </Link>
          </nav>

          {/* User Profile */}
          <div className="flex items-center">
            <div className="ml-4 relative">
              <div className="flex items-center gap-3">
                <span className="text-sm md:text-base font-semibold text-gray-700">Developer</span>
                <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-primary flex items-center justify-center shadow-md">
                  <span className="text-dark font-bold text-lg md:text-xl">D</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
