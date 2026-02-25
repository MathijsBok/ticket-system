import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  wasHelpful?: boolean | null;
  createdAt: string;
}

const ChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const [escalationDismissed, setEscalationDismissed] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Count assistant responses
  const assistantResponseCount = messages.filter((m) => m.role === 'ASSISTANT').length;

  // Fetch chat widget settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['chat-settings'],
    queryFn: async () => {
      const response = await chatApi.getSettings();
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Show escalation prompt after threshold responses (but not if dismissed)
  const escalationThreshold = settings?.escalationThreshold ?? 3;
  useEffect(() => {
    if (assistantResponseCount >= escalationThreshold && !escalationDismissed) {
      setShowEscalation(true);
    }
  }, [assistantResponseCount, escalationThreshold, escalationDismissed]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const response = await chatApi.sendMessage({
        message: messageText,
        sessionId: sessionId || undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId,
          role: 'ASSISTANT',
          content: data.response,
          wasHelpful: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'ASSISTANT',
          content: 'Sorry, I encountered an error. Please try again or create a support ticket.',
          wasHelpful: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
  });

  // Feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ messageId, wasHelpful }: { messageId: string; wasHelpful: boolean }) => {
      if (!sessionId) return;
      await chatApi.giveFeedback(sessionId, messageId, wasHelpful);
    },
    onSuccess: (_, { messageId, wasHelpful }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, wasHelpful } : msg))
      );
    },
  });

  // Regenerate mutation (when user marks as not helpful)
  const regenerateMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!sessionId) throw new Error('No session');
      const response = await chatApi.regenerateResponse(sessionId, messageId);
      return response.data;
    },
    onMutate: (messageId) => {
      setRegeneratingId(messageId);
    },
    onSuccess: (data, messageId) => {
      // Update the message with the new response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, content: data.response, wasHelpful: null }
            : msg
        )
      );
      setRegeneratingId(null);
    },
    onError: () => {
      setRegeneratingId(null);
    },
  });

  // End session mutation
  const endSessionMutation = useMutation({
    mutationFn: async (resolved: boolean) => {
      if (!sessionId) return;
      await chatApi.endSession(sessionId, resolved);
    },
    onSuccess: () => {
      setSessionId(null);
      setMessages([]);
      setShowEscalation(false);
      setEscalationDismissed(false);
      setIsOpen(false);
    },
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, showEscalation]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Don't render if settings are loading or widget is disabled
  if (settingsLoading || !settings?.enabled) {
    return null;
  }

  const handleSendMessage = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'USER',
      content: message.trim(),
      wasHelpful: null,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);
    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFeedback = (messageId: string, wasHelpful: boolean) => {
    feedbackMutation.mutate({ messageId, wasHelpful });
    // If not helpful, regenerate the response
    if (!wasHelpful) {
      regenerateMutation.mutate(messageId);
    }
  };

  const handleEndSession = (resolved: boolean) => {
    endSessionMutation.mutate(resolved);
  };

  const handleCreateTicket = () => {
    // Build the conversation as the ticket description
    const conversationText = messages
      .map((msg) => `${msg.role === 'USER' ? 'Me' : 'Support Bot'}: ${msg.content}`)
      .join('\n\n');

    // Get the first user message as the subject (truncated)
    const firstUserMessage = messages.find((m) => m.role === 'USER');
    const subject = firstUserMessage
      ? firstUserMessage.content.slice(0, 100) + (firstUserMessage.content.length > 100 ? '...' : '')
      : 'Support Request from Chat';

    // Store conversation data in sessionStorage for the ticket page to pick up
    sessionStorage.setItem(
      'chatToTicket',
      JSON.stringify({
        subject,
        description: `--- Chat Conversation ---\n\n${conversationText}\n\n--- End of Chat ---\n\nPlease describe your issue in more detail:`,
        sessionId,
      })
    );

    // Close the widget and navigate to ticket creation
    setIsOpen(false);
    navigate('/tickets/new');
  };

  const handleDismissEscalation = () => {
    setShowEscalation(false);
    setEscalationDismissed(true);
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
          title="Chat with us"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-primary text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-sm">Support Chat</h3>
                <p className="text-xs text-white/80">We're here to help</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <div className="relative group">
                  <button
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="End chat"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                      />
                    </svg>
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 hidden group-hover:block min-w-[140px]">
                    <button
                      onClick={() => handleEndSession(true)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      Issue resolved
                    </button>
                    <button
                      onClick={() => handleEndSession(false)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      Start new chat
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Minimize chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[320px]">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <p className="text-sm">{settings.welcomeMessage || 'Hi! How can I help you today?'}</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === 'USER'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  {/* Show regenerating indicator or content */}
                  {regeneratingId === msg.id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Generating better response...</span>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* Feedback buttons for assistant messages */}
                  {msg.role === 'ASSISTANT' && !msg.id.startsWith('error-') && regeneratingId !== msg.id && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Helpful?</span>
                      <button
                        onClick={() => handleFeedback(msg.id, true)}
                        className={`p-1 rounded transition-colors ${
                          msg.wasHelpful === true
                            ? 'text-green-600 bg-green-100 dark:bg-green-900/30'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                        disabled={msg.wasHelpful !== null || regenerateMutation.isPending}
                        title="Yes, helpful"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, false)}
                        className={`p-1 rounded transition-colors ${
                          msg.wasHelpful === false
                            ? 'text-red-600 bg-red-100 dark:bg-red-900/30'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                        disabled={msg.wasHelpful !== null || regenerateMutation.isPending}
                        title="Not helpful - Try different answer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Escalation prompt */}
            {showEscalation && !isTyping && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Need more help?
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      If the chat isn't solving your issue, you can create a support ticket for personalized assistance.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleCreateTicket}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md transition-colors"
                      >
                        Create Ticket
                      </button>
                      <button
                        onClick={handleDismissEscalation}
                        className="px-3 py-1.5 bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-medium rounded-md transition-colors"
                      >
                        Continue Chat
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                disabled={sendMessageMutation.isPending}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || sendMessageMutation.isPending}
                className="p-2 bg-primary hover:bg-primary/90 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors"
                title="Send message"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
