import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Banner, Footer, HealthProvider, Nav } from "./components/Chrome";
import ErrorBoundary from "./components/ErrorBoundary";
import { Blobs } from "./components/ui";
import Activity from "./pages/Activity";
import Board from "./pages/Board";
import Evaluate from "./pages/Evaluate";
import Home from "./pages/Home";
import NewPolicy from "./pages/NewPolicy";
import PolicyDetail from "./pages/PolicyDetail";

function ScrollToTop() {
  const { pathname } = useLocation();
  // Block body, not a concise arrow: a concise arrow returns window.scrollTo's
  // value, React takes it as the cleanup function, and the tree unmounts with
  // "destroy is not a function". typecheck and build both pass either way.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <HealthProvider>
        <Blobs />
        <ScrollToTop />
        <Nav />
        <Banner />
        <main className="min-h-[70vh]">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/app" element={<Board />} />
            <Route path="/app/new" element={<NewPolicy />} />
            <Route path="/app/p/:id" element={<PolicyDetail />} />
            <Route path="/app/e/:id" element={<Evaluate />} />
            <Route path="/app/activity" element={<Activity />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </HealthProvider>
    </ErrorBoundary>
  );
}
