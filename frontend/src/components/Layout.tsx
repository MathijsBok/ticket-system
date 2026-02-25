import React, { useState } from 'react';
import { useUser, UserButton } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../contexts/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import { settingsApi } from '../lib/api';
import NotificationBell from './NotificationBell';
import ChatWidget from './ChatWidget';
import GracePeriodWarning from './GracePeriodWarning';
import { useTwoFactor } from './TwoFactorGuard';

interface LayoutProps {
  children: React.ReactNode;
  hidePadding?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, hidePadding = false }) => {
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const { twoFactorBlocked } = useTwoFactor();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Default to 'USER' role if no role is set (new users)
  const userRole = (user?.publicMetadata?.role as string) || 'USER';

  // Fetch agent permissions (only for agents, not admins)
  const { data: agentPermissions } = useQuery({
    queryKey: ['agentPermissions'],
    queryFn: async () => {
      const response = await settingsApi.getAgentPermissions();
      return response.data;
    },
    enabled: userRole === 'AGENT' || userRole === 'ADMIN',
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  const navigation = React.useMemo(() => {
    // When 2FA is required but not enabled, only show Settings
    if (twoFactorBlocked) {
      return [{ name: 'Settings', href: '/settings' }];
    }

    const nav = [];

    if (userRole === 'USER') {
      nav.push(
        { name: 'My Tickets', href: '/user' },
        { name: 'New Ticket', href: '/tickets/new' },
        { name: 'Settings', href: '/settings' }
      );
    } else if (userRole === 'AGENT') {
      nav.push({ name: 'Tickets', href: '/agent' });

      if (agentPermissions?.canCreateTickets !== false) {
        nav.push({ name: 'New Ticket', href: '/tickets/new' });
      }
      if (agentPermissions?.canAccessAnalytics !== false) {
        nav.push({ name: 'Analytics', href: '/agent/analytics' });
      }
      if (agentPermissions?.canAccessForms !== false) {
        nav.push({ name: 'Forms', href: '/agent/forms' });
      }
      if (agentPermissions?.canAccessFieldLibrary !== false) {
        nav.push({ name: 'Field Library', href: '/agent/fields' });
      }
      if (agentPermissions?.canAccessMacros !== false) {
        nav.push({ name: 'Macros', href: '/agent/macros' });
      }
      if (agentPermissions?.canAccessEmailTemplates === true) {
        nav.push({ name: 'Email Templates', href: '/agent/email-templates' });
      }
      if (agentPermissions?.canAccessUsers === true) {
        nav.push({ name: 'Users', href: '/agent/users' });
      }
      if (agentPermissions?.canAccessBugReports !== false) {
        nav.push({ name: 'Bug Reports', href: '/agent/bugs' });
      }
      nav.push({ name: 'Settings', href: '/settings' });
    } else if (userRole === 'ADMIN') {
      nav.push(
        { name: 'Dashboard', href: '/agent' },
        { name: 'New Ticket', href: '/tickets/new' },
        { name: 'Analytics', href: '/admin/analytics' },
        { name: 'Forms', href: '/admin/forms' },
        { name: 'Field Library', href: '/admin/fields' },
        { name: 'Macros', href: '/admin/macros' },
        { name: 'Email Templates', href: '/admin/email-templates' },
        { name: 'Users', href: '/admin/users' },
        { name: 'Bug Reports', href: '/admin/bugs' },
        { name: 'Admin Settings', href: '/admin/settings' },
        { name: 'Settings', href: '/settings' }
      );
    }

    return nav;
  }, [userRole, agentPermissions, twoFactorBlocked]);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-primary">
                Klever Support
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.href
                      ? 'text-primary'
                      : 'text-gray-700 dark:text-gray-300 hover:text-primary'
                  }`}
                >
                  {item.name}
                </Link>
              ))}

              {/* Notifications bell for agents and admins */}
              {!twoFactorBlocked && (userRole === 'AGENT' || userRole === 'ADMIN') && (
                <NotificationBell />
              )}

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>

              {/* User menu */}
              <UserButton afterSignOutUrl="/" />
            </nav>

            {/* Mobile menu button and utilities */}
            <div className="flex lg:hidden items-center gap-3">
              {/* Notifications bell for agents and admins (mobile) */}
              {!twoFactorBlocked && (userRole === 'AGENT' || userRole === 'ADMIN') && (
                <NotificationBell />
              )}

              {/* Theme toggle (mobile) */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>

              {/* User menu (mobile) */}
              <UserButton afterSignOutUrl="/" />

              {/* Hamburger menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={handleNavClick}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    location.pathname === item.href
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {item.name}
                </Link>
              ))}

            </div>
          </div>
        )}
      </header>

      {/* Grace Period Warning Banner */}
      <GracePeriodWarning />

      {/* Main content */}
      <main className={hidePadding ? '' : 'max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
        {children}
      </main>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
};

export default Layout;
