import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { useParams, useNavigate } from 'react-router-dom';
import { bugApi } from '../lib/api';
import { Bug } from '../types';
import Layout from '../components/Layout';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const AdminBugs: React.FC = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userRole = (user?.publicMetadata?.role as string) || 'USER';
  const isAdmin = userRole === 'ADMIN';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Determine state from URL
  const showAddForm = id === 'new';
  const expandedBugId = id && id !== 'new' ? id : null;

  const { data: bugs, isLoading, error } = useQuery({
    queryKey: ['bugs'],
    queryFn: async () => {
      const response = await bugApi.getAll();
      return response.data as Bug[];
    }
  });

  const createBugMutation = useMutation({
    mutationFn: (data: { title: string; description: string }) => bugApi.create(data),
    onSuccess: () => {
      toast.success('Bug reported successfully');
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      navigate('/admin/bugs');
      setTitle('');
      setDescription('');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to report bug';
      toast.error(message);
    }
  });

  const solveBugMutation = useMutation({
    mutationFn: (id: string) => bugApi.solve(id),
    onSuccess: () => {
      toast.success('Bug marked as solved');
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to solve bug';
      toast.error(message);
    }
  });

  const reopenBugMutation = useMutation({
    mutationFn: (id: string) => bugApi.reopen(id),
    onSuccess: () => {
      toast.success('Bug reopened');
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to reopen bug';
      toast.error(message);
    }
  });

  const deleteBugMutation = useMutation({
    mutationFn: (bugId: string) => bugApi.delete(bugId),
    onSuccess: (_data, deletedBugId) => {
      toast.success('Bug deleted');
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      // Navigate back to list if the deleted bug was being viewed
      if (deletedBugId === expandedBugId) {
        navigate('/admin/bugs');
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to delete bug';
      toast.error(message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    createBugMutation.mutate({ title: title.trim(), description: description.trim() });
  };

  const getUserName = (reportedBy: Bug['reportedBy']) => {
    if (reportedBy.firstName || reportedBy.lastName) {
      return `${reportedBy.firstName || ''} ${reportedBy.lastName || ''}`.trim();
    }
    return reportedBy.email;
  };

  const openBugs = bugs?.filter(bug => bug.status === 'OPEN') || [];
  const solvedBugs = bugs?.filter(bug => bug.status === 'SOLVED') || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bug Reports</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Report and track bugs found in the application
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/bugs/new')}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Report Bug
          </button>
        </div>

        {/* Add Bug Form */}
        {showAddForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Report a Bug</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bug Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief description of the bug"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Detailed explanation of the bug, steps to reproduce, expected vs actual behavior..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/admin/bugs');
                    setTitle('');
                    setDescription('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBugMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {createBugMutation.isPending ? 'Submitting...' : 'Submit Bug Report'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading bugs...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">Failed to load bugs. Please try again.</p>
          </div>
        )}

        {/* Open Bugs */}
        {!isLoading && !error && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Open Bugs</h2>
              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm font-semibold rounded-full">
                {openBugs.length}
              </span>
            </div>

            {openBugs.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No open bugs</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Great job! There are no open bugs at the moment.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {openBugs.map((bug) => (
                  <div
                    key={bug.id}
                    className={`rounded-lg border overflow-hidden ${
                      expandedBugId === bug.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      onClick={() => navigate(expandedBugId === bug.id ? '/admin/bugs' : `/admin/bugs/${bug.id}`)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                              OPEN
                            </span>
                            <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                              {bug.title}
                            </h3>
                          </div>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Reported by {getUserName(bug.reportedBy)} on {format(new Date(bug.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  solveBugMutation.mutate(bug.id);
                                }}
                                disabled={solveBugMutation.isPending}
                                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors disabled:opacity-50"
                                title="Mark as solved"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Are you sure you want to delete this bug?')) {
                                    deleteBugMutation.mutate(bug.id);
                                  }
                                }}
                                disabled={deleteBugMutation.isPending}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
                                title="Delete bug"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${expandedBugId === bug.id ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    {expandedBugId === bug.id && (
                      <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="pt-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {bug.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Solved Bugs */}
        {!isLoading && !error && solvedBugs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Solved Bugs</h2>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-semibold rounded-full">
                {solvedBugs.length}
              </span>
            </div>

            <div className="space-y-3">
              {solvedBugs.map((bug) => (
                <div
                  key={bug.id}
                  className={`rounded-lg border overflow-hidden ${
                    expandedBugId === bug.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-75'
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => navigate(expandedBugId === bug.id ? '/admin/bugs' : `/admin/bugs/${bug.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                            SOLVED
                          </span>
                          <h3 className="text-base font-medium text-gray-900 dark:text-white truncate line-through">
                            {bug.title}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Reported by {getUserName(bug.reportedBy)} on {format(new Date(bug.createdAt), 'MMM d, yyyy')}
                          {bug.solvedBy && bug.solvedAt && (
                            <> | Solved by {getUserName(bug.solvedBy)} on {format(new Date(bug.solvedAt), 'MMM d, yyyy')}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                reopenBugMutation.mutate(bug.id);
                              }}
                              disabled={reopenBugMutation.isPending}
                              className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md transition-colors disabled:opacity-50"
                              title="Reopen bug"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this bug?')) {
                                  deleteBugMutation.mutate(bug.id);
                                }
                              }}
                              disabled={deleteBugMutation.isPending}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
                              title="Delete bug"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${expandedBugId === bug.id ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {expandedBugId === bug.id && (
                    <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="pt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                          {bug.description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminBugs;
