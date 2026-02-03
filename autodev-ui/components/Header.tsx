'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Header() {
  const [activeTab, setActiveTab] = useState('jira');
  const [showDropdown, setShowDropdown] = useState(false);
  const { data: session } = useSession();

  if (!session) return null;

  const user = session.user;
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

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
              href="/sprint-planning"
              onClick={() => setActiveTab('sprint-planning')}
              className={`inline-flex items-center px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-sm md:text-base font-bold transition-all ${
                activeTab === 'sprint-planning'
                  ? 'bg-primary text-dark shadow-md'
                  : 'text-gray-600 hover:bg-gray-light hover:shadow-sm'
              }`}
              title="Sprint Planning (PO View)"
            >
              Sprint Planning
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
          <div className="flex items-center relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 hover:bg-gray-50 px-4 py-2 rounded-xl transition-all border-2 border-transparent hover:border-primary/20 shadow-sm hover:shadow-md"
            >
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-dark">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              {user?.image ? (
                <img 
                  src={user.image} 
                  alt={user.name || 'User'} 
                  className="h-9 w-9 md:h-10 md:w-10 rounded-full ring-2 ring-primary shadow-lg"
                />
              ) : (
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg ring-2 ring-primary/30">
                  <span className="text-dark font-bold text-base md:text-lg">{initials}</span>
                </div>
              )}
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-20 overflow-hidden">
                  {/* Profile Header */}
                  <div className="px-5 py-4 bg-gradient-to-br from-primary/10 to-primary/5 border-b border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                      {user?.image ? (
                        <img 
                          src={user.image} 
                          alt={user.name || 'User'} 
                          className="h-14 w-14 rounded-full ring-2 ring-primary shadow-md"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md ring-2 ring-primary/30">
                          <span className="text-dark font-bold text-2xl">{initials}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-dark truncate">{user?.name}</p>
                        <p className="text-sm text-gray-600 truncate">{user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white/80 rounded-lg px-3 py-2">
                      <svg className="w-5 h-5 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.12 11.84L3.68 5.4c-.32-.6-.1-1.35.5-1.67.6-.32 1.35-.1 1.67.5l3.84 7.2-2.57 4.41zm9.76 0l-3.44-6.44c-.32-.6-.1-1.35.5-1.67.6-.32 1.35-.1 1.67.5l3.84 7.2-2.57 4.41z"/>
                      </svg>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Connected to Atlassian</p>
                        <p className="text-xs text-gray-500">Jira & Confluence Access</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      View Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <button
                      onClick={() => {
                        window.location.href = '/signout';
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-5 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-semibold flex items-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
