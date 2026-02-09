import React from 'react';
import CustomSelect from './CustomSelect';
import { FormFieldAssignment } from '../types';

interface FormRendererProps {
  fields: FormFieldAssignment[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  errors?: Record<string, string>;
}

const FormRenderer: React.FC<FormRendererProps> = ({ fields, values, onChange, errors }) => {
  const renderField = (fieldAssignment: FormFieldAssignment) => {
    const { field, required } = fieldAssignment;
    const value = values[field.id] || field.defaultValue || '';
    const error = errors?.[field.id];

    const baseInputClasses = `w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary ${
      error
        ? 'border-red-500 dark:border-red-500'
        : 'border-gray-300 dark:border-gray-600'
    }`;

    switch (field.fieldType) {
      case 'text':
        return (
          <input
            type="text"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            required={required}
            className={baseInputClasses}
          />
        );

      case 'textarea':
        return (
          <textarea
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            required={required}
            rows={4}
            className={baseInputClasses}
          />
        );

      case 'select':
        return (
          <CustomSelect
            id={field.id}
            value={value}
            onChange={(v) => onChange(field.id, v)}
            required={required}
            placeholder={field.placeholder || 'Select an option...'}
            options={(field.options || []).map((option) => ({
              value: option,
              label: option,
            }))}
          />
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <label
                key={index}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  required={required && index === 0}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-900 dark:text-white">
                  {option}
                </span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const selectedValues = value ? value.split(',').map(v => v.trim()) : [];
              const isChecked = selectedValues.includes(option);

              return (
                <label
                  key={index}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    value={option}
                    checked={isChecked}
                    onChange={(e) => {
                      const currentValues = value ? value.split(',').map(v => v.trim()) : [];
                      let newValues: string[];

                      if (e.target.checked) {
                        newValues = [...currentValues, option];
                      } else {
                        newValues = currentValues.filter(v => v !== option);
                      }

                      onChange(field.id, newValues.join(', '));
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {option}
                  </span>
                </label>
              );
            })}
            {required && (
              <input
                type="text"
                value={value}
                onChange={() => {}}
                required
                className="sr-only"
                tabIndex={-1}
              />
            )}
          </div>
        );

      default:
        return (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Unsupported field type: {field.fieldType}
          </div>
        );
    }
  };

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {fields.map((fieldAssignment) => {
        const { field, required } = fieldAssignment;
        const error = errors?.[field.id];

        return (
          <div key={field.id}>
            <label
              htmlFor={field.id}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {field.label}
              {required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {renderField(fieldAssignment)}
            {error && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FormRenderer;
