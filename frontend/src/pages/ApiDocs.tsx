import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiInfo {
  keyName: string;
  formRestriction: string | null;
  forms: Array<{ id: string; name: string; description: string | null }>;
  fields: Array<{
    id: string;
    label: string;
    fieldType: string;
    required: boolean;
    options: any;
    placeholder: string | null;
  }>;
}

const ApiDocs: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [submittedKey, setSubmittedKey] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const { data: apiInfo, isLoading, isError } = useQuery({
    queryKey: ['apiDocs', submittedKey],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/v1/docs`, {
        headers: { Authorization: `Bearer ${submittedKey}` }
      });
      return response.data as ApiInfo;
    },
    enabled: !!submittedKey,
    retry: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    setError('');
    setSubmittedKey(apiKey.trim());
  };

  const handleReset = () => {
    setApiKey('');
    setSubmittedKey('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Documentation</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">External API for ticket submission</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* API Key Input */}
        {!submittedKey || isError ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Enter your API Key
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Provide your API key to view the documentation and available endpoints.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="klv_..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {(error || isError) && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {error || 'Invalid API key. Please check your key and try again.'}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? 'Validating...' : 'View Documentation'}
              </button>
            </form>
          </div>
        ) : (
          /* Documentation Content */
          <div className="space-y-8">
            {/* Key Info */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      Authenticated as: {apiInfo?.keyName}
                    </p>
                    {apiInfo?.formRestriction && (
                      <p className="text-xs text-green-700 dark:text-green-400">
                        Restricted to form: {apiInfo.formRestriction}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm text-green-700 dark:text-green-400 hover:underline"
                >
                  Use different key
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Base URL</h2>
              <code className="block px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg text-primary font-mono">
                {window.location.origin}/api/v1
              </code>
            </div>

            {/* Authentication */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Authentication</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Include your API key in the Authorization header for all requests:
              </p>
              <pre className="px-4 py-3 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-sm font-mono">
Authorization: Bearer {submittedKey.substring(0, 16)}...
              </pre>
            </div>

            {/* Endpoints */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Endpoints</h2>

              <div className="space-y-6">
                {/* GET /forms */}
                <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white">/forms</code>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    List all available forms for ticket submission.
                  </p>
                  <details>
                    <summary className="text-sm text-primary cursor-pointer hover:underline">View response example</summary>
                    <pre className="mt-2 px-4 py-3 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-xs font-mono">
{JSON.stringify(apiInfo?.forms?.slice(0, 2) || [], null, 2)}
                    </pre>
                  </details>
                </div>

                {/* GET /forms/:formId/schema */}
                <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white">/forms/:formId/schema</code>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Get the full schema of a form including all field definitions.
                  </p>
                </div>

                {/* GET /fields */}
                <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white">/fields</code>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    List all fields from the field library.
                  </p>
                  <details>
                    <summary className="text-sm text-primary cursor-pointer hover:underline">View response example ({apiInfo?.fields?.length || 0} fields available)</summary>
                    <pre className="mt-2 px-4 py-3 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-xs font-mono max-h-64 overflow-y-auto">
{JSON.stringify(apiInfo?.fields?.slice(0, 5) || [], null, 2)}
{(apiInfo?.fields?.length || 0) > 5 ? '\n// ... and more' : ''}
                    </pre>
                  </details>
                </div>

                {/* GET /fields/:fieldId */}
                <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white">/fields/:fieldId</code>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Get a specific field by ID.
                  </p>
                </div>

                {/* POST /tickets */}
                <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">POST</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white">/tickets</code>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Create a new ticket. Only email, subject, and description are required.
                  </p>
                  <details>
                    <summary className="text-sm text-primary cursor-pointer hover:underline">View request body</summary>
                    <pre className="mt-2 px-4 py-3 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-xs font-mono">
{`{
  "email": "user@example.com",        // Required - user email
  "subject": "Issue title",           // Required - ticket subject
  "description": "Issue details...",  // Required - ticket description
  "formId": "uuid-of-form",           // Optional - associate with a form
  "formResponses": [                  // Optional - form field values
    { "fieldId": "uuid", "value": "Field value" }
  ],
  "priority": "NORMAL",               // Optional - LOW, NORMAL, HIGH, URGENT
  "country": "US",                    // Optional - country code
  "userAgent": "MyApp/1.0"            // Optional - client info
}`}
                    </pre>
                  </details>
                  <details className="mt-2">
                    <summary className="text-sm text-primary cursor-pointer hover:underline">View response example</summary>
                    <pre className="mt-2 px-4 py-3 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-xs font-mono">
{`{
  "success": true,
  "ticket": {
    "id": "uuid",
    "ticketNumber": 12345,
    "subject": "Issue title",
    "status": "NEW",
    "priority": "NORMAL",
    "channel": "API",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}`}
                    </pre>
                  </details>
                </div>

                {/* GET /tickets/:ticketNumber */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">GET</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white">/tickets/:ticketNumber</code>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Get ticket status by ticket number.
                  </p>
                  <details>
                    <summary className="text-sm text-primary cursor-pointer hover:underline">View response example</summary>
                    <pre className="mt-2 px-4 py-3 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-xs font-mono">
{`{
  "ticketNumber": 12345,
  "subject": "Issue title",
  "status": "OPEN",
  "priority": "NORMAL",
  "requesterEmail": "user@example.com",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z",
  "solvedAt": null
}`}
                    </pre>
                  </details>
                </div>
              </div>
            </div>

            {/* Response Codes */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Response Codes</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">200</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Success</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">201</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Created</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">400</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Bad Request</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">401</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Unauthorized</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">403</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Forbidden</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">404</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Not Found</span>
                </div>
              </div>
            </div>

            {/* Available Forms & Fields - 2 column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Available Forms */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Available Forms ({apiInfo?.forms?.length || 0})
                </h2>
                {apiInfo?.forms && apiInfo.forms.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {apiInfo.forms.map((form) => (
                      <div key={form.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">{form.name}</h3>
                            {form.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{form.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => copyToClipboard(form.id)}
                            className="text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                            title="Click to copy full ID"
                          >
                            {copiedId === form.id ? (
                              <>
                                <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                {form.id.substring(0, 8)}...
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No forms available</p>
                )}
              </div>

              {/* Available Fields */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Available Fields ({apiInfo?.fields?.length || 0})
                </h2>
                {apiInfo?.fields && apiInfo.fields.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {apiInfo.fields.map((field) => (
                      <div key={field.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900 dark:text-white text-sm">{field.label}</h3>
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                                {field.fieldType}
                              </span>
                              {field.required && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                                  required
                                </span>
                              )}
                            </div>
                            {field.placeholder && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                Placeholder: {field.placeholder}
                              </p>
                            )}
                            {field.options && Array.isArray(field.options) && field.options.length > 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                Options: {field.options.join(', ')}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => copyToClipboard(field.id)}
                            className="text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                            title="Click to copy full ID"
                          >
                            {copiedId === field.id ? (
                              <>
                                <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                {field.id.substring(0, 8)}...
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No fields available</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiDocs;
