"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState } from "react";

interface GeneratedTicket {
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  suggestedType: "Story" | "Bug" | "Task" | "Epic";
  suggestedPriority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
  relatedComponents: string[];
  technicalNotes: string;
  storyPoints: number;
  subtasks?: Array<{
    summary: string;
    description: string;
    storyPoints: number;
  }>;
}

export default function TextEditorTicketGenerator() {
  const { data: session, status } = useSession();
  const [userInput, setUserInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedTicket, setGeneratedTicket] =
    useState<GeneratedTicket | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSubtaskDialog, setShowSubtaskDialog] = useState(false);
  const [createSubtasks, setCreateSubtasks] = useState(false);

  if (status === "unauthenticated") {
    redirect("/login");
  }

  const handleGenerate = async () => {
    if (!userInput.trim()) {
      setError("Please describe the problem or enhancement");
      return;
    }

    setIsGenerating(true);
    setError("");
    setSuccess("");
    setGeneratedTicket(null);

    try {
      const response = await fetch("/api/jira/generate-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userInput }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate ticket");
      }

      const data = await response.json();
      setGeneratedTicket(data);

      // If story points > 8, ask about creating subtasks
      if (data.storyPoints > 8 && data.subtasks && data.subtasks.length > 0) {
        setShowSubtaskDialog(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };
  async function generate({
    summary,
    description,
    issueType,
  }: {
    summary: string;
    description: string;
    issueType: string;
  }) {
    const res = await fetch("/api/auto-asignee", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary,
        description,
        issueType,
      }),
    });

    const data = await res.json();
    return data;
  }

  const handleCreateTicket = async () => {
    if (!generatedTicket) return;

    setIsCreating(true);
    setError("");
    setSuccess("");

    const autoAssigneeDes = await generate({
      summary: generatedTicket.summary,
      description: generatedTicket.description,
      issueType: generatedTicket.suggestedType,
    });

    const res = await fetch("/api/jira/get-fields", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const fields = await res.json();
    const recommendedField = fields.find(
      (item: any) => item.name === "Recommended Assignee",
    );
    const recommendedFieldId = recommendedField.id;

    const updatedTicket = {
      ...generatedTicket,
      summary: `[Recommended-Assignee] ${generatedTicket.summary}`,
      recommendedFieldId: recommendedFieldId,
      autoAssigneeDes:autoAssigneeDes,
    };

    try {
      const response = await fetch("/api/jira/create-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...updatedTicket,
          createSubtasks,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create ticket");
      }

      const data = await response.json();
      setSuccess(data.message || `Ticket created successfully: ${data.key}`);
      setUserInput("");
      setGeneratedTicket(null);
      setCreateSubtasks(false);
      setShowSubtaskDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-black">
      <div className="space-y-8">
        {/* Hero Section */}
        <div
          className="rounded-2xl px-7 py-7 text-white border border-green-500/20 shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, #1a1a1a 0%, #2d4a2e 50%, #1a1a1a 100%)",
          }}
        >
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 leading-tight">
            AI Ticket Generator -{" "}
            <span style={{ color: "#b9ff66" }}>Text Editor</span>
          </h1>
          <p className="text-sm md:text-base lg:text-lg text-gray-300 leading-relaxed max-w-4xl">
            Describe your problem or enhancement, and let AI create a
            comprehensive ticket
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-dark rounded-lg shadow-md p-6 border border-green-500/20">
          <label
            htmlFor="userInput"
            className="block text-lg font-semibold text-white mb-3"
          >
            Describe Your Problem or Enhancement
          </label>
          <textarea
            id="userInput"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Example: The login page is slow and sometimes fails to authenticate users. We need to improve performance and add better error handling."
            className="w-full h-40 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none text-gray-200 placeholder-gray-500"
            disabled={isGenerating}
          />
          <p className="text-sm text-gray-400 mt-2">
            Be as detailed as possible. Include context about the issue,
            expected behavior, and any relevant technical details.
          </p>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !userInput.trim()}
            style={{
              backgroundColor:
                isGenerating || !userInput.trim() ? "" : "#b9ff66",
            }}
            className="mt-4 px-6 py-3 text-black font-semibold rounded-lg hover:opacity-90 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isGenerating ? (
              <span className="flex items-center">
                <div className="relative mr-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-800"></div>
                  <div
                    className="animate-spin rounded-full h-5 w-5 border-2 border-transparent border-t-primary absolute top-0 left-0"
                    style={{
                      background:
                        "conic-gradient(from 0deg, #1a1a1a, #86efac, #1a1a1a)",
                      borderRadius: "50%",
                      WebkitMask:
                        "radial-gradient(farthest-side, transparent calc(100% - 2px), #fff 0)",
                      mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #fff 0)",
                    }}
                  ></div>
                </div>
                Generating...
              </span>
            ) : (
              "Generate Ticket"
            )}
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div
            className="border px-4 py-3 rounded-lg"
            style={{
              backgroundColor: "rgba(185, 255, 102, 0.1)",
              borderColor: "#b9ff66",
              color: "#b9ff66",
            }}
          >
            {success}
          </div>
        )}

        {/* Generated Ticket Preview */}
        {generatedTicket && (
          <div className="bg-dark rounded-lg shadow-md p-6 space-y-6 border border-green-500/20">
            <div className="flex items-center justify-between border-b border-gray-700 pb-4">
              <h2 className="text-2xl font-bold text-white">
                Generated Ticket
              </h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-800 text-gray-300 border border-gray-600">
                  {generatedTicket.storyPoints} SP
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    generatedTicket.suggestedType === "Bug"
                      ? "bg-red-900/40 text-red-300 border border-red-500/50"
                      : generatedTicket.suggestedType === "Story"
                        ? "bg-blue-900/40 text-blue-300 border border-blue-500/50"
                        : generatedTicket.suggestedType === "Epic"
                          ? "bg-purple-900/40 text-purple-300 border border-purple-500/50"
                          : "bg-gray-800 text-gray-300 border border-gray-600"
                  }`}
                >
                  {generatedTicket.suggestedType}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    generatedTicket.suggestedPriority === "Highest" ||
                    generatedTicket.suggestedPriority === "High"
                      ? "bg-orange-900/40 text-orange-300 border border-orange-500/50"
                      : "bg-yellow-900/40 text-yellow-300 border border-yellow-500/50"
                  }`}
                >
                  {generatedTicket.suggestedPriority}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Summary</h3>
              <p className="text-gray-300 bg-gray-800 p-3 rounded border border-gray-700">
                {generatedTicket.summary}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Description
              </h3>
              <div className="text-gray-300 bg-gray-800 p-4 rounded whitespace-pre-wrap border border-gray-700">
                {generatedTicket.description}
              </div>
            </div>

            {generatedTicket.acceptanceCriteria.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Acceptance Criteria
                </h3>
                <ul className="list-disc list-inside space-y-2 bg-gray-800 p-4 rounded border border-gray-700">
                  {generatedTicket.acceptanceCriteria.map(
                    (criterion, index) => (
                      <li key={index} className="text-gray-300">
                        {criterion}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}

            {generatedTicket.technicalNotes && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Technical Notes
                </h3>
                <div className="text-gray-300 bg-gray-800 p-4 rounded whitespace-pre-wrap border border-gray-700">
                  {generatedTicket.technicalNotes}
                </div>
              </div>
            )}

            {generatedTicket.relatedComponents.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Related Components
                </h3>
                <div className="flex flex-wrap gap-2">
                  {generatedTicket.relatedComponents.map((component, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-900/40 text-purple-300 border border-purple-500/50 rounded-full text-sm"
                    >
                      {component}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Subtask Dialog */}
            {showSubtaskDialog && (
              <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                      Large Story Detected ({generatedTicket.storyPoints} Story
                      Points)
                    </h3>
                    {generatedTicket.suggestedType === "Epic" ? (
                      <div>
                        <p className="text-red-300 mb-4 font-semibold">
                          ⚠️ Warning: This was generated as an Epic, but Epics
                          cannot have subtasks in Jira. Please regenerate as a
                          Story type if you want to break it into subtasks.
                        </p>
                        <button
                          onClick={() => {
                            setGeneratedTicket(null);
                            setShowSubtaskDialog(false);
                          }}
                          className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Regenerate as Story
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-300 mb-4">
                          This ticket has more than 8 story points. Would you
                          like to break it down into smaller subtasks for better
                          tracking and implementation?
                        </p>
                        {generatedTicket.subtasks &&
                          generatedTicket.subtasks.length > 0 && (
                            <div className="mb-4">
                              <p className="text-sm font-semibold text-white mb-2">
                                Suggested Subtasks (
                                {generatedTicket.subtasks.length}):
                              </p>
                              <ul className="space-y-2">
                                {generatedTicket.subtasks.map(
                                  (subtask, index) => (
                                    <li
                                      key={index}
                                      className="bg-gray-800 p-3 rounded border border-gray-700"
                                    >
                                      <div className="flex items-start justify-between">
                                        <span className="text-gray-300 flex-1">
                                          {subtask.summary}
                                        </span>
                                        <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-400 ml-2">
                                          {subtask.storyPoints} SP
                                        </span>
                                      </div>
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setCreateSubtasks(true);
                              setShowSubtaskDialog(false);
                            }}
                            className="px-4 py-2 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700 transition-colors"
                          >
                            Yes, Create Subtasks
                          </button>
                          <button
                            onClick={() => {
                              setCreateSubtasks(false);
                              setShowSubtaskDialog(false);
                            }}
                            className="px-4 py-2 bg-gray-700 text-gray-300 font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                          >
                            No, Create as Single Ticket
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-700 flex gap-4">
              <button
                onClick={handleCreateTicket}
                disabled={isCreating}
                style={{ backgroundColor: isCreating ? "" : "#b9ff66" }}
                className="px-6 py-3 text-black font-semibold rounded-lg hover:opacity-90 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {isCreating
                  ? "Creating Ticket..."
                  : createSubtasks &&
                      generatedTicket.subtasks &&
                      generatedTicket.subtasks.length > 0
                    ? `Create Ticket with ${generatedTicket.subtasks.length} Subtasks`
                    : "Create Ticket in Jira"}
              </button>
              <button
                onClick={() => setGeneratedTicket(null)}
                disabled={isCreating}
                className="px-6 py-3 bg-gray-800 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed transition-colors border border-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
