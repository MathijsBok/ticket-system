import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../lib/api';
import RichTextEditor from './RichTextEditor';
import { AgentForMention } from '../types';

interface MentionableRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentionedUserIds: string[]) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  resizable?: boolean;
  isInternal?: boolean;
  enableMentions?: boolean;
}

const MentionableRichTextEditor: React.FC<MentionableRichTextEditorProps> = ({
  value,
  onChange,
  onMentionsChange,
  placeholder,
  minHeight,
  className,
  resizable,
  isInternal,
  enableMentions = true
}) => {
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<AgentForMention[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch agents for mention autocomplete
  const { data: agents } = useQuery({
    queryKey: ['agentsForMention', mentionQuery],
    queryFn: async () => {
      const response = await userApi.searchAgents(mentionQuery);
      return response.data as AgentForMention[];
    },
    enabled: showMentionDropdown && enableMentions
  });

  // Filter out already mentioned users and limit results
  const filteredAgents = agents?.filter(
    agent => !mentionedUsers.some(m => m.id === agent.id)
  ).slice(0, 5) || [];

  // Reset internal state when value is cleared (form submitted)
  useEffect(() => {
    if (!value || value === '<p><br></p>' || value === '<p></p>') {
      setMentionedUsers([]);
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
  }, [value]);

  // Detect @ in the content and trigger mention dropdown
  useEffect(() => {
    if (!enableMentions) return;

    // Convert HTML to plain text to check for @
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = value;
    const plainText = tempDiv.textContent || '';

    // Look for @ followed by word characters at the end of text
    const atMatch = plainText.match(/@(\w*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setShowMentionDropdown(true);
      setSelectedIndex(0);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
  }, [value, enableMentions]);

  // Handle keyboard navigation in dropdown
  useEffect(() => {
    if (!showMentionDropdown) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredAgents.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredAgents.length > 0) {
        e.preventDefault();
        handleSelectAgent(filteredAgents[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionDropdown(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showMentionDropdown, filteredAgents, selectedIndex]);

  // Handle agent selection
  const handleSelectAgent = useCallback((agent: AgentForMention) => {
    const agentName = agent.firstName || agent.lastName
      ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim()
      : agent.email.split('@')[0];

    // Convert HTML to plain text to find @ position
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = value;
    const plainText = tempDiv.textContent || '';

    // Find the @ pattern
    const atMatch = plainText.match(/@(\w*)$/);
    if (atMatch) {
      // Create mention text (styled via CSS class that Quill preserves)
      const mentionText = `<strong style="color: #1e40af;">@${agentName}</strong>&nbsp;`;

      // Replace the @query with the mention
      let newValue = value;

      // Try to find and replace in HTML
      const regex = new RegExp(`@${atMatch[1]}(<\/p>)?$`);
      if (regex.test(value)) {
        newValue = value.replace(regex, mentionText + '$1');
      } else {
        // Fallback: replace at end
        newValue = value.replace(/<\/p>$/, mentionText + '</p>');
      }

      onChange(newValue);

      // Track mentioned user - this is the key part for notifications
      const newMentionedUsers = [...mentionedUsers, agent];
      setMentionedUsers(newMentionedUsers);

      // Immediately notify parent of the mention
      if (onMentionsChange) {
        onMentionsChange(newMentionedUsers.map(u => u.id));
      }
    }

    setShowMentionDropdown(false);
    setMentionQuery('');
  }, [value, onChange, mentionedUsers, onMentionsChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMentionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAgentDisplayName = (agent: AgentForMention) => {
    if (agent.firstName || agent.lastName) {
      return `${agent.firstName || ''} ${agent.lastName || ''}`.trim();
    }
    return agent.email;
  };

  // Handle removing a mention from the badges
  const handleRemoveMention = (userId: string) => {
    const newMentionedUsers = mentionedUsers.filter(u => u.id !== userId);
    setMentionedUsers(newMentionedUsers);
    if (onMentionsChange) {
      onMentionsChange(newMentionedUsers.map(u => u.id));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={minHeight}
        className={className}
        resizable={resizable}
        isInternal={isInternal}
      />

      {/* Mention hint */}
      {enableMentions && !showMentionDropdown && mentionedUsers.length === 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Type @ to mention an agent
        </div>
      )}

      {/* Mention dropdown */}
      {showMentionDropdown && enableMentions && filteredAgents.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-1"
          style={{ bottom: '100%', marginBottom: '4px' }}
        >
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Mention an agent
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredAgents.map((agent, index) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleSelectAgent(agent)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                    {(agent.firstName?.[0] || agent.email[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {getAgentDisplayName(agent)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {agent.email}
                    </div>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                    {agent.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results message */}
      {showMentionDropdown && enableMentions && filteredAgents.length === 0 && mentionQuery && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-1 p-3"
          style={{ bottom: '100%', marginBottom: '4px' }}
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
            No agents found matching "{mentionQuery}"
          </div>
        </div>
      )}

      {/* Mentioned users badges - these are what get sent to the API */}
      {enableMentions && mentionedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Will notify:</span>
          {mentionedUsers.map(user => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full"
            >
              @{getAgentDisplayName(user)}
              <button
                type="button"
                onClick={() => handleRemoveMention(user.id)}
                className="hover:text-blue-900 dark:hover:text-blue-100"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionableRichTextEditor;
