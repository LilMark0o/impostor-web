import { Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { WizardShell } from './components/wizard/WizardShell';
import RevealPage from './pages/RevealPage';
import AuthButton from './components/AuthButton';

function LoginPage() {
  const { isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-stone-900 text-3xl font-bold mb-2">🎭 El Impostor</h1>
        <p className="text-stone-500">¿Quién está mintiendo?</p>
      </div>
      {isLoading ? (
        <div className="text-stone-400 text-sm">Cargando…</div>
      ) : (
        <AuthButton />
      )}
    </div>
  );
}

function AuthGate() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Cargando…</div>
      </div>
    );
  }

  return token ? <WizardShell /> : <LoginPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/p/:token" element={<RevealPage />} />
      <Route path="/*" element={<AuthGate />} />
    </Routes>
  );
}
