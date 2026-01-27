import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { macroApi } from '../lib/api';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import { Macro } from '../types';

const AdminMacros: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingMacro, setEditingMacro] = useState<Macro | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: ''
  });

  const { data: macros, isLoading } = useQuery({
    queryKey: ['macros'],
    queryFn: async () => {
      const response = await macroApi.getAll();
      return response.data as Macro[];
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; content: string; category?: string }) =>
      macroApi.create(data),
    onSuccess: () => {
      toast.success('Macro created successfully');
      queryClient.invalidateQueries({ queryKey: ['macros'] });
      resetForm();
    },
    onError: () => {
      toast.error('Failed to create macro');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; content?: string; category?: string; isActive?: boolean } }) =>
      macroApi.update(id, data),
    onSuccess: () => {
      toast.success('Macro updated successfully');
      queryClient.invalidateQueries({ queryKey: ['macros'] });
      resetForm();
    },
    onError: () => {
      toast.error('Failed to update macro');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => macroApi.delete(id),
    onSuccess: () => {
      toast.success('Macro deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['macros'] });
    },
    onError: () => {
      toast.error('Failed to delete macro');
    }
  });

  const resetForm = () => {
    setFormData({ name: '', content: '', category: '' });
    setIsCreating(false);
    setEditingMacro(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Name and content are required');
      return;
    }

    const data = {
      name: formData.name.trim(),
      content: formData.content.trim(),
      category: formData.category.trim() || undefined
    };

    if (editingMacro) {
      updateMutation.mutate({ id: editingMacro.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (macro: Macro) => {
    setEditingMacro(macro);
    setFormData({
      name: macro.name,
      content: macro.content,
      category: macro.category || ''
    });
    setIsCreating(true);
  };

  const handleDelete = (macro: Macro) => {
    if (window.confirm(`Are you sure you want to delete "${macro.name}"?`)) {
      deleteMutation.mutate(macro.id);
    }
  };

  const handleToggleActive = (macro: Macro) => {
    updateMutation.mutate({
      id: macro.id,
      data: { isActive: !macro.isActive }
    });
  };

  // Get unique categories for display
  const categories = macros
    ? [...new Set(macros.filter(m => m.category).map(m => m.category!))]
    : [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Macros</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Create pre-built reply templates for agents to use
            </p>
          </div>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Macro
            </button>
          )}
        </div>

        {/* Create/Edit Form */}
        {isCreating && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingMacro ? 'Edit Macro' : 'Create New Macro'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Greeting, Closing, Troubleshooting Steps"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., General, Billing, Technical"
                  list="categories"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <datalist id="categories">
                  {categories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Categorize macros for easier organization
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter the macro content here. This text will be inserted into the reply field when an agent selects this macro."
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingMacro
                    ? 'Update Macro'
                    : 'Create Macro'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Macros List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading macros...</p>
          </div>
        ) : macros && macros.length > 0 ? (
          <div className="grid gap-4">
            {macros.map((macro) => (
              <div
                key={macro.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border ${
                  macro.isActive
                    ? 'border-gray-200 dark:border-gray-700'
                    : 'border-gray-200 dark:border-gray-700 opacity-60'
                } p-4`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                        {macro.name}
                      </h3>
                      {macro.category && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {macro.category}
                        </span>
                      )}
                      {!macro.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 whitespace-pre-wrap">
                      {macro.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(macro)}
                      className={`p-2 rounded-md transition-colors ${
                        macro.isActive
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title={macro.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {macro.isActive ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEdit(macro)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                      title="Edit"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(macro)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No macros</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating a new macro.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Macro
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminMacros;
