import React from 'react';
import { useUser, UserButton } from '@clerk/clerk-react';
import { useTheme } from '../contexts/ThemeContext';
import { useView } from '../contexts/ViewContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const { currentView, setCurrentView } = useView();
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = user?.publicMetadata?.role as string;

  // Only update currentView when admin uses "View as" dropdown
  // Don't auto-switch based on URL - this was causing navigation issues

  const handleViewChange = (view: string) => {
    const newView = view as 'USER' | 'AGENT' | 'ADMIN';
    setCurrentView(newView);
    switch (newView) {
      case 'USER':
        navigate('/user');
        break;
      case 'AGENT':
        navigate('/agent');
        break;
      case 'ADMIN':
        navigate('/admin');
        break;
    }
  };

  // Use currentView for admins (respects "View as" switcher), userRole for others
  const effectiveRole = userRole === 'ADMIN' ? currentView : userRole;

  const navigation = React.useMemo(() => {
    const nav = [];

    if (effectiveRole === 'USER') {
      nav.push(
        { name: 'My Tickets', href: '/user' },
        { name: 'New Ticket', href: '/tickets/new' }
      );
    } else if (effectiveRole === 'AGENT') {
      nav.push(
        { name: 'Tickets', href: '/agent' },
        { name: 'Macros', href: '/admin/macros' },
        { name: 'Email Templates', href: '/admin/email-templates' }
      );
    }

    return nav;
  }, [effectiveRole]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-primary">
                Ticket System
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-6">
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

              {/* Admin Navigation Links */}
              {userRole === 'ADMIN' && effectiveRole === 'ADMIN' && (
                <>
                  <Link
                    to="/agent"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/agent'
                        ? 'text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:text-primary'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/admin/analytics"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/admin/analytics'
                        ? 'text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:text-primary'
                    }`}
                  >
                    Analytics
                  </Link>
                  <Link
                    to="/admin"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/admin'
                        ? 'text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:text-primary'
                    }`}
                  >
                    Agent Performance
                  </Link>
                  <Link
                    to="/admin/forms"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/admin/forms'
                        ? 'text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:text-primary'
                    }`}
                  >
                    Forms
                  </Link>
                  <Link
                    to="/admin/fields"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/admin/fields'
                        ? 'text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:text-primary'
                    }`}
                  >
                    Field Library
                  </Link>
                  <Link
                    to="/admin/macros"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/admin/macros'
                        ? 'text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:text-primary'
                    }`}
                  >
                    Macros
                  </Link>
                  <Link
                    to="/admin/email-templates"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/admin/email-templates'
                        ? 'text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:text-primary'
                    }`}
                  >
                    Email Templates
                  </Link>
                  <Link
                    to="/admin/settings"
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === '/admin/settings'
                        ? 'text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:text-primary'
                    }`}
                  >
                    Settings
                  </Link>
                </>
              )}

              {userRole === 'ADMIN' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">View as:</span>
                  <select
                    value={currentView}
                    onChange={(e) => handleViewChange(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                  >
                    <option value="USER">User</option>
                    <option value="AGENT">Agent</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
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
          </div>
        </div>

      </header>

      {/* Main content */}
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
