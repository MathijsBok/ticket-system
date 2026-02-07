import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import SecuritySettings from '../components/SecuritySettings';
import { UserProfile } from '@clerk/clerk-react';

type TabType = 'security' | 'profile';

export default function UserSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('security');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode for Clerk styling
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

  const tabs = [
    {
      id: 'security' as TabType,
      label: 'Security',
      description: 'Two-factor authentication and security settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      id: 'profile' as TabType,
      label: 'Profile',
      description: 'Personal information and account preferences',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Account Settings</h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            Manage your security preferences and profile information
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-600'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`${
                    activeTab === tab.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {tab.icon}
                  </div>
                  <div>
                    <div className={`font-medium ${
                      activeTab === tab.id
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {tab.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {tab.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </nav>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'security' && <SecuritySettings />}

            {activeTab === 'profile' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg">
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
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
