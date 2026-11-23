import { lazy, Suspense } from 'react';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { Outlet, Route, Routes } from 'react-router-dom';

const HomePage = lazy(() => import('./pages/HomePage.tsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.tsx'));
const PricingPage = lazy(() => import('./pages/PricingPage.tsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.tsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.tsx'));
const RecoverPage = lazy(() => import('./pages/RecoverPage.tsx'));
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage.tsx'));
const AccessDeniedPage = lazy(() => import('./pages/AccessDeniedPage.tsx'));
const NewBusinessPage = lazy(() => import('./pages/NewBusinessPage.tsx'));
const NewPasswordPage = lazy(() => import('./pages/NewPasswordPage.tsx'));
const FinishRegistrationPage = lazy(() => import('./pages/FinishRegistrationPage.tsx'));
const PortalLayout = lazy(() => import('./portal/PortalLayout.tsx'));
const PortalIndexRedirect = lazy(() => import('./portal/pages/PortalIndexRedirect.tsx'));
const BusinessOverviewPage = lazy(() => import('./portal/pages/BusinessOverviewPage.tsx'));
const BranchesPage = lazy(() => import('./portal/pages/BranchesPage.tsx'));
const TeamPage = lazy(() => import('./portal/pages/TeamPage.tsx'));
const VisitsPage = lazy(() => import('./portal/pages/VisitsPage.tsx'));
const CouponsPage = lazy(() => import('./portal/pages/CouponsPage.tsx'));
const AdminOverviewPage = lazy(() => import('./portal/pages/AdminOverviewPage.tsx'));
const BusinessSettingsPage = lazy(() => import('./portal/pages/BusinessSettingsPage.tsx'));
const PointsPage = lazy(() => import('./portal/pages/PointsPage.tsx'));
const CardsPage = lazy(() => import('./portal/pages/CardsPage.tsx'));
const RewardsPage = lazy(() => import('./portal/pages/RewardsPage.tsx'));
const AlliancesPage = lazy(() => import('./portal/pages/AlliancesPage.tsx'));
const RedemptionsPage = lazy(() => import('./portal/pages/RedemptionsPage.tsx'));
const ClientsPage = lazy(() => import('./portal/pages/ClientsPage.tsx'));
const InvitationPage = lazy(() => import('./pages/InvitationPage.tsx'));
const PublicLayout = lazy(() => import('./components/PublicLayout'));
import { RequireAdmin, RequirePortalAccess, RequireSession } from './auth/guards.tsx';

export default function App() {
  return (
    <RouteErrorBoundary><Suspense fallback={<div className="portal-loading" role="status">Cargando...</div>}><Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/precios" element={<PricingPage />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/recuperar" element={<RecoverPage />} />
      <Route path="/actualizar-password" element={<NewPasswordPage />} />

      <Route element={<RequireSession />}>
        <Route path="/completar-perfil" element={<CompleteProfilePage />} />
        <Route path="/completar-registro" element={<FinishRegistrationPage />} />
        <Route path="/registrar-negocio" element={<NewBusinessPage />} />
        <Route path="/invitacion/:token" element={<InvitationPage />} />
        <Route path="/acceso-restringido" element={<AccessDeniedPage />} />

        <Route element={<RequirePortalAccess />}>
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<PortalIndexRedirect />} />
            <Route path="negocio/:negocioId" element={<Outlet />}>
              <Route index element={<BusinessOverviewPage />} />
              <Route path="configuracion" element={<BusinessSettingsPage />} />
              <Route path="sucursales" element={<BranchesPage />} />
              <Route path="puntos" element={<PointsPage />} />
              <Route path="tarjetas" element={<CardsPage />} />
              <Route path="recompensas" element={<RewardsPage />} />
              <Route path="alianzas" element={<AlliancesPage />} />
              <Route path="equipo" element={<TeamPage />} />
              <Route path="visitas" element={<VisitsPage />} />
              <Route path="canjes" element={<RedemptionsPage />} />
              <Route path="cupones" element={<CouponsPage />} />
              <Route path="clientes" element={<ClientsPage />} />
            </Route>
            <Route path="admin" element={<RequireAdmin />}>
              <Route index element={<AdminOverviewPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<HomePage />} />
    </Routes></Suspense></RouteErrorBoundary>
  );
}
