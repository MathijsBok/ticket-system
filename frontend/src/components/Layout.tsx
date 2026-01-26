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

  // Update currentView based on URL when user navigates
  React.useEffect(() => {
    if (userRole === 'ADMIN') {
      if (location.pathname.startsWith('/admin')) {
        setCurrentView('ADMIN');
      } else if (location.pathname.startsWith('/agent')) {
        setCurrentView('AGENT');
      } else if (location.pathname.startsWith('/user')) {
        setCurrentView('USER');
      }
      // Don't update for /tickets routes - maintain current view
    }
  }, [location.pathname, userRole, setCurrentView]);

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

  const navigation = React.useMemo(() => {
    const nav = [];

    // Use currentView for admins (respects "View as" switcher), userRole for others
    const effectiveRole = userRole === 'ADMIN' ? currentView : userRole;

    if (effectiveRole === 'USER') {
      nav.push(
        { name: 'My Tickets', href: '/user' },
        { name: 'New Ticket', href: '/tickets/new' }
      );
    } else if (effectiveRole === 'AGENT') {
      nav.push(
        { name: 'Dashboard', href: '/agent' }
      );
    } else if (effectiveRole === 'ADMIN') {
      nav.push(
        { name: 'Dashboard', href: '/admin' },
        { name: 'Forms', href: '/admin/forms' }
      );
    }

    return nav;
  }, [userRole, currentView]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

              {/* View As Role Switcher (Admin Only) */}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
