import { Navigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { portalDestination } from '../../lib/portal.ts';
import { PortalLoading } from '../components/PortalState.tsx';

export default function PortalIndexRedirect() {
  const { context, loading } = useAuth();
  if (loading) return <PortalLoading />;
  return <Navigate to={portalDestination(context)} replace />;
}
