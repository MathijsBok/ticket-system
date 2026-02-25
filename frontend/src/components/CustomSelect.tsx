import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  id,
  required,
  disabled,
  size = 'md',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  // Position the dropdown relative to the trigger button
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownMaxHeight = 240; // max-h-60 = 15rem = 240px

    const opensUp = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;
    setOpenDirection(opensUp ? 'up' : 'down');

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(opensUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        listRef.current && !listRef.current.contains(target)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleReposition = () => updatePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, updatePosition]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setHighlightedIndex(idx >= 0 ? idx : 0);
        } else if (highlightedIndex >= 0) {
          onChange(options[highlightedIndex].value);
          close();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setHighlightedIndex(idx >= 0 ? idx : 0);
        } else {
          setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        }
        break;
      case 'Escape':
        close();
        break;
      case 'Tab':
        close();
        break;
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    close();
  };

  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-sm'
    : 'px-3 py-2 text-sm';

  const dropdown = isOpen ? createPortal(
    <ul
      ref={listRef}
      style={dropdownStyle}
      className={`z-[9999] max-h-60 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1`}
      role="listbox"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isHighlighted = index === highlightedIndex;
        return (
          <li
            key={option.value + '-' + index}
            role="option"
            aria-selected={isSelected}
            onClick={() => handleSelect(option.value)}
            onMouseEnter={() => setHighlightedIndex(index)}
            className={`${sizeClasses} cursor-pointer flex items-center justify-between transition-colors ${
              isHighlighted
                ? 'bg-primary/10 text-primary dark:text-primary'
                : isSelected
                  ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <span className="truncate">{option.label}</span>
            {isSelected && (
              <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </li>
        );
      })}
      {options.length === 0 && (
        <li className={`${sizeClasses} text-gray-500 dark:text-gray-400 cursor-default`}>
          No options available
        </li>
      )}
    </ul>,
    document.body
  ) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`} id={id}>
      {/* Hidden native select for form validation */}
      {required && (
        <select
          value={value}
          required={required}
          tabIndex={-1}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          onChange={() => {}}
          aria-hidden="true"
        >
          <option value="">{placeholder || ''}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {/* Custom trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full ${sizeClasses} border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-left flex items-center justify-between gap-2 transition-all ${
          isOpen
            ? 'ring-2 ring-primary border-primary'
            : 'hover:border-gray-400 dark:hover:border-gray-500'
        } ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer'
        } focus:outline-none focus:ring-2 focus:ring-primary`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${
          selectedOption
            ? 'text-gray-900 dark:text-white'
            : 'text-gray-500 dark:text-gray-400'
        }`}>
          {selectedOption ? selectedOption.label : (placeholder || 'Select...')}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform ${openDirection === 'up' && isOpen ? '' : isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdown}
    </div>
  );
}
