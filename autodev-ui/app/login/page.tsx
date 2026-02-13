'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  const handleAtlassianLogin = async () => {
    setLoading(true);
    try {
      await signIn('atlassian', { 
        callbackUrl: '/ticket-generator',
        redirect: true 
      });
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-gray-900 to-dark flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            <span className="text-primary">AutoDev</span>.ai
          </h1>
          <p className="text-gray-300 text-sm">Your intelligent development assistant</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-dark mb-2">Welcome Back</h2>
          <p className="text-gray-600 text-sm mb-6">Sign in with your Atlassian account to continue</p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              Authentication failed. Please try again.
            </div>
          )}

          {/* Atlassian OAuth Button */}
          <button
            type="button"
            onClick={handleAtlassianLogin}
            disabled={loading}
            className="w-full bg-primary text-dark font-bold py-4 rounded-lg hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="relative">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-800"></div>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-transparent border-t-dark absolute top-0 left-0" style={{background: 'conic-gradient(from 0deg, #1a1a1a, #86efac, #1a1a1a)', borderRadius: '50%', WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #fff 0)', mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #fff 0)'}}></div>
                </div>
                <span>Connecting to Atlassian...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.12 11.84L3.68 5.4c-.32-.6-.1-1.35.5-1.67.6-.32 1.35-.1 1.67.5l3.84 7.2-2.57 4.41zm9.76 0l-3.44-6.44c-.32-.6-.1-1.35.5-1.67.6-.32 1.35-.1 1.67.5l3.84 7.2-2.57 4.41z"/>
                </svg>
                <span>Sign in with Atlassian</span>
              </>
            )}
          </button>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-gray-light rounded-lg border-l-4 border-primary">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Secure Authentication</p>
                <p className="text-xs text-gray-600">
                  You'll be redirected to Atlassian to sign in with your Jira/Confluence account. 
                  Your credentials are never stored in our application.
                </p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold text-gray-700">What you'll get access to:</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Real-time Jira board integration</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>AI-powered ticket suggestions</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Confluence documentation access</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-8">
          © 2026 AutoDev.ai - Powered by AI
        </p>
      </div>
    </div>
  );
}
