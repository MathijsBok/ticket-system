import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useUser } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ViewProvider } from './contexts/ViewContext';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// Pages
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
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NotificationProvider>
            <ViewProvider>
              <BrowserRouter>
                <SignedIn>
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
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AnalyticsDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/forms"
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminForms />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/forms/new"
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminForms />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/forms/:id"
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminForms />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/fields"
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminFieldLibrary />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/fields/new"
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                          <AdminFieldLibrary />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/fields/:id"
                      element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
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

                    {/* Common Routes */}
                    <Route path="/tickets/new" element={<CreateTicket />} />
                    <Route path="/tickets/:id" element={<TicketDetail />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </BrowserRouter>
              <Toaster position="top-right" />
            </ViewProvider>
          </NotificationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
