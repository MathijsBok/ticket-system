import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Default to 'USER' role if no role is set (new users)
  const userRole = (user?.publicMetadata?.role as string) || 'USER';

  if (!allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on role
    if (userRole === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    } else if (userRole === 'AGENT') {
      return <Navigate to="/agent" replace />;
    }
    return <Navigate to="/user" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
