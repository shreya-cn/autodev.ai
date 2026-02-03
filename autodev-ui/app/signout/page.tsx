'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignOutPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically sign out when this page loads
    signOut({ redirect: false }).then(() => {
      // Do nothing, just stay on this page
    });
  }, []);

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <h1 className="text-3xl font-bold text-dark mb-4">Signed Out</h1>
        <p className="text-gray-600 mb-8">You have been logged out due to inactivity. Return to the sign in screen.</p>
        <button
          onClick={handleLogin}
          className="w-full bg-primary hover:bg-primary/90 text-dark font-bold py-3 px-6 rounded-xl transition-colors"
        >
          Login
        </button>
      </div>
    </div>
  );
}
