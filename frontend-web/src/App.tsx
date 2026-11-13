import { Routes, Route } from 'react-router-dom';
import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import HomePage from './pages/HomePage.tsx';
import AboutPage from './pages/AboutPage.tsx';
import PricingPage from './pages/PricingPage.tsx';
import ScrollToHash from './components/ScrollToHash.tsx';

export default function App() {
  return (
    <>
      <Header />
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/precios" element={<PricingPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      <Footer />
    </>
  );
}
