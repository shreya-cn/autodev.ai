'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Backlog from '@/components/Backlog';

export default function BacklogPage() {
  const { data: session, status } = useSession();

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="bg-dark rounded-2xl p-8 text-white">
          <h1 className="text-4xl font-bold mb-2">
            Product <span className="text-primary">Backlog</span>
          </h1>
          <p className="text-lg text-gray-300">
            View and manage all unscheduled tickets in your backlog
          </p>
        </div>

        {/* Backlog Component */}
        <Backlog />
      </div>
    </div>
  );
}
