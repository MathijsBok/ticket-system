import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { api } from '../lib/api';

interface SecurityStatus {
  has2FAEnabled: boolean;
  is2FARequired: boolean;
  gracePeriodDaysRemaining: number | null;
  gracePeriodExpired: boolean;
}

export default function GracePeriodWarning() {
  const { user } = useUser();
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const userRole = user?.publicMetadata?.role as string | undefined;

  useEffect(() => {
    const fetchSecurityStatus = async (shouldSync = false) => {
      try {
        // Only fetch if user is agent or admin
        if (userRole !== 'AGENT' && userRole !== 'ADMIN') {
          return;
        }

        // Sync with Clerk first if requested to ensure we have latest 2FA status
        if (shouldSync) {
          try {
            await api.post('/security/sync');
          } catch (syncError) {
            console.error('Error syncing 2FA status:', syncError);
          }
        }

        const response = await api.get('/security/status');
        setSecurityStatus(response.data);
      } catch (error) {
        console.error('Error fetching security status:', error);
      }
    };

    // Initial fetch with sync
    fetchSecurityStatus(true);

    // Refresh when page becomes visible (user might have enabled 2FA in another tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchSecurityStatus(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic refresh every 30 seconds to catch 2FA enablement
    const interval = setInterval(() => fetchSecurityStatus(true), 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [userRole]);

  // Don't show banner if:
  // - User has dismissed it
  // - Security status hasn't loaded
  // - User is not agent/admin
  // - 2FA is not required
  // - 2FA is already enabled
  // - No grace period or grace period expired
  if (
    dismissed ||
    !securityStatus ||
    !securityStatus.is2FARequired ||
    securityStatus.has2FAEnabled ||
    securityStatus.gracePeriodExpired ||
    securityStatus.gracePeriodDaysRemaining === null
  ) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-yellow-400 dark:bg-yellow-600">
              <svg
                className="h-5 w-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <p className="ml-3 font-medium text-yellow-900 dark:text-yellow-200 text-sm">
              <span className="md:hidden">
                2FA required in {securityStatus.gracePeriodDaysRemaining} days
              </span>
              <span className="hidden md:inline">
                Two-factor authentication is required by{' '}
                <strong>
                  {new Date(
                    Date.now() + securityStatus.gracePeriodDaysRemaining * 24 * 60 * 60 * 1000
                  ).toLocaleDateString()}
                </strong>
                {' '}({securityStatus.gracePeriodDaysRemaining} days remaining).
              </span>
            </p>
          </div>
          <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
            <Link
              to="/settings"
              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Enable Now
            </Link>
          </div>
          <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="-mr-1 flex p-2 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-600"
            >
              <span className="sr-only">Dismiss</span>
              <svg
                className="h-5 w-5 text-yellow-900 dark:text-yellow-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
