import { useEffect, useState } from 'react';
import { UserProfile } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface SecurityStatus {
  has2FAEnabled: boolean;
  has2FAEnrolledAt: string | null;
  is2FARequired: boolean;
  enforcementEnabled: boolean;
  gracePeriodEnd: string | null;
  gracePeriodDaysRemaining: number | null;
  gracePeriodExpired: boolean;
  lastSyncedAt: string | null;
}

export default function SecuritySettings() {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const fetchSecurityStatus = async () => {
    try {
      const response = await api.get('/security/status');
      setSecurityStatus(response.data);
    } catch (error) {
      console.error('Error fetching security status:', error);
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/security/sync');
      await fetchSecurityStatus();
      toast.success('Security status synced successfully');
    } catch (error) {
      console.error('Error syncing security status:', error);
      toast.error('Failed to sync security status');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchSecurityStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 2FA Status Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Two-Factor Authentication
          </h2>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Status'}
          </button>
        </div>

        {securityStatus && (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center space-x-3">
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  securityStatus.has2FAEnabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}
              >
                {securityStatus.has2FAEnabled ? '✓ Enabled' : '⚠ Not Enabled'}
              </div>
              {securityStatus.is2FARequired && !securityStatus.has2FAEnabled && (
                <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                  Required for your role
                </span>
              )}
            </div>

            {/* Grace Period Warning */}
            {securityStatus.is2FARequired &&
              !securityStatus.has2FAEnabled &&
              securityStatus.gracePeriodDaysRemaining !== null &&
              !securityStatus.gracePeriodExpired && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-yellow-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Action Required
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                        <p>
                          You have{' '}
                          <strong>{securityStatus.gracePeriodDaysRemaining} days</strong> remaining
                          to enable two-factor authentication. After this period, you will not be
                          able to access the system without 2FA.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Grace Period Expired */}
            {securityStatus.is2FARequired &&
              !securityStatus.has2FAEnabled &&
              securityStatus.gracePeriodExpired && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                        Grace Period Expired
                      </h3>
                      <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                        <p>
                          Your grace period has expired. Please enable two-factor authentication
                          below to continue accessing the system.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Setup Guide */}
            {!securityStatus.has2FAEnabled && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                  How to enable 2FA
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
                  <li>Click on "Security" in the section below</li>
                  <li>Choose your preferred method: Authenticator App or Passkey</li>
                  <li>
                    For Authenticator App: Download an app like Google Authenticator, Authy, or
                    1Password
                  </li>
                  <li>Follow the setup instructions to complete enrollment</li>
                </ol>
              </div>
            )}

            {/* Last Synced */}
            {securityStatus.lastSyncedAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last synced:{' '}
                {new Date(securityStatus.lastSyncedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Clerk UserProfile Component for 2FA Setup */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <UserProfile
          appearance={{
            variables: isDarkMode ? {
              colorBackground: '#1f2937', // gray-800
              colorText: '#f3f4f6', // gray-100
              colorPrimary: '#3b82f6', // blue-500
              colorInputBackground: '#374151', // gray-700
              colorInputText: '#f3f4f6', // gray-100
              colorTextSecondary: '#9ca3af', // gray-400
              colorDanger: '#ef4444', // red-500
            } : undefined,
            elements: {
              rootBox: 'w-full',
              card: isDarkMode ? '!bg-gray-800 !text-white !shadow-none !border-0' : '!bg-white !shadow-none !border-0',
              navbar: isDarkMode ? '!bg-gray-700 !border-gray-600' : '!bg-white !border-gray-200',
              navbarButton: isDarkMode ? '!text-gray-300 hover:!bg-gray-600' : '!text-gray-700 hover:!bg-gray-100',
              navbarButtonActive: isDarkMode ? '!text-blue-400 !bg-gray-600' : '!text-blue-600 !bg-blue-50',
              navbarMobileMenuButton: isDarkMode ? '!text-gray-300' : '!text-gray-700',
              pageScrollBox: isDarkMode ? '!bg-gray-800' : '!bg-white',
              page: isDarkMode ? '!bg-gray-800' : '!bg-white',
              header: isDarkMode ? '!bg-gray-700' : '!bg-white',
              headerTitle: isDarkMode ? '!text-white' : '!text-gray-900',
              headerSubtitle: isDarkMode ? '!text-gray-400' : '!text-gray-600',
              profileSection: isDarkMode ? '!bg-gray-800 !border-gray-700' : '!bg-white !border-gray-200',
              profileSectionTitle: isDarkMode ? '!text-white' : '!text-gray-900',
              profileSectionContent: isDarkMode ? '!text-gray-300' : '!text-gray-700',
              profileSectionPrimaryButton: isDarkMode ? '!text-blue-400 hover:!bg-gray-700' : '!text-blue-600 hover:!bg-blue-50',
              formFieldLabel: isDarkMode ? '!text-gray-300' : '!text-gray-700',
              formFieldInput: isDarkMode ? '!bg-gray-700 !text-white !border-gray-600' : '!bg-white !text-gray-900 !border-gray-300',
              formFieldInputShowPasswordButton: isDarkMode ? '!text-gray-400' : '!text-gray-500',
              formButtonPrimary: '!bg-blue-600 hover:!bg-blue-700 !text-white !border-0',
              formButtonReset: isDarkMode ? '!text-gray-300 hover:!bg-gray-700' : '!text-gray-700 hover:!bg-gray-100',
              badge: isDarkMode ? '!bg-gray-700 !text-gray-300' : '!bg-gray-100 !text-gray-700',
              badgePrimary: isDarkMode ? '!bg-blue-900 !text-blue-300' : '!bg-blue-100 !text-blue-700',
              accordionTriggerButton: isDarkMode ? '!text-gray-300 hover:!bg-gray-700' : '!text-gray-700 hover:!bg-gray-100',
              accordionContent: isDarkMode ? '!text-gray-300' : '!text-gray-700',
              dividerLine: isDarkMode ? '!bg-gray-700' : '!bg-gray-200',
              dividerText: isDarkMode ? '!text-gray-400' : '!text-gray-500',
              modalCloseButton: isDarkMode ? '!text-gray-400 hover:!bg-gray-700' : '!text-gray-500 hover:!bg-gray-100',
              identityPreview: isDarkMode ? '!bg-gray-700 !border-gray-600' : '!bg-gray-50 !border-gray-200',
              identityPreviewText: isDarkMode ? '!text-white' : '!text-gray-900',
              identityPreviewEditButton: isDarkMode ? '!text-blue-400' : '!text-blue-600',
              footer: isDarkMode ? '!bg-gray-700' : '!bg-white',
              footerActionText: isDarkMode ? '!text-gray-400' : '!text-gray-600',
              footerActionLink: isDarkMode ? '!text-blue-400' : '!text-blue-600',
              userPreviewMainIdentifier: isDarkMode ? '!text-white !bg-transparent' : '!text-gray-900 !bg-transparent',
              userPreviewSecondaryIdentifier: isDarkMode ? '!text-gray-400 !bg-transparent' : '!text-gray-600 !bg-transparent',
              userButtonPopoverCard: isDarkMode ? '!bg-gray-800' : '!bg-white',
              userButtonPopoverActionButton: isDarkMode ? '!text-gray-300' : '!text-gray-700',
              avatarBox: isDarkMode ? '!border-gray-600' : '!border-gray-300',
              avatarImage: isDarkMode ? '!border-gray-600' : '!border-gray-300',
              formFieldAction: isDarkMode ? '!text-blue-400' : '!text-blue-600',
              formFieldSuccessText: isDarkMode ? '!text-green-400' : '!text-green-600',
              formFieldErrorText: isDarkMode ? '!text-red-400' : '!text-red-600',
              formFieldHintText: isDarkMode ? '!text-gray-400' : '!text-gray-500',
              formFieldWarningText: isDarkMode ? '!text-yellow-400' : '!text-yellow-600',
              profileSectionItem: isDarkMode ? '!bg-transparent !text-white' : '!bg-transparent !text-gray-900',
              profileSectionItemButton: isDarkMode ? '!text-gray-300' : '!text-gray-700',
              text: isDarkMode ? '!text-white' : '!text-gray-900',
              textSecondary: isDarkMode ? '!text-gray-400' : '!text-gray-600',
              tag: isDarkMode ? '!bg-gray-700 !text-gray-300' : '!bg-gray-100 !text-gray-700',
              tagPrimaryText: isDarkMode ? '!text-blue-300' : '!text-blue-700',
              // Dropdown and select elements
              selectButton: isDarkMode ? '!bg-gray-700 !text-white !border-gray-600' : '!bg-white !text-gray-900 !border-gray-300',
              selectButtonIcon: isDarkMode ? '!text-gray-400' : '!text-gray-500',
              selectPopover: isDarkMode ? '!bg-gray-700 !border-gray-600' : '!bg-white !border-gray-200',
              selectOption: isDarkMode ? '!text-gray-300 hover:!bg-gray-600' : '!text-gray-700 hover:!bg-gray-100',
              selectOptionSelected: isDarkMode ? '!bg-gray-600 !text-white' : '!bg-blue-50 !text-blue-600',
              // Menu and dropdown items
              menuList: isDarkMode ? '!bg-gray-700 !border-gray-600' : '!bg-white !border-gray-200',
              menuItem: isDarkMode ? '!text-gray-300 hover:!bg-gray-600' : '!text-gray-700 hover:!bg-gray-100',
              menuItemDestructive: isDarkMode ? '!text-red-400 hover:!bg-gray-600' : '!text-red-600 hover:!bg-red-50',
              // Accordion content
              accordionPanel: isDarkMode ? '!bg-gray-800 !text-gray-300' : '!bg-white !text-gray-700',
              // Action buttons and links
              button: isDarkMode ? '!text-gray-300' : '!text-gray-700',
              buttonArrowIcon: isDarkMode ? '!text-gray-400' : '!text-gray-500',
              // Additional sections
              otpCodeField: isDarkMode ? '!bg-gray-700 !text-white !border-gray-600' : '!bg-white !text-gray-900 !border-gray-300',
              otpCodeFieldInput: isDarkMode ? '!bg-gray-700 !text-white' : '!bg-white !text-gray-900',
              // Table elements (for device lists)
              tableHead: isDarkMode ? '!bg-gray-700 !text-gray-300' : '!bg-gray-50 !text-gray-700',
              tableBody: isDarkMode ? '!bg-gray-800' : '!bg-white',
              tableRow: isDarkMode ? 'hover:!bg-gray-700 !border-gray-600' : 'hover:!bg-gray-50 !border-gray-200',
              tableCell: isDarkMode ? '!text-gray-300' : '!text-gray-700'
            }
          }}
          routing="hash"
        />
      </div>

      {/* Recommended Authenticator Apps */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Recommended Authenticator Apps
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="https://support.google.com/accounts/answer/1066447"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>Google Authenticator</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
          <a
            href="https://authy.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>Authy</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
          <a
            href="https://1password.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>1Password</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
