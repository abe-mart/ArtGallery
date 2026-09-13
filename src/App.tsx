import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import GalleryGate from './components/GalleryGate';
import { SettingsProvider } from './context/SettingsContext';

// Lazy load pages for better performance
const Home = lazy(() => import('./pages/Home'));
const Gallery = lazy(() => import('./pages/Gallery'));
const PaintingDetail = lazy(() => import('./pages/PaintingDetail'));
const About = lazy(() => import('./pages/About'));
const Admin = lazy(() => import('./pages/Admin'));

function App() {
  return (
    <Router>
      <SettingsProvider>
        <div className="flex flex-col min-h-screen font-sans text-charcoal bg-paper selection:bg-water-blue/20">
          <Navbar />
          <main className="flex-grow">
            <GalleryGate>
              <Suspense fallback={
                <div className="h-screen flex items-center justify-center bg-paper">
                  <div className="text-stone font-light tracking-widest animate-pulse">LOADING...</div>
                </div>
              }>
                <Routes>
                  <Route path="/" element={<Gallery />} />
                  <Route path="/info" element={<Home />} />
                  <Route path="/gallery/:id" element={<PaintingDetail />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/admin" element={<Admin />} />
                </Routes>
              </Suspense>
            </GalleryGate>
          </main>
          <Footer />
        </div>
      </SettingsProvider>
    </Router>
  );
}

export default App;
