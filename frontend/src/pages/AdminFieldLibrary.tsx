import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fieldLibraryApi } from '../lib/api';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import ConfirmModal from '../components/ConfirmModal';
import { format } from 'date-fns';
import { FormFieldLibrary } from '../types';

const AdminFieldLibrary: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: urlFieldId } = useParams<{ id: string }>();

  // Determine mode from URL
  const isCreating = location.pathname === '/admin/fields/new';
  const editingFieldId = urlFieldId || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form state
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'textarea' | 'select' | 'checkbox' | 'radio'>('text');
  const [required, setRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; fieldId: string | null }>({ isOpen: false, fieldId: null });

  const { data: fields, isLoading } = useQuery({
    queryKey: ['fieldLibrary'],
    queryFn: async () => {
      const response = await fieldLibraryApi.getAll();
      return response.data as FormFieldLibrary[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fieldLibraryApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Field created successfully');
      queryClient.invalidateQueries({ queryKey: ['fieldLibrary'] });
      navigate('/admin/fields');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create field');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fieldLibraryApi.update(id, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Field updated successfully');
      queryClient.invalidateQueries({ queryKey: ['fieldLibrary'] });
      navigate('/admin/fields');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update field');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fieldLibraryApi.delete(id);
    },
    onSuccess: () => {
      toast.success('Field deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['fieldLibrary'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete field');
    }
  });


  const handleEdit = (field: FormFieldLibrary) => {
    // Navigate to the edit URL
    navigate(`/admin/fields/${field.id}`);
  };

  // Populate form when editing a field (URL changes to /admin/fields/:id)
  useEffect(() => {
    if (editingFieldId && fields) {
      const field = fields.find(f => f.id === editingFieldId);
      if (field) {
        setLabel(field.label);
        setFieldType(field.fieldType);
        setRequired(field.required);
        setPlaceholder(field.placeholder || '');
        setDefaultValue(field.defaultValue || '');
        setOptions(field.options || []);
      }
    } else if (!editingFieldId && !isCreating) {
      // Reset form when back on list view
      setLabel('');
      setFieldType('text');
      setRequired(false);
      setPlaceholder('');
      setDefaultValue('');
      setOptions([]);
      setOptionInput('');
    }
  }, [editingFieldId, isCreating, fields]);

  const handleAddOption = () => {
    if (optionInput.trim()) {
      setOptions([...options, optionInput.trim()]);
      setOptionInput('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleEditOption = (index: number, newValue: string) => {
    const newOptions = [...options];
    newOptions[index] = newValue;
    setOptions(newOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('Field label is required');
      return;
    }

    // Validate options for select/radio/checkbox
    if (['select', 'radio', 'checkbox'].includes(fieldType) && options.length === 0) {
      toast.error(`${fieldType} fields require at least one option`);
      return;
    }

    const fieldData = {
      label,
      fieldType,
      required,
      placeholder: placeholder || undefined,
      defaultValue: defaultValue || undefined,
      options: ['select', 'radio', 'checkbox'].includes(fieldType) ? options : undefined
    };

    if (editingFieldId) {
      updateMutation.mutate({ id: editingFieldId, data: fieldData });
    } else {
      createMutation.mutate(fieldData);
    }
  };

  const isFormOpen = isCreating || editingFieldId !== null;
  const requiresOptions = ['select', 'radio', 'checkbox'].includes(fieldType);

  // Get color classes for field type badge
  const getFieldTypeColor = (type: string) => {
    switch (type) {
      case 'text':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'textarea':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'select':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'checkbox':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'radio':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Filter and sort fields alphabetically by label
  const filteredFields = fields
    ?.filter(field => {
      const matchesSearch = field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.fieldType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || field.fieldType === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Field Library</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Create and manage reusable form fields
            </p>
          </div>
          {!isFormOpen && (
            <button
              onClick={() => navigate('/admin/fields/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Field
            </button>
          )}
        </div>

        {/* Search and Filter Bar */}
        {!isFormOpen && fields && fields.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search fields by name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Type:
                </label>
                <CustomSelect
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v)}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'text', label: 'Text' },
                    { value: 'textarea', label: 'Textarea' },
                    { value: 'select', label: 'Select' },
                    { value: 'checkbox', label: 'Checkbox' },
                    { value: 'radio', label: 'Radio' },
                  ]}
                  size="sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Form */}
        {isFormOpen && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingFieldId ? 'Edit Field' : 'Create New Field'}
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Field Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Email Address"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Field Type <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    value={fieldType}
                    onChange={(v) => setFieldType(v as any)}
                    options={[
                      { value: 'text', label: 'Text' },
                      { value: 'textarea', label: 'Textarea' },
                      { value: 'select', label: 'Select' },
                      { value: 'checkbox', label: 'Checkbox' },
                      { value: 'radio', label: 'Radio' },
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={placeholder}
                    onChange={(e) => setPlaceholder(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Value
                  </label>
                  <input
                    type="text"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Optional default value"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Required Field
                  </span>
                </label>
              </div>

              {/* Options for Select/Radio/Checkbox */}
              {requiresOptions && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Options <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={optionInput}
                        onChange={(e) => setOptionInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddOption();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Enter option and press Enter or click Add"
                      />
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm font-medium"
                      >
                        Add
                      </button>
                    </div>

                    {options.length > 0 && (
                      <div className="space-y-2">
                        {options.map((option, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2"
                          >
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 w-6">
                              {index + 1}.
                            </span>
                            {editingOptionIndex === index ? (
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => handleEditOption(index, e.target.value)}
                                onBlur={() => setEditingOptionIndex(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setEditingOptionIndex(null);
                                  if (e.key === 'Escape') setEditingOptionIndex(null);
                                }}
                                autoFocus
                                className="flex-1 px-3 py-2 border border-primary rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                              />
                            ) : (
                              <div
                                onClick={() => setEditingOptionIndex(index)}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                              >
                                {option}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(index)}
                              className="flex-shrink-0 p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Remove option"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {options.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No options added yet. Add at least one option for {fieldType} fields.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {(createMutation.isPending || updateMutation.isPending)
                    ? (editingFieldId ? 'Updating...' : 'Creating...')
                    : (editingFieldId ? 'Update Field' : 'Create Field')
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

        {/* Loading State */}
        {!isFormOpen && isLoading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Fields List */}
        {!isFormOpen && filteredFields && filteredFields.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Required
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Options
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
                {filteredFields.map((field) => (
                  <tr
                    key={field.id}
                    onClick={() => handleEdit(field)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {field.label}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getFieldTypeColor(field.fieldType)}`}>
                        {field.fieldType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {field.required ? (
                        <span className="text-red-600 dark:text-red-400">Yes</span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {field.options && field.options.length > 0 ? (
                        <span>{field.options.length} options</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(field.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(field)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, fieldId: field.id })}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
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

        {/* Empty State */}
        {!isFormOpen && fields && fields.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No fields</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating reusable form fields.
            </p>
          </div>
        )}

        {/* No Results State */}
        {!isFormOpen && filteredFields && filteredFields.length === 0 && fields && fields.length > 0 && (searchQuery || typeFilter !== 'all') && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No results found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your search or filter.
            </p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Field"
        message="Are you sure you want to delete this field? This action cannot be undone if the field is not in use."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteModal.fieldId) {
            deleteMutation.mutate(deleteModal.fieldId);
          }
          setDeleteModal({ isOpen: false, fieldId: null });
        }}
        onCancel={() => setDeleteModal({ isOpen: false, fieldId: null })}
      />
    </Layout>
  );
};

export default AdminFieldLibrary;
