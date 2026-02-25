import { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

interface SecurityStatus {
  has2FAEnabled: boolean;
  is2FARequired: boolean;
  enforcementEnabled: boolean;
  gracePeriodEnd: string | null;
  gracePeriodDaysRemaining: number | null;
  gracePeriodExpired: boolean;
}

const TwoFactorContext = createContext({ twoFactorBlocked: false });

export const useTwoFactor = () => useContext(TwoFactorContext);

interface TwoFactorGuardProps {
  children: React.ReactNode;
}

export default function TwoFactorGuard({ children }: TwoFactorGuardProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'allowed' | 'blocked'>('loading');
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);

  const userRole = (user?.publicMetadata?.role as string) || 'USER';
  const isAgentOrAdmin = userRole === 'AGENT' || userRole === 'ADMIN';

  useEffect(() => {
    if (!isLoaded) return;

    // Regular users don't need 2FA checks
    if (!isAgentOrAdmin) {
      setStatus('allowed');
      return;
    }

    const checkTwoFactorStatus = async () => {
      try {
        // Sync first to get latest status from Clerk
        try {
          await api.post('/security/sync');
        } catch {
          // Sync failure is non-critical
        }

        const response = await api.get('/security/status');
        const data: SecurityStatus = response.data;
        setSecurityStatus(data);

        // Check if grace period expired using direct timestamp comparison
        // (matches backend middleware logic exactly)
        const isGracePeriodExpired = data.gracePeriodEnd
          ? new Date(data.gracePeriodEnd) <= new Date()
          : false;

        if (
          data.enforcementEnabled &&
          data.is2FARequired &&
          !data.has2FAEnabled &&
          isGracePeriodExpired
        ) {
          setStatus('blocked');
        } else {
          setStatus('allowed');
        }
      } catch (error) {
        // If we can't check, allow access (fail open) to avoid lockouts
        console.error('Error checking 2FA status:', error);
        setStatus('allowed');
      }
    };

    checkTwoFactorStatus();
  }, [isLoaded, isAgentOrAdmin]);

  const handleEnableTwoFactor = () => {
    navigate('/settings');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Still loading Clerk user data
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Checking 2FA status
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Verifying security settings...</p>
        </div>
      </div>
    );
  }

  // Allow access to settings page even when blocked (needed to enable 2FA)
  if (status === 'blocked' && location.pathname === '/settings') {
    return (
      <TwoFactorContext.Provider value={{ twoFactorBlocked: true }}>
        {children}
      </TwoFactorContext.Provider>
    );
  }

  // 2FA required but not enabled - show blocking page
  if (status === 'blocked') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-8 border border-gray-200 dark:border-gray-700">
          {/* Shield icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Two-Factor Authentication Required
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Your account requires two-factor authentication to access the system.
              Please enable 2FA in your settings to continue.
            </p>
            {securityStatus?.gracePeriodEnd && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Grace period expired {new Date(securityStatus.gracePeriodEnd).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleEnableTwoFactor}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Enable 2FA in Settings
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Sign Out
            </button>
          </div>

          {/* Help text */}
          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
            Need help? Contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  // Allowed - render the app
  return <>{children}</>;
}
