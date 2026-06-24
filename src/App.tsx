import { Routes, Route } from 'react-router-dom';
import { WizardShell } from './components/wizard/WizardShell';
import RevealPage from './pages/RevealPage';

export default function App() {
  return (
    <Routes>
      <Route path="/p/:token" element={<RevealPage />} />
      <Route path="/*" element={<WizardShell />} />
    </Routes>
  );
}
