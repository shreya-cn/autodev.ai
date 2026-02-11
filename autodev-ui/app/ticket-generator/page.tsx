'use client';

import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TicketGeneratorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState('');

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  const runConfluenceRequirementsWorkflow = async (e) => {
    e.stopPropagation();
    setTriggering(true);
    setTriggerResult('');
    try {
      const res = await fetch('/api/sprint-planning/trigger-llm-jira-workflow', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTriggerResult('Workflow triggered successfully! Tickets created.');
      } else {
        setTriggerResult(data.error || 'Failed to trigger workflow.');
      }
    } catch (err) {
      setTriggerResult('Error triggering workflow.');
    }
    setTriggering(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-black">
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="rounded-2xl px-7 py-7 text-white border border-green-500/20 shadow-xl" style={{background: 'linear-gradient(135deg, #1a1a1a 0%, #2d4a2e 50%, #1a1a1a 100%)'}}>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 leading-tight">
            AI Ticket <span style={{color: '#b9ff66'}}>Generator</span>
          </h1>
          <p className="text-sm md:text-base lg:text-lg text-gray-300 leading-relaxed max-w-4xl">
            Choose your preferred method to generate Jira tickets
          </p>
        </div>

        {/* Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Text Editor Card */}
          <div 
            onClick={() => router.push('/ticket-generator/text-editor')}
            className="bg-gray-900 border border-green-500/20 rounded-xl p-8 cursor-pointer hover:border-green-500/40 transition-all hover:shadow-xl hover:shadow-green-500/10 group flex flex-col"
          >
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 rounded-full bg-gray-800 group-hover:bg-gray-700 transition-colors">
                <svg className="w-12 h-12" style={{color: '#b9ff66'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-3">
              Text Editor
            </h2>
            <p className="text-gray-400 text-center mb-6">
              Describe your problem or enhancement using a text input, and let AI generate a comprehensive ticket with all necessary details
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" style={{color: '#b9ff66'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>AI-powered ticket generation</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" style={{color: '#b9ff66'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Story points estimation</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" style={{color: '#b9ff66'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Automatic subtask creation</span>
              </div>
            </div>
            <div className="mt-auto pt-6 text-center">
              <span className="inline-block px-4 py-2 rounded-lg font-semibold" style={{backgroundColor: '#b9ff66', color: '#000'}}>
                Get Started →
              </span>
            </div>
          </div>

          {/* MOM Transcription Card */}
          <div 
            onClick={() => router.push('/ticket-generator/mom-transcription')}
            className="bg-gray-900 border border-green-500/20 rounded-xl p-8 cursor-pointer hover:border-green-500/40 transition-all hover:shadow-xl hover:shadow-green-500/10 group flex flex-col"
          >
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 rounded-full bg-gray-800 group-hover:bg-gray-700 transition-colors">
                <svg className="w-12 h-12" style={{color: '#b9ff66'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-3">
              MOM Transcription
            </h2>
            <p className="text-gray-400 text-center mb-6">
              Upload meeting transcriptions from Teams calls, and AI will extract action items and generate tickets automatically
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" style={{color: '#b9ff66'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Upload Teams meeting transcripts</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" style={{color: '#b9ff66'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Extract action items automatically</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" style={{color: '#b9ff66'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Bulk ticket creation</span>
              </div>
            </div>
            <div className="mt-auto pt-6 text-center">
              <span className="inline-block px-4 py-2 rounded-lg font-semibold" style={{backgroundColor: '#b9ff66', color: '#000'}}>
                Get Started →
              </span>
            </div>
          </div>

          {/* Confluence Requirements Sync Card */}
          <div
            onClick={runConfluenceRequirementsWorkflow}
            className={`bg-gray-900 border border-green-500/20 rounded-xl p-8 cursor-pointer hover:border-green-500/40 transition-all hover:shadow-xl hover:shadow-green-500/10 group flex flex-col ${triggering ? 'opacity-70 pointer-events-none' : ''}`}
          >
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 rounded-full bg-gray-800 group-hover:bg-gray-700 transition-colors">
                <svg className="w-12 h-12" style={{ color: '#b9ff66' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-3">
              Confluence Requirements Sync
            </h2>
            <p className="text-gray-400 text-center mb-6">
              Search your Confluence space for pages with requirement in the title and automatically create Jira tickets based on their content.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" style={{ color: '#b9ff66' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Automatic requirement page fetching</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" style={{ color: '#b9ff66' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>AI-powered Jira ticket creation</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <svg className="w-4 h-4" style={{ color: '#b9ff66' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Story points and technical estimation</span>
              </div>
            </div>
            {triggerResult && (
              <div className={`mt-4 text-sm font-medium text-center ${triggerResult.includes('successfully') ? 'text-green-400' : 'text-red-400'}`}>
                {triggerResult}
              </div>
            )}
            <div className="mt-auto pt-6 text-center">
              <span className="inline-block px-4 py-2 rounded-lg font-semibold" style={{ backgroundColor: '#b9ff66', color: '#000' }}>
                {triggering ? 'Triggering...' : 'Sync Requirements →'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}