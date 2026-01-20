'use client';

import { useState, useEffect } from 'react';

interface DocumentationItem {
  service: string;
  title: string;
  content: string;
  type: string;
  lastModified?: string;
  pageUrl?: string;
}

interface ConfluenceConfig {
  url: string;
  spaceKey: string;
  user: string;
}

export default function Documentation() {
  const [documentation, setDocumentation] = useState<DocumentationItem[]>([]);
  const [confluenceConfig, setConfluenceConfig] = useState<ConfluenceConfig | null>(null);
  const [microservices, setMicroservices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocumentation();
  }, []);

  const fetchDocumentation = async () => {
    try {
      const response = await fetch('/api/documentation');
      const data = await response.json();
      
      if (data.documentation) {
        setDocumentation(data.documentation);
      }
      if (data.confluenceConfig) {
        setConfluenceConfig(data.confluenceConfig);
      }
      if (data.microservices) {
        setMicroservices(data.microservices);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching documentation:', error);
      setLoading(false);
    }
  };

  const filteredDocs = selectedService === 'all' 
    ? documentation 
    : documentation.filter(doc => doc.service === selectedService);

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-6 md:px-10 lg:px-16 xl:px-24 py-6 md:py-8 lg:py-10">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 md:px-10 lg:px-16 xl:px-24 py-6 md:py-8 lg:py-10">
      <div className="max-w-[1600px] mx-auto">
        <div className="space-y-6 md:space-y-8 lg:space-y-10">
          {/* Header */}
          <div className="bg-dark rounded-2xl md:rounded-3xl px-6 md:px-10 lg:px-14 xl:px-16 py-8 md:py-12 lg:py-14 xl:py-16 text-white shadow-xl">
            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-3 md:mb-4 lg:mb-5 leading-tight">
              <span className="text-primary">Documentation</span>
            </h1>
            <p className="text-sm md:text-base lg:text-lg xl:text-xl text-gray-300 leading-relaxed max-w-4xl">
              Auto-generated project documentation and technical specifications
            </p>
          </div>

          {/* Confluence Integration Info */}
          {confluenceConfig && (
            <div className="bg-gradient-to-r from-dark to-gray-800 rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2">Confluence Integration</h2>
                  <p className="text-sm text-gray-300">View and manage documentation in Confluence</p>
                </div>
                <a 
                  href={confluenceConfig.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary text-dark px-5 py-3 rounded-lg font-bold hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl text-sm md:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Confluence
                </a>
              </div>
            </div>
          )}

          {/* Microservices Filter */}
          <div className="bg-gray-light rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-dark">Microservices Documentation</h2>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedService('all')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                    selectedService === 'all'
                      ? 'bg-primary text-dark shadow-md'
                      : 'bg-white text-dark hover:bg-gray-200'
                  }`}
                >
                  All Services
                </button>
                {microservices.map(service => (
                  <button
                    key={service}
                    onClick={() => setSelectedService(service)}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                      selectedService === service
                        ? 'bg-primary text-dark shadow-md'
                        : 'bg-white text-dark hover:bg-gray-200'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>

            {/* Documentation List */}
            <div className="grid grid-cols-1 gap-4">
              {filteredDocs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray text-lg">No documentation found</p>
                </div>
              ) : (
                filteredDocs.map((doc, index) => (
                  <div key={index} className="bg-white rounded-xl p-5 md:p-6 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-dark mb-1">{doc.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray">
                          <span className="bg-primary text-dark px-3 py-1 rounded-full font-semibold">
                            {doc.service}
                          </span>
                          <span className="bg-gray-200 text-dark px-3 py-1 rounded-full font-medium">
                            {doc.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 bg-gray-light rounded-lg p-4 font-mono whitespace-pre-wrap">
                      {doc.content}...
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-gray">
                        Last modified: {doc.lastModified ? new Date(doc.lastModified).toLocaleDateString() : 'Unknown'}
                      </span>
                      <a
                        href={doc.pageUrl || `${confluenceConfig?.url}/wiki/spaces/${confluenceConfig?.spaceKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 bg-primary text-dark px-4 py-2 rounded-lg font-bold hover:bg-opacity-90 transition-all shadow-sm hover:shadow-md text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View in Confluence
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Getting Started */}
          <div className="bg-gray-light rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-10 xl:p-12 shadow-lg">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-dark mb-4 md:mb-6">Documentation Structure</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5">
                <h3 className="text-lg font-bold text-dark mb-3">📐 Architecture Design</h3>
                <p className="text-sm text-gray-700">
                  High-level system architecture, component interactions, and design patterns for each microservice.
                </p>
              </div>
              <div className="bg-white rounded-xl p-5">
                <h3 className="text-lg font-bold text-dark mb-3">🔍 Detailed Design</h3>
                <p className="text-sm text-gray-700">
                  In-depth technical specifications, class diagrams, and implementation details.
                </p>
              </div>
              <div className="bg-white rounded-xl p-5">
                <h3 className="text-lg font-bold text-dark mb-3">🔌 OpenAPI Specification</h3>
                <p className="text-sm text-gray-700">
                  REST API documentation with endpoints, request/response schemas, and examples.
                </p>
              </div>
              <div className="bg-white rounded-xl p-5">
                <h3 className="text-lg font-bold text-dark mb-3">📝 Auto-Upload</h3>
                <p className="text-sm text-gray-700">
                  Documentation is automatically uploaded to Confluence with hierarchical structure and diagram rendering.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
