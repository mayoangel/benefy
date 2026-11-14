import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import HomePage from './pages/HomePage.tsx';
import AboutPage from './pages/AboutPage.tsx';
import PricingPage from './pages/PricingPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import RecoverPage from './pages/RecoverPage.tsx';
import ScrollToHash from './components/ScrollToHash.tsx';

const authPaths = ['/login', '/registro', '/recuperar'];

export default function App() {
  const { pathname } = useLocation();
  const isAuth = authPaths.includes(pathname);

  return (
    <>
      {isAuth ? null : <Header />}
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/precios" element={<PricingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar" element={<RecoverPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      {isAuth ? null : <Footer />}
    </>
  );
}
