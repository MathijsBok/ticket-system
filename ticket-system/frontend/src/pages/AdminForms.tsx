import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formApi, fieldLibraryApi } from '../lib/api';
import Layout from '../components/Layout';
import { format } from 'date-fns';
import { Form, FormFieldLibrary } from '../types';

const AdminForms: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: urlFormId } = useParams<{ id: string }>();

  // Determine mode from URL
  const isCreating = location.pathname === '/admin/forms/new';
  const editingFormId = urlFormId || null;

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fieldConfigs, setFieldConfigs] = useState<Array<{ fieldId: string; required: boolean }>>([]);
  const [draggedFormIndex, setDraggedFormIndex] = useState<number | null>(null);

  const { data: forms, isLoading: formsLoading } = useQuery({
    queryKey: ['adminForms'],
    queryFn: async () => {
      const response = await formApi.getAll();
      return response.data as Form[];
    }
  });

  const { data: availableFields, isLoading: fieldsLoading } = useQuery({
    queryKey: ['fieldLibrary'],
    queryFn: async () => {
      const response = await fieldLibraryApi.getAll();
      return response.data as FormFieldLibrary[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await formApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Form created successfully');
      queryClient.invalidateQueries({ queryKey: ['adminForms'] });
      navigate('/admin/forms');
    },
    onError: () => {
      toast.error('Failed to create form');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await formApi.update(id, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Form updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminForms'] });
      navigate('/admin/forms');
    },
    onError: () => {
      toast.error('Failed to update form');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await formApi.delete(id);
    },
    onSuccess: () => {
      toast.success('Form deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['adminForms'] });
    },
    onError: () => {
      toast.error('Failed to delete form');
    }
  });

  const reorderMutation = useMutation({
    mutationFn: async (formIds: string[]) => {
      await formApi.reorder(formIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminForms'] });
    },
    onError: () => {
      toast.error('Failed to reorder forms');
    }
  });

  const handleEdit = (form: Form) => {
    // Navigate to the edit URL
    navigate(`/admin/forms/${form.id}`);
  };

  // Populate form when editing (URL changes to /admin/forms/:id)
  useEffect(() => {
    if (editingFormId && forms) {
      const form = forms.find(f => f.id === editingFormId);
      if (form) {
        setFormName(form.name);
        setFormDescription(form.description || '');
        // Extract field configurations in order from formFields
        const configs = form.formFields
          ?.sort((a, b) => a.order - b.order)
          .map(ff => ({ fieldId: ff.fieldId, required: ff.required })) || [];
        setFieldConfigs(configs);
      }
    } else if (!editingFormId && !isCreating) {
      // Reset form when back on list view
      setFormName('');
      setFormDescription('');
      setFieldConfigs([]);
    }
  }, [editingFormId, isCreating, forms]);

  const handleToggleField = (fieldId: string) => {
    if (fieldConfigs.some(config => config.fieldId === fieldId)) {
      setFieldConfigs(fieldConfigs.filter(config => config.fieldId !== fieldId));
    } else {
      setFieldConfigs([...fieldConfigs, { fieldId, required: false }]);
    }
  };

  const handleToggleRequired = (fieldId: string) => {
    setFieldConfigs(fieldConfigs.map(config =>
      config.fieldId === fieldId
        ? { ...config, required: !config.required }
        : config
    ));
  };

  const handleMoveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFieldConfigs = [...fieldConfigs];
    [newFieldConfigs[index - 1], newFieldConfigs[index]] =
      [newFieldConfigs[index], newFieldConfigs[index - 1]];
    setFieldConfigs(newFieldConfigs);
  };

  const handleMoveFieldDown = (index: number) => {
    if (index === fieldConfigs.length - 1) return;
    const newFieldConfigs = [...fieldConfigs];
    [newFieldConfigs[index], newFieldConfigs[index + 1]] =
      [newFieldConfigs[index + 1], newFieldConfigs[index]];
    setFieldConfigs(newFieldConfigs);
  };

  const handleRemoveField = (fieldId: string) => {
    setFieldConfigs(fieldConfigs.filter(config => config.fieldId !== fieldId));
  };

  // Drag and drop handlers
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);

    // Create a custom drag image with solid background
    const target = e.currentTarget as HTMLElement;
    const clone = target.cloneNode(true) as HTMLElement;
    clone.style.backgroundColor = 'hsl(var(--primary))';
    clone.style.color = 'hsl(var(--primary-foreground))';
    clone.style.opacity = '1';
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.width = target.offsetWidth + 'px';
    document.body.appendChild(clone);

    e.dataTransfer.setDragImage(clone, 0, 0);

    // Remove clone after a short delay
    setTimeout(() => document.body.removeChild(clone), 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFieldConfigs = [...fieldConfigs];
    const draggedItem = newFieldConfigs[draggedIndex];

    // Remove from old position
    newFieldConfigs.splice(draggedIndex, 1);
    // Insert at new position
    newFieldConfigs.splice(index, 0, draggedItem);

    setFieldConfigs(newFieldConfigs);
    setDraggedIndex(index);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
  };

  // Drag and drop handlers for forms
  const handleFormDragStart = (e: React.DragEvent, index: number) => {
    setDraggedFormIndex(index);

    // Create a custom drag image with solid background
    const target = e.currentTarget as HTMLElement;
    const clone = target.cloneNode(true) as HTMLElement;
    clone.style.backgroundColor = 'hsl(var(--primary))';
    clone.style.color = 'hsl(var(--primary-foreground))';
    clone.style.opacity = '1';
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.width = target.offsetWidth + 'px';
    document.body.appendChild(clone);

    e.dataTransfer.setDragImage(clone, 0, 0);

    // Remove clone after a short delay
    setTimeout(() => document.body.removeChild(clone), 0);
  };

  const handleFormDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFormIndex === null || draggedFormIndex === index || !forms) return;

    const newForms = [...forms];
    const draggedItem = newForms[draggedFormIndex];

    // Remove from old position
    newForms.splice(draggedFormIndex, 1);
    // Insert at new position
    newForms.splice(index, 0, draggedItem);

    // Update the query cache optimistically
    queryClient.setQueryData(['adminForms'], newForms);
    setDraggedFormIndex(index);
  };

  const handleFormDragEnd = (e: React.DragEvent) => {
    if (draggedFormIndex !== null && forms) {
      // Send the new order to the server
      const formIds = forms.map(form => form.id);
      reorderMutation.mutate(formIds);
    }
    setDraggedFormIndex(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Form name is required');
      return;
    }

    const formData = {
      name: formName,
      description: formDescription,
      fields: fieldConfigs
    };

    if (editingFormId) {
      updateMutation.mutate({ id: editingFormId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isFormOpen = isCreating || editingFormId !== null;

  // Get field details for selected fields with their required status
  const selectedFieldsWithDetails = fieldConfigs
    .map(config => {
      const field = availableFields?.find(f => f.id === config.fieldId);
      return field ? { ...field, required: config.required } : null;
    })
    .filter(Boolean) as (FormFieldLibrary & { required: boolean })[];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Form Management</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Create and manage ticket submission forms
            </p>
          </div>
          {!isFormOpen && (
            <button
              onClick={() => navigate('/admin/forms/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Form
            </button>
          )}
        </div>

        {/* Create/Edit Form */}
        {isFormOpen && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingFormId ? 'Edit Form' : 'Create New Form'}
              </h2>
              <button
                onClick={() => navigate(-1)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to List
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Form Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Technical Support Request"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Brief description of when to use this form"
                />
              </div>

              {/* Field Selection Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Available Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Available Fields
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 max-h-96 overflow-y-auto">
                    {fieldsLoading && (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    )}

                    {availableFields && availableFields.length > 0 ? (
                      <div className="divide-y divide-gray-200 dark:divide-gray-600">
                        {availableFields.map((field) => (
                          <label
                            key={field.id}
                            className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-600/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={fieldConfigs.some(config => config.fieldId === field.id)}
                              onChange={() => handleToggleField(field.id)}
                              className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {field.label}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {field.fieldType}
                                </span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                        No fields available. Create fields in the Field Library first.
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Fields (Ordered) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Selected Fields (Drag to reorder)
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 max-h-96 overflow-y-auto">
                    {selectedFieldsWithDetails.length > 0 ? (
                      <div className="divide-y divide-gray-200 dark:divide-gray-600">
                        {selectedFieldsWithDetails.map((field, index) => (
                          <div
                            key={field.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={(e) => handleDragEnd(e)}
                            className={`flex items-center cursor-move transition-all ${
                              draggedIndex === index
                                ? 'bg-primary text-primary-foreground border-2 border-primary scale-105 shadow-lg opacity-100'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-600/50 border-2 border-transparent opacity-100'
                            }`}
                            style={{
                              paddingLeft: '12px',
                              paddingRight: '12px',
                              paddingTop: '12px',
                              paddingBottom: '12px',
                              gap: '8px'
                            }}
                          >
                            {/* Drag handle icon */}
                            <div style={{
                              flexShrink: 0,
                              width: '20px',
                              minWidth: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={draggedIndex === index ? "#ffffff" : "#4B5563"}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M4 8h16M4 16h16" />
                              </svg>
                            </div>
                            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleMoveFieldUp(index)}
                                disabled={index === 0}
                                className={draggedIndex === index ? "text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveFieldDown(index)}
                                disabled={index === selectedFieldsWithDetails.length - 1}
                                className={draggedIndex === index ? "text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`text-sm font-medium ${draggedIndex === index ? "text-primary-foreground/70" : "text-gray-500 dark:text-gray-400"}`}>
                                  {index + 1}.
                                </span>
                                <div className={`text-sm font-medium truncate ${draggedIndex === index ? "text-primary-foreground" : "text-gray-900 dark:text-white"}`}>
                                  {field.label}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${draggedIndex === index ? "bg-primary-foreground/20 text-primary-foreground" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}`}>
                                  {field.fieldType}
                                </span>
                                <label className="flex items-center gap-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={field.required}
                                    onChange={() => handleToggleRequired(field.id)}
                                    className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                                  />
                                  <span className={`text-xs ${draggedIndex === index ? "text-primary-foreground" : "text-gray-700 dark:text-gray-300"}`}>Required</span>
                                </label>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveField(field.id)}
                              style={{ flexShrink: 0 }}
                              className={draggedIndex === index ? "text-primary-foreground hover:text-primary-foreground/80" : "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"}
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                        No fields selected. Select fields from the left to add them to this form.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {(createMutation.isPending || updateMutation.isPending)
                    ? (editingFormId ? 'Updating...' : 'Creating...')
                    : (editingFormId ? 'Update Form' : 'Create Form')
                  }
                </button>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Existing Forms List */}
        {!isFormOpen && formsLoading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {!isFormOpen && forms && forms.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                  Drag and drop rows to reorder forms
                </span>
              </p>
            </div>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="w-12 px-3 py-3"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fields
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {forms.map((form, index) => (
                  <tr
                    key={form.id}
                    draggable
                    onDragStart={(e) => handleFormDragStart(e, index)}
                    onDragOver={(e) => handleFormDragOver(e, index)}
                    onDragEnd={handleFormDragEnd}
                    onClick={() => handleEdit(form)}
                    className={`cursor-pointer transition-all ${
                      draggedFormIndex === index
                        ? 'bg-primary text-primary-foreground scale-105 shadow-lg opacity-100'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800 opacity-100'
                    }`}
                  >
                    <td className="px-3 py-4">
                      <div className="flex-shrink-0" style={{
                        width: '20px',
                        height: '20px',
                        position: 'relative'
                      }}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={draggedFormIndex === index ? "#ffffff" : "#4B5563"}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0
                          }}
                        >
                          <path d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${draggedFormIndex === index ? "text-primary-foreground" : "text-gray-900 dark:text-white"}`}>
                      {form.name}
                    </td>
                    <td className={`px-6 py-4 text-sm ${draggedFormIndex === index ? "text-primary-foreground/80" : "text-gray-500 dark:text-gray-400"}`}>
                      {form.description || '-'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${draggedFormIndex === index ? "text-primary-foreground" : "text-gray-900 dark:text-white"}`}>
                      {form.formFields?.length || 0} fields
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        draggedFormIndex === index
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : form.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {form.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${draggedFormIndex === index ? "text-primary-foreground/80" : "text-gray-500 dark:text-gray-400"}`}>
                      {format(new Date(form.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(form)}
                          className={`p-1.5 rounded-md transition-colors ${
                            draggedFormIndex === index
                              ? "text-primary-foreground hover:bg-primary-foreground/20"
                              : "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          }`}
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this form?')) {
                              deleteMutation.mutate(form.id);
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors ${
                            draggedFormIndex === index
                              ? "text-primary-foreground hover:bg-primary-foreground/20"
                              : "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          }`}
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isFormOpen && forms && forms.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No forms</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating a new ticket form.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminForms;
