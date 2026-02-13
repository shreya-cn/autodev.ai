'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('ticket-generator');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { data: session } = useSession();

  const navLinks = [
    { href: '/ticket-generator', label: 'Ticket Generator', id: 'ticket-generator', title: 'AI-Powered Ticket Generator' },
    { href: '/sprint-planning', label: 'Sprint Planning', id: 'sprint-planning', title: 'Sprint Planning (PO View)' },
    { href: '/', label: 'Jira Board', id: 'jira' },
    { href: '/documentation', label: 'Documentation', id: 'documentation' },
    { href: '/support-dashboard', label: 'Support', id: 'support-dashboard', title: 'AI Support Ticket Analyzer' },
    { href: '/support-analytics', label: 'Analytics', id: 'support-analytics', title: 'Support Issues Analytics' },
    { href: '/knowledge-base', label: 'KB', id: 'knowledge-base', icon: true, title: 'Knowledge Base - Ask questions about your codebase' },
  ];

  useEffect(() => {
    // Determine active tab based on current pathname
    const currentLink = navLinks.find(link => {
      if (link.href === '/') {
        return pathname === '/';
      }
      return pathname?.startsWith(link.href);
    });
    if (currentLink) {
      setActiveTab(currentLink.id);
    }
  }, [pathname]);

  if (!session) return null;

  const user = session.user;
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-md">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="shrink-0">
              <span className="text-xl sm:text-2xl md:text-3xl font-bold text-dark">
                AutoDev<span className="text-primary">.ai</span>
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex gap-1.5">
            {navLinks.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                onClick={() => setActiveTab(link.id)}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-base font-semibold transition-all ${
                  activeTab === link.id
                    ? 'bg-primary text-dark shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={link.title}
              >
                {link.icon ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ) : (
                  link.label
                )}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="xl:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showMobileMenu ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* User Profile */}
          <div className="flex items-center relative ml-2">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 sm:gap-2 hover:bg-gray-50 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg transition-all"
            >
              <div className="text-right hidden lg:block">
                <p className="text-xs font-semibold text-dark truncate max-w-[120px]">{user?.name}</p>
                <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{user?.email}</p>
              </div>
              {user?.image ? (
                <img 
                  src={user.image} 
                  alt={user.name || 'User'} 
                  className="h-8 w-8 rounded-full ring-2 ring-primary/30"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center ring-2 ring-primary/30">
                  <span className="text-dark font-bold text-xs">{initials}</span>
                </div>
              )}
              <svg 
                className={`w-3 h-3 text-gray-400 transition-transform hidden sm:block ${showDropdown ? 'rotate-180' : ''}`} 
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

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <div className="xl:hidden border-t border-gray-200 py-3">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => {
                    setActiveTab(link.id);
                    setShowMobileMenu(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-base font-semibold transition-all ${
                    activeTab === link.id
                      ? 'bg-primary text-dark'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title={link.title}
                >
                  {link.icon && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  <span>{link.icon ? 'Knowledge Base' : link.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
