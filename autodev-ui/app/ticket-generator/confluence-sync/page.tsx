'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState } from 'react';

export default function ConfluenceSyncPage() {
  const { status } = useSession();
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState('');
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null);

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  const handleSyncRequirements = async () => {
    setTriggering(true);
    setTriggerResult('');
    try {
      // Trigger the workflow and get the runId from backend
      const res = await fetch('/api/sprint-planning/trigger-llm-jira-workflow', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.runId) {
        setWorkflowRunId(data.runId);
        setTriggerResult('Workflow started. Waiting for completion...');
        await waitForWorkflowCompletion(data.runId);
      } else {
        setTriggerResult(data.error || 'Failed to trigger workflow.');
      }
    } catch (err) {
      setTriggerResult('Error triggering workflow.');
    }
    setTriggering(false);
  };

  // Polls the workflow run status until it is completed
  const waitForWorkflowCompletion = async (runId: string) => {
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(res => setTimeout(res, 30000));
      const res = await fetch(`/api/sprint-planning/workflow-status?runId=${runId}`);
      const data = await res.json();
      if (data.status === 'completed') {
        if (data.conclusion === 'success') {
          setTriggerResult('Workflow successful!');
        } else {
          setTriggerResult(`Workflow failed: ${data.conclusion || 'unknown error'}`);
        }
        return;
      }
      attempts++;
    }
    setTriggerResult('Workflow did not complete in time.');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 min-h-screen bg-black text-white">
      <div className="rounded-2xl px-7 py-7 border border-green-500/20 shadow-xl mb-8" style={{background: 'linear-gradient(135deg, #1a1a1a 0%, #2d4a2e 50%, #1a1a1a 100%)'}}>
        <h1 className="text-3xl font-bold mb-2">Confluence Requirements Sync</h1>
        <p className="text-lg text-gray-300 mb-4">
          Click below to sync requirements from Confluence and create Jira tickets. If the page was already processed, no tickets will be created.
        </p>
        <button
          className="bg-primary text-black font-bold py-2 px-4 rounded shadow hover:bg-green-700 transition disabled:opacity-50"
          onClick={handleSyncRequirements}
          disabled={triggering}
        >
          {triggering ? 'Syncing...' : 'Sync Requirements'}
        </button>
        {triggerResult && (
          <div className="mt-4 text-sm">{triggerResult}</div>
        )}
      </div>
    </div>
  );
}