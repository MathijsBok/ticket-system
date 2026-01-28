import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { macroApi } from '../lib/api';
import Layout from '../components/Layout';
import RichTextEditor from '../components/RichTextEditor';
import toast from 'react-hot-toast';
import { Macro } from '../types';

const PLACEHOLDERS = [
  { key: '{{userName}}', description: 'The name of the ticket requester' },
  { key: '{{ticketNumber}}', description: 'The ticket number (e.g., 12345)' },
  { key: '{{ticketSubject}}', description: 'The subject line of the ticket' },
  { key: '{{ticketUrl}}', description: 'Direct link to view the ticket' },
  { key: '{{agentName}}', description: 'The name of the assigned agent' },
];

const AdminMacros: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: urlMacroId } = useParams<{ id: string }>();

  // Determine mode from URL
  const isCreating = location.pathname === '/admin/macros/new' || urlMacroId !== undefined;
  const editingMacroId = urlMacroId || null;

  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: ''
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

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
      navigate('/admin/macros');
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
      navigate('/admin/macros');
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

    if (editingMacroId) {
      updateMutation.mutate({ id: editingMacroId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (macro: Macro) => {
    // Navigate to the edit URL
    navigate(`/admin/macros/${macro.id}`);
  };

  // Populate form when editing (URL changes to /admin/macros/:id)
  useEffect(() => {
    if (editingMacroId && macros) {
      const macro = macros.find(m => m.id === editingMacroId);
      if (macro) {
        setFormData({
          name: macro.name,
          content: macro.content,
          category: macro.category || ''
        });
      }
    } else if (!editingMacroId && location.pathname === '/admin/macros') {
      // Reset form when back on list view
      setFormData({ name: '', content: '', category: '' });
    }
  }, [editingMacroId, macros, location.pathname]);

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

  const insertPlaceholder = (placeholder: string) => {
    // For rich text editor, we append the placeholder to the content
    // Remove trailing </p> tag if present to insert before it, or just append
    let currentContent = formData.content;
    if (currentContent.endsWith('</p>')) {
      currentContent = currentContent.slice(0, -4) + placeholder + '</p>';
    } else if (currentContent === '' || currentContent === '<p><br></p>') {
      currentContent = `<p>${placeholder}</p>`;
    } else {
      currentContent = currentContent + placeholder;
    }
    setFormData({ ...formData, content: currentContent });
  };

  // Get unique categories for display
  const categories = macros
    ? [...new Set(macros.filter(m => m.category).map(m => m.category!))].sort()
    : [];

  // Filter macros by category
  const filteredMacros = macros?.filter(macro => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'uncategorized') return !macro.category;
    return macro.category === categoryFilter;
  });

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
              onClick={() => navigate('/admin/macros/new')}
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
              {editingMacroId ? 'Edit Macro' : 'Create New Macro'}
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <RichTextEditor
                      value={formData.content}
                      onChange={(value) => setFormData({ ...formData, content: value })}
                      placeholder="Enter the macro content here. This text will be inserted into the reply field when an agent selects this macro."
                      minHeight="200px"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600 p-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Available Placeholders
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Click to insert into content
                      </p>
                      <div className="space-y-2">
                        {PLACEHOLDERS.map((placeholder) => (
                          <button
                            key={placeholder.key}
                            type="button"
                            onClick={() => insertPlaceholder(placeholder.key)}
                            className="w-full text-left p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"
                          >
                            <code className="text-xs font-mono text-primary group-hover:text-primary/80">
                              {placeholder.key}
                            </code>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {placeholder.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
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
                    : editingMacroId
                    ? 'Update Macro'
                    : 'Create Macro'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Category Tabs */}
        {!isCreating && macros && macros.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              All ({macros.length})
            </button>
            {categories.map((category) => {
              const count = macros.filter(m => m.category === category).length;
              return (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    categoryFilter === category
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {category} ({count})
                </button>
              );
            })}
            {macros.some(m => !m.category) && (
              <button
                onClick={() => setCategoryFilter('uncategorized')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  categoryFilter === 'uncategorized'
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Uncategorized ({macros.filter(m => !m.category).length})
              </button>
            )}
          </div>
        )}

        {/* Macros List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading macros...</p>
          </div>
        ) : filteredMacros && filteredMacros.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMacros.map((macro) => (
                <div
                  key={macro.id}
                  onClick={() => handleEdit(macro)}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                    !macro.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="w-28 flex-shrink-0">
                      {macro.category ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {macro.category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {macro.name}
                    </span>
                    {!macro.isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 flex-shrink-0 ml-2">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(macro)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleToggleActive(macro)}
                      className={`p-1.5 rounded-md transition-colors ${
                        macro.isActive
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title={macro.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {macro.isActive ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(macro)}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : macros && macros.length > 0 && filteredMacros?.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No macros in this category</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try selecting a different category or create a new macro.
            </p>
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
              onClick={() => navigate('/admin/macros/new')}
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
