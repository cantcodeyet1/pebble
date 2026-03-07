import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Ecclesia } from "./screens/Ecclesia";
import { AddEntry } from "./screens/AddEntry";
import { Palaestra } from "./screens/Palaestra";
import { Callistratum } from "./screens/Callistratum";
import { Philippics } from "./screens/Philippics";
import { BottomNav } from "./components/BottomNav";
import { classify} from "./services/ai.service";

const ScreenWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    className="screen"
  >
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

React.useEffect(() => {
  classify('ephemeral').then(console.log).catch(console.error)
}, [])

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <ScreenWrapper>
              <Ecclesia />
            </ScreenWrapper>
          }
        />
        <Route path="/palaestra" element={<Palaestra />} />
        <Route
          path="/library"
          element={
            <ScreenWrapper>
              <Callistratum />
            </ScreenWrapper>
          }
        />
        <Route
          path="/stats"
          element={
            <ScreenWrapper>
              <Philippics />
            </ScreenWrapper>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <Router>
      <div className="app-shell">
        <div className="phone-wrap">
          <AnimatedRoutes />
          <BottomNav />
          {/* Add sheet overlays the current screen */}
          <AddEntry />
        </div>
      </div>
    </Router>
  );
}
