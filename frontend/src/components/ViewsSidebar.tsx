import React, { useState } from 'react';

interface ViewItem {
  id: string;
  name: string;
  count: number;
  filter: {
    status?: string | string[];
    allStatuses?: string[]; // What "All" button should filter by (if different from status)
    type?: string;
    assignee?: 'me' | 'unassigned' | 'all';
    createdByMe?: boolean;
    solvedAfter?: string;
  };
}

interface ViewsSidebarProps {
  stats: {
    byStatus: {
      new: number;
      open: number;
      pending: number;
      onHold: number;
      solved: number;
      closed: number;
    };
    byType?: {
      problem: number;
      incident: number;
      question: number;
      task: number;
    };
    myUnsolvedCount?: number;
    myRequestsCount?: number;
    unassignedCount?: number;
    total: number;
  } | null;
  activeView: string;
  onViewChange: (viewId: string, filter: ViewItem['filter']) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const ViewsSidebar: React.FC<ViewsSidebarProps> = ({
  stats,
  activeView,
  onViewChange,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onMobileClose,
  onRefresh,
  isRefreshing = false
}) => {
  const [personalExpanded, setPersonalExpanded] = useState(true);

  // Handle view change and close mobile sidebar
  const handleViewChange = (viewId: string, filter: ViewItem['filter']) => {
    onViewChange(viewId, filter);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  // Calculate all unsolved (OPEN + PENDING + ON_HOLD)
  const allUnsolved = stats ?
    (stats.byStatus.open || 0) +
    (stats.byStatus.pending || 0) +
    (stats.byStatus.onHold || 0) : 0;

  // Main views (no group header)
  const mainViews: ViewItem[] = [
    { id: 'your-unsolved', name: 'Your unsolved tickets', count: stats?.myUnsolvedCount || 0, filter: { assignee: 'me', status: 'OPEN', allStatuses: ['OPEN', 'PENDING', 'ON_HOLD'] } },
    { id: 'unassigned', name: 'Unassigned tickets', count: stats?.unassignedCount || 0, filter: { assignee: 'unassigned' } },
    { id: 'open', name: 'Open Tickets', count: stats?.byStatus.open || 0, filter: { status: 'OPEN' } },
    { id: 'pending', name: 'Pending tickets', count: stats?.byStatus.pending || 0, filter: { status: 'PENDING' } },
    { id: 'on-hold', name: 'On-Hold tickets', count: stats?.byStatus.onHold || 0, filter: { status: 'ON_HOLD' } },
    { id: 'problem', name: 'Problem tickets', count: stats?.byType?.problem || 0, filter: { type: 'PROBLEM', status: ['OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'], allStatuses: ['OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'] } },
    { id: 'incident', name: 'Incident tickets', count: stats?.byType?.incident || 0, filter: { type: 'INCIDENT', status: ['OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'], allStatuses: ['OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'] } },
    { id: 'all-unsolved', name: 'All unsolved tickets', count: allUnsolved, filter: { status: ['OPEN', 'PENDING', 'ON_HOLD'] } },
    { id: 'solved', name: 'Solved Tickets', count: stats?.byStatus.solved || 0, filter: { status: 'SOLVED' } },
    { id: 'all', name: 'All tickets', count: stats?.total || 0, filter: {} }
  ];

  // Personal views
  const personalViews: ViewItem[] = [
    { id: 'my-created', name: 'My Tickets', count: stats?.myRequestsCount || 0, filter: { createdByMe: true, status: 'OPEN', allStatuses: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD', 'SOLVED', 'CLOSED'] } }
  ];

  // Desktop collapsed state - hidden on mobile
  if (isCollapsed && !isMobileOpen) {
    return (
      <div className="hidden md:flex w-12 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  // Mobile overlay
  if (isMobileOpen) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 w-64 sm:w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-50 md:hidden animate-slide-in-left">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Views</h2>
            <button
              onClick={onMobileClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Views List */}
          <div className="flex-1 overflow-y-auto py-2">
            {/* Main Views */}
            <div className="mb-4">
              {mainViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => handleViewChange(view.id, view.filter)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                    activeView === view.id
                      ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <span className="truncate">{view.name}</span>
                  <span className={`ml-2 ${activeView === view.id ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
                    {view.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Personal Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <button
                onClick={() => setPersonalExpanded(!personalExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 transition-transform ${personalExpanded ? 'rotate-0' : '-rotate-90'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>Personal</span>
                </div>
                <span className="text-gray-500 dark:text-gray-400">
                  {personalViews.reduce((sum, v) => sum + v.count, 0)}
                </span>
              </button>

              {personalExpanded && (
                <div className="mt-1">
                  {personalViews.map((view) => (
                    <button
                      key={view.id}
                      onClick={() => handleViewChange(view.id, view.filter)}
                      className={`w-full flex items-center justify-between px-4 py-3 pl-10 text-sm transition-colors ${
                        activeView === view.id
                          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary font-medium'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <span className="truncate">{view.name}</span>
                      <span className={`ml-2 ${activeView === view.id ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
                        {view.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop expanded state - hidden on mobile
  return (
    <div className="hidden md:flex w-72 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Views</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
            title={isRefreshing ? "Refreshing..." : "Refresh"}
          >
            {isRefreshing ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Collapse sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Views List */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Main Views (no group header) */}
        <div className="mb-4">
          {mainViews.map((view) => (
            <button
              key={view.id}
              onClick={() => handleViewChange(view.id, view.filter)}
              className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                activeView === view.id
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <span className="truncate">{view.name}</span>
              <span className={`ml-2 ${activeView === view.id ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
                {view.count}
              </span>
            </button>
          ))}
        </div>

        {/* Personal Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
          <button
            onClick={() => setPersonalExpanded(!personalExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`w-4 h-4 transition-transform ${personalExpanded ? 'rotate-0' : '-rotate-90'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>Personal</span>
            </div>
            <span className="text-gray-500 dark:text-gray-400">
              {personalViews.reduce((sum, v) => sum + v.count, 0)}
            </span>
          </button>

          {personalExpanded && (
            <div className="mt-1">
              {personalViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => handleViewChange(view.id, view.filter)}
                  className={`w-full flex items-center justify-between px-4 py-2 pl-10 text-sm transition-colors ${
                    activeView === view.id
                      ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <span className="truncate">{view.name}</span>
                  <span className={`ml-2 ${activeView === view.id ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
                    {view.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewsSidebar;
