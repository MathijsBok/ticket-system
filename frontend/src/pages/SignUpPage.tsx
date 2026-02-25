import React, { useState, useEffect } from 'react';
import { SignUp } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

type Theme = 'light' | 'dark';

const SignUpPage: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4 transition-colors">
      {/* Theme toggle button */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>
      </div>

      {/* Logo and title */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">Klever Support</h1>
        <p className="text-gray-600 dark:text-gray-400">Create your account</p>
      </div>

      {/* Clerk SignUp component with theme */}
      <SignUp
        appearance={{
          baseTheme: theme === 'dark' ? dark : undefined,
          elements: {
            rootBox: 'mx-auto',
            card: theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white',
            headerTitle: theme === 'dark' ? 'text-white' : undefined,
            headerSubtitle: theme === 'dark' ? 'text-gray-400' : undefined,
            socialButtonsBlockButton: theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
              : undefined,
            formFieldLabel: theme === 'dark' ? 'text-gray-300' : undefined,
            formFieldInput: theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : undefined,
            footerActionLink: 'text-primary hover:text-primary/80',
          },
          variables: {
            colorPrimary: 'hsl(221.2, 83.2%, 53.3%)',
          }
        }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
      />
    </div>
  );
};

export default SignUpPage;
