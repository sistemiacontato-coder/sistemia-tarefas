import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Dashboard } from './pages/Dashboard';
import { ClientPortal } from './pages/ClientPortal';
import { Projects } from './pages/Projects';
import { Clients } from './pages/Clients';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { supabaseRealClient, isRealSupabaseConfigured } from './supabaseClient';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isRealSupabaseConfigured || !supabaseRealClient) {
      setLoading(false);
      return;
    }

    supabaseRealClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabaseRealClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--background)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-family)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <span className="material-symbols-outlined" style={{
            fontSize: '32px', color: 'var(--primary)',
            animation: 'spin 1.2s linear infinite',
          }}>bolt</span>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Carregando…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isAuthenticated = !isRealSupabaseConfigured || !!session;

  return (
    <Router>
      <Routes>
        {/* Rota pública: portal do cliente (acesso por token) */}
        <Route path="/share/:token" element={<ClientPortal />} />

        {/* Rota de login */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Rotas privadas */}
        <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/projects" element={isAuthenticated ? <Projects /> : <Navigate to="/login" replace />} />
        <Route path="/clients" element={isAuthenticated ? <Clients /> : <Navigate to="/login" replace />} />
        <Route path="/reports" element={isAuthenticated ? <Reports /> : <Navigate to="/login" replace />} />
        <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" replace />} />

        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
