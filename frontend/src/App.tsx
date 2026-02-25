import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import TwoFactorGuard from './components/TwoFactorGuard';

// Pages
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import UserDashboard from './pages/UserDashboard';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import TicketDetail from './pages/TicketDetail';
import CreateTicket from './pages/CreateTicket';
import AdminForms from './pages/AdminForms';
import AdminFieldLibrary from './pages/AdminFieldLibrary';
import AdminSettings from './pages/AdminSettings';
import AdminMacros from './pages/AdminMacros';
import AdminEmailTemplates from './pages/AdminEmailTemplates';
import AdminUsers from './pages/AdminUsers';
import AdminBugs from './pages/AdminBugs';
import ApiDocs from './pages/ApiDocs';
import FeedbackPage from './pages/FeedbackPage';
import UserSettings from './pages/UserSettings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

// Role-based dashboard router - redirects to appropriate dashboard
function DashboardRouter() {
  const { user } = useUser();
  // Default to 'USER' role if no role is set (new users)
  const userRole = (user?.publicMetadata?.role as string) || 'USER';

  // Redirect to appropriate dashboard based on role
  // Using replace to avoid `/` appearing in history (would cause redirect loops on back)
  if (userRole === 'ADMIN' || userRole === 'AGENT') {
    return <Navigate to="/agent" replace />;
  }
  return <Navigate to="/user" replace />;
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <NotificationProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <SignedIn>
                  <TwoFactorGuard>
                  <Routes>
                    <Route path="/" element={<DashboardRouter />} />

                    {/* User Routes */}
                    <Route
                      path="/user"
                      element={
                        <ProtectedRoute allowedRoles={['USER', 'AGENT', 'ADMIN']}>
                          <UserDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Agent Routes */}
                    <Route
                      path="/agent"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AgentDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/analytics"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AnalyticsDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/forms"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminForms />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/forms/new"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminForms />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/forms/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminForms />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/fields"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminFieldLibrary />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/fields/new"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminFieldLibrary />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/fields/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminFieldLibrary />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/macros"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminMacros />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/macros/new"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminMacros />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/macros/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminMacros />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/email-templates"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminEmailTemplates />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/email-templates/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminEmailTemplates />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/users"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminUsers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/bugs"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminBugs />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/agent/bugs/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminBugs />
                        </ProtectedRoute>
                      }
                    />

                    {/* Admin Routes */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/analytics"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AnalyticsDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/forms"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminForms />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/forms/new"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminForms />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/forms/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminForms />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/fields"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminFieldLibrary />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/fields/new"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminFieldLibrary />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/fields/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminFieldLibrary />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/settings"
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminSettings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/macros"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminMacros />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/macros/new"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminMacros />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/macros/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminMacros />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/email-templates"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminEmailTemplates />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/email-templates/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminEmailTemplates />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminUsers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/bugs"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminBugs />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/bugs/:id"
                      element={
                        <ProtectedRoute allowedRoles={['AGENT', 'ADMIN']}>
                          <AdminBugs />
                        </ProtectedRoute>
                      }
                    />

                    {/* Common Routes */}
                    <Route path="/settings" element={<UserSettings />} />
                    <Route path="/tickets/new" element={<CreateTicket />} />
                    <Route path="/tickets/:id" element={<TicketDetail />} />
                    <Route path="/api-docs" element={<ApiDocs />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </TwoFactorGuard>
                </SignedIn>
                <SignedOut>
                  <Routes>
                    <Route path="/sign-in/*" element={<LoginPage />} />
                    <Route path="/sign-up/*" element={<SignUpPage />} />
                    <Route path="/api-docs" element={<ApiDocs />} />
                    <Route path="/feedback" element={<FeedbackPage />} />
                    <Route path="*" element={<Navigate to="/sign-in" replace />} />
                  </Routes>
                </SignedOut>
              </BrowserRouter>
              <Toaster position="top-right" />
          </NotificationProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}

export default App;
