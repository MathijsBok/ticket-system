import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { macroApi } from '../lib/api';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import RichTextEditor from '../components/RichTextEditor';
import ConfirmModal from '../components/ConfirmModal';
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
  const { id: macroId } = useParams<{ id: string }>();

  // Determine mode from URL
  const isEditMode = macroId !== undefined && macroId !== 'new';
  const isNewMode = macroId === 'new';
  const isListMode = !macroId;

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'order' | 'name-asc' | 'name-desc'>('name-asc');
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; macro: Macro | null }>({
    isOpen: false,
    macro: null
  });

  // Query for the list of macros (only used on list page)
  const { data: macros, isLoading: isLoadingList } = useQuery({
    queryKey: ['macros'],
    queryFn: async () => {
      const response = await macroApi.getAll();
      return response.data as Macro[];
    },
    enabled: isListMode,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Query for a single macro when editing (separate from the list!)
  const { data: singleMacro, isLoading: isLoadingSingle, isFetched } = useQuery({
    queryKey: ['macro', macroId],
    queryFn: async () => {
      const response = await macroApi.getById(macroId!);
      return response.data as Macro;
    },
    enabled: isEditMode && !!macroId,
    staleTime: 0,
    refetchOnMount: 'always'
  });

  // Form state - initialized from singleMacro when available
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: ''
  });

  // Track if we've initialized from the loaded macro
  const [initializedFromMacro, setInitializedFromMacro] = useState<string | null>(null);

  // Track new category input
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Category dropdown state
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Query for all categories (needed on edit/new pages)
  const { data: allMacrosForCategories } = useQuery({
    queryKey: ['macros-categories'],
    queryFn: async () => {
      const response = await macroApi.getAll();
      return response.data as Macro[];
    },
    enabled: isEditMode || isNewMode,
    staleTime: 60000 // Cache for 1 minute
  });

  // Get unique categories from all macros
  const allCategories = allMacrosForCategories
    ? [...new Set(allMacrosForCategories.filter(m => m.category).map(m => m.category!.toUpperCase()))].sort()
    : [];

  // Populate form when single macro data is loaded
  useEffect(() => {
    if (isEditMode && singleMacro && initializedFromMacro !== singleMacro.id) {
      setFormData({
        name: singleMacro.name,
        content: singleMacro.content,
        category: singleMacro.category?.toUpperCase() || ''
      });
      setInitializedFromMacro(singleMacro.id);
      setNewCategoryInput('');
      setIsCategoryDropdownOpen(false);
    }
  }, [isEditMode, singleMacro, initializedFromMacro]);

  // Reset form and tracking when entering new mode or going back to list
  useEffect(() => {
    if (isNewMode || isListMode) {
      setFormData({ name: '', content: '', category: '' });
      setInitializedFromMacro(null);
      setNewCategoryInput('');
      setIsCategoryDropdownOpen(false);
    }
  }, [isNewMode, isListMode]);

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
      queryClient.invalidateQueries({ queryKey: ['macro', macroId] });
      navigate('/admin/macros');
    },
    onError: () => {
      toast.error('Failed to update macro');
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      macroApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['macros'] });
    },
    onError: () => {
      toast.error('Failed to update macro status');
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

    const categoryValue = formData.category.trim().toUpperCase();
    const data = {
      name: formData.name.trim(),
      content: formData.content.trim(),
      category: categoryValue || undefined
    };

    if (isEditMode && macroId) {
      updateMutation.mutate({ id: macroId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (macro: Macro) => {
    navigate(`/admin/macros/${macro.id}`);
  };

  const handleDelete = (macro: Macro) => {
    setDeleteModal({ isOpen: true, macro });
  };

  const confirmDelete = () => {
    if (deleteModal.macro) {
      deleteMutation.mutate(deleteModal.macro.id);
    }
    setDeleteModal({ isOpen: false, macro: null });
  };

  const cancelDelete = () => {
    setDeleteModal({ isOpen: false, macro: null });
  };

  const handleToggleActive = (macro: Macro) => {
    toggleActiveMutation.mutate({
      id: macro.id,
      isActive: !macro.isActive
    });
  };

  const insertPlaceholder = (placeholder: string) => {
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

  // Count active/inactive macros for tabs
  const activeMacrosCount = macros?.filter(m => m.isActive).length || 0;
  const inactiveMacrosCount = macros?.filter(m => !m.isActive).length || 0;

  // Get macros for the current tab
  const macrosInCurrentTab = macros?.filter(m => activeTab === 'active' ? m.isActive : !m.isActive) || [];

  // Get unique categories for display (filtered by current tab)
  const categories = [...new Set(macrosInCurrentTab.filter(m => m.category).map(m => m.category!))].sort();

  // Reset category filter when switching tabs if current category doesn't exist in new tab
  useEffect(() => {
    if (categoryFilter !== 'all' && categoryFilter !== 'uncategorized') {
      const categoryExistsInTab = macrosInCurrentTab.some(m => m.category === categoryFilter);
      if (!categoryExistsInTab) {
        setCategoryFilter('all');
      }
    }
  }, [activeTab, macrosInCurrentTab, categoryFilter]);

  // Filter macros by tab, category and search query
  const filteredMacros = macros?.filter(macro => {
    // Filter by active tab
    const matchesActiveTab = activeTab === 'active' ? macro.isActive : !macro.isActive;

    const matchesCategory =
      categoryFilter === 'all' ? true :
      categoryFilter === 'uncategorized' ? !macro.category :
      macro.category === categoryFilter;

    const matchesSearch = !searchQuery ||
      macro.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (macro.category && macro.category.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesActiveTab && matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'name-desc') {
      return b.name.localeCompare(a.name);
    }
    return a.order - b.order;
  });

  // Show loading when editing and waiting for single macro data OR form not yet populated
  if (isEditMode && (isLoadingSingle || (singleMacro && initializedFromMacro !== singleMacro.id))) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading macro...</p>
        </div>
      </Layout>
    );
  }

  // Show error if macro not found
  if (isEditMode && isFetched && !singleMacro) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Macro not found</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">The macro you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/admin/macros')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90"
          >
            Back to Macros
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        {(isEditMode || isNewMode) ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/macros')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Back to Macros"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {isEditMode ? 'Edit Macro' : 'Create New Macro'}
                </h1>
                {isEditMode && singleMacro && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {singleMacro.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/macros')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="macro-form"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : isEditMode
                  ? 'Update Macro'
                  : 'Create Macro'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Macros</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Create pre-built reply templates for agents to use
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/macros/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Macro
            </button>
          </div>
        )}

        {/* Create/Edit Form */}
        {(isEditMode || isNewMode) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <form id="macro-form" key={macroId || 'new'} onSubmit={handleSubmit} className="space-y-5">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category <span className="text-gray-400">(optional)</span>
                  </label>
                  <div className="relative" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="w-full px-3 py-2 text-left border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent flex items-center justify-between"
                    >
                      <span className={formData.category ? '' : 'text-gray-400 dark:text-gray-500'}>
                        {formData.category || 'Select category'}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isCategoryDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, category: '' });
                            setIsCategoryDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            !formData.category ? 'bg-primary/10 text-primary' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          No category
                        </button>
                        {allCategories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, category: cat });
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              formData.category === cat ? 'bg-primary/10 text-primary' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Select an existing category
                  </p>
                </div>

                {/* New Category Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Or create new
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value.toUpperCase())}
                      placeholder="NEW CATEGORY"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent uppercase placeholder:normal-case"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCategoryInput.trim()) {
                          setFormData({ ...formData, category: newCategoryInput.trim().toUpperCase() });
                          setNewCategoryInput('');
                        }
                      }}
                      disabled={!newCategoryInput.trim()}
                      className="px-3 py-2 text-sm font-medium text-white bg-primary rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Use
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Type and click Use to set
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Content <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                  <div className="lg:col-span-2">
                    <RichTextEditor
                      value={formData.content}
                      onChange={(value) => setFormData({ ...formData, content: value })}
                      placeholder="Enter the macro content here. This text will be inserted into the reply field when an agent selects this macro."
                      minHeight="320px"
                    />
                  </div>
                  <div className="lg:col-span-1 flex">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600 p-4 w-full min-h-[320px] max-h-fit overflow-y-auto">
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
            </form>
          </div>
        )}

        {/* Tabs (List mode only) */}
        {isListMode && macros && macros.length > 0 && (
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex gap-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('active')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'active'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Active
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'active'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {activeMacrosCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('inactive')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'inactive'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Inactive
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'inactive'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {inactiveMacrosCount}
                </span>
              </button>
            </nav>
          </div>
        )}

        {/* Search and Filter Bar (List mode only) */}
        {isListMode && macros && macros.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search macros..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            {categories.length > 0 && (
              <CustomSelect
                value={categoryFilter}
                onChange={(v) => setCategoryFilter(v)}
                options={[
                  { value: 'all', label: `All Categories (${macrosInCurrentTab.length})` },
                  ...categories.map((category) => ({
                    value: category,
                    label: `${category} (${macrosInCurrentTab.filter(m => m.category === category).length})`,
                  })),
                  ...(macrosInCurrentTab.some(m => !m.category) ? [{
                    value: 'uncategorized',
                    label: `Uncategorized (${macrosInCurrentTab.filter(m => !m.category).length})`,
                  }] : []),
                ]}
                size="sm"
              />
            )}

            {/* Sort Dropdown */}
            <CustomSelect
              value={sortBy}
              onChange={(v) => setSortBy(v as 'order' | 'name-asc' | 'name-desc')}
              options={[
                { value: 'order', label: 'Sort by Order' },
                { value: 'name-asc', label: 'Name A-Z' },
                { value: 'name-desc', label: 'Name Z-A' },
              ]}
              size="sm"
            />
          </div>
        )}

        {/* Macros List (List mode only) */}
        {isListMode && (isLoadingList ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading macros...</p>
          </div>
        ) : filteredMacros && filteredMacros.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[minmax(200px,1fr)_minmax(200px,2fr)_100px_80px_80px] gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div>Name</div>
              <div>Content Preview</div>
              <div>Category</div>
              <div className="text-center">Status</div>
              <div className="text-center">Actions</div>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMacros.map((macro) => (
                <div
                  key={macro.id}
                  onClick={() => handleEdit(macro)}
                  className="grid grid-cols-[minmax(200px,1fr)_minmax(200px,2fr)_100px_80px_80px] gap-4 items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  {/* Name */}
                  <div className="min-w-0">
                    <span className={`text-sm font-medium truncate block ${!macro.isActive ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {macro.name}
                    </span>
                  </div>

                  {/* Content Preview */}
                  <div className="min-w-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate block">
                      {(() => {
                        const text = macro.content
                          .replace(/<[^>]*>/g, ' ')
                          .replace(/&nbsp;/g, ' ')
                          .replace(/&amp;/g, '&')
                          .replace(/&lt;/g, '<')
                          .replace(/&gt;/g, '>')
                          .replace(/&quot;/g, '"')
                          .replace(/&#39;/g, "'")
                          .replace(/\s+/g, ' ')
                          .trim();
                        return text.length > 100 ? text.substring(0, 100) + '...' : text;
                      })()}
                    </span>
                  </div>

                  {/* Category */}
                  <div className="min-w-0">
                    {macro.category ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 max-w-full truncate">
                        {macro.category}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </div>

                  {/* Status Toggle */}
                  <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(macro)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                        macro.isActive
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      title={macro.isActive ? 'Click to deactivate' : 'Click to activate'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          macro.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(macro);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(macro);
                      }}
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
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Macro"
        message={`Are you sure you want to delete "${deleteModal.macro?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </Layout>
  );
};

export default AdminMacros;
