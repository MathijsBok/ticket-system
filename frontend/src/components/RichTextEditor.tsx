import React, { useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  resizable?: boolean;
  isInternal?: boolean;
}

// Color palette with transparent/no-color as first option
const colorPalette = [
  '', // No color / transparent (shown as crossed-out box)
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter content...',
  minHeight = '200px',
  className = '',
  resizable = false,
  isInternal = false
}) => {
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': colorPalette }, { 'background': colorPalette }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ]
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'indent',
    'align',
    'link'
  ];

  return (
    <div className={`rich-text-editor ${className}`}>
      <style>{`
        .rich-text-editor .ql-container {
          min-height: ${minHeight};
          font-size: 14px;
        }
        .rich-text-editor .ql-editor {
          min-height: ${minHeight};
        }
        .dark .rich-text-editor .ql-toolbar {
          background-color: rgb(55, 65, 81);
          border-color: rgb(75, 85, 99);
        }
        .dark .rich-text-editor .ql-container {
          background-color: rgb(31, 41, 55);
          border-color: rgb(75, 85, 99);
        }
        .dark .rich-text-editor .ql-editor {
          color: rgb(229, 231, 235);
        }
        /* Force all text white in dark mode - inline colors are only for email clients */
        .dark .rich-text-editor .ql-editor * {
          color: rgb(229, 231, 235) !important;
        }
        .dark .rich-text-editor .ql-editor a {
          color: rgb(96, 165, 250) !important;
        }
        .dark .rich-text-editor .ql-editor.ql-blank::before {
          color: rgb(107, 114, 128);
        }
        .dark .rich-text-editor .ql-stroke {
          stroke: rgb(209, 213, 219) !important;
        }
        .dark .rich-text-editor .ql-fill {
          fill: rgb(209, 213, 219) !important;
        }
        .dark .rich-text-editor .ql-picker-label {
          color: rgb(209, 213, 219) !important;
        }
        .dark .rich-text-editor .ql-picker-options {
          background-color: rgb(55, 65, 81) !important;
        }
        .dark .rich-text-editor .ql-picker-item {
          color: rgb(209, 213, 219) !important;
        }
        /* Style for "no color" option in color picker */
        .rich-text-editor .ql-color-picker .ql-picker-item:first-child,
        .rich-text-editor .ql-background .ql-picker-item:first-child {
          background: linear-gradient(to top right, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px)) !important;
          border: 1px solid #d1d5db !important;
        }
        .dark .rich-text-editor .ql-color-picker .ql-picker-item:first-child,
        .dark .rich-text-editor .ql-background .ql-picker-item:first-child {
          border-color: #4b5563 !important;
        }
        .rich-text-editor .ql-toolbar {
          border-radius: 6px 6px 0 0;
          border-color: rgb(209, 213, 219);
        }
        .rich-text-editor .ql-container {
          border-radius: 0 0 6px 6px;
          border-color: rgb(209, 213, 219);
        }
        .rich-text-editor .ql-editor:focus {
          outline: none;
        }
        .rich-text-editor:focus-within .ql-toolbar {
          border-color: hsl(var(--primary));
        }
        .rich-text-editor:focus-within .ql-container {
          border-color: hsl(var(--primary));
        }
        ${resizable ? `
        .rich-text-editor .ql-container {
          resize: vertical;
          overflow: auto;
        }
        .rich-text-editor .ql-container::-webkit-resizer {
          background: linear-gradient(135deg, transparent 50%, rgb(156, 163, 175) 50%, rgb(156, 163, 175) 60%, transparent 60%, transparent 70%, rgb(156, 163, 175) 70%, rgb(156, 163, 175) 80%, transparent 80%);
          border-radius: 0 0 6px 0;
        }
        .dark .rich-text-editor .ql-container::-webkit-resizer {
          background: linear-gradient(135deg, transparent 50%, rgb(107, 114, 128) 50%, rgb(107, 114, 128) 60%, transparent 60%, transparent 70%, rgb(107, 114, 128) 70%, rgb(107, 114, 128) 80%, transparent 80%);
        }
        ` : ''}
        ${isInternal ? `
        /* Internal note styling - yellow theme */
        .rich-text-editor .ql-toolbar {
          background-color: rgb(254, 249, 195) !important;
          border-color: rgb(253, 224, 71) !important;
        }
        .rich-text-editor .ql-container {
          background-color: rgb(254, 252, 232) !important;
          border-color: rgb(253, 224, 71) !important;
        }
        .rich-text-editor .ql-editor {
          background-color: rgb(254, 252, 232) !important;
        }
        .rich-text-editor:focus-within .ql-toolbar,
        .rich-text-editor:focus-within .ql-container {
          border-color: rgb(234, 179, 8) !important;
        }
        .dark .rich-text-editor .ql-toolbar {
          background-color: rgba(234, 179, 8, 0.2) !important;
          border-color: rgb(161, 98, 7) !important;
        }
        .dark .rich-text-editor .ql-container {
          background-color: rgba(254, 249, 195, 0.95) !important;
          border-color: rgb(161, 98, 7) !important;
        }
        .dark .rich-text-editor .ql-editor {
          background-color: transparent !important;
          color: #1e293b !important;
        }
        .dark .rich-text-editor:focus-within .ql-toolbar,
        .dark .rich-text-editor:focus-within .ql-container {
          border-color: rgb(202, 138, 4) !important;
        }
        ` : ''}
      `}</style>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor;
