import { Outlet, Route, Routes } from 'react-router-dom';

import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import ScrollToHash from './components/ScrollToHash.tsx';
import HomePage from './pages/HomePage.tsx';
import AboutPage from './pages/AboutPage.tsx';
import PricingPage from './pages/PricingPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import RecoverPage from './pages/RecoverPage.tsx';
import CompleteProfilePage from './pages/CompleteProfilePage.tsx';
import AccessDeniedPage from './pages/AccessDeniedPage.tsx';
import NewBusinessPage from './pages/NewBusinessPage.tsx';
import NewPasswordPage from './pages/NewPasswordPage.tsx';
import FinishRegistrationPage from './pages/FinishRegistrationPage.tsx';
import PortalLayout from './portal/PortalLayout.tsx';
import PortalIndexRedirect from './portal/pages/PortalIndexRedirect.tsx';
import BusinessOverviewPage from './portal/pages/BusinessOverviewPage.tsx';
import BranchesPage from './portal/pages/BranchesPage.tsx';
import TeamPage from './portal/pages/TeamPage.tsx';
import VisitsPage from './portal/pages/VisitsPage.tsx';
import CouponsPage from './portal/pages/CouponsPage.tsx';
import AdminOverviewPage from './portal/pages/AdminOverviewPage.tsx';
import BusinessSettingsPage from './portal/pages/BusinessSettingsPage.tsx';
import PointsPage from './portal/pages/PointsPage.tsx';
import CardsPage from './portal/pages/CardsPage.tsx';
import RewardsPage from './portal/pages/RewardsPage.tsx';
import RedemptionsPage from './portal/pages/RedemptionsPage.tsx';
import ClientsPage from './portal/pages/ClientsPage.tsx';
import InvitationPage from './pages/InvitationPage.tsx';
import { RequireAdmin, RequirePortalAccess, RequireSession } from './auth/guards.tsx';

function PublicLayout() {
  return (
    <>
      <Header />
      <ScrollToHash />
      <Outlet />
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Routes>
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
    </Routes>
  );
}
