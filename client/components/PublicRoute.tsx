import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PublicRouteProps {
    children: React.ReactNode;
}

/**
 * PublicRoute redirects authenticated users away from public pages 
 * (like Login/Signup) back to the dashboard.
 */
export default function PublicRoute({ children }: PublicRouteProps) {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (currentUser) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
