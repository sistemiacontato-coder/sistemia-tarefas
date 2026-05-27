import React, { useState } from 'react';
import { supabaseRealClient } from '../supabaseClient';

type Mode = 'login' | 'signup';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseRealClient) return;
    setLoading(true);
    setError('');

    const { error: err } = mode === 'login'
      ? await supabaseRealClient.auth.signInWithPassword({ email: email.trim(), password })
      : await supabaseRealClient.auth.signUp({ email: email.trim(), password });

    setLoading(false);
    if (err) {
      if (err.message.includes('Invalid login')) setError('E-mail ou senha incorretos.');
      else if (err.message.includes('already registered')) setError('E-mail já cadastrado. Faça login.');
      else setError(err.message);
    }
  };

  const handleGoogle = async () => {
    if (!supabaseRealClient) return;
    setGoogleLoading(true);
    await supabaseRealClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--font-family)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: 'var(--surface)',
        border: '1px solid var(--outline)',
        borderRadius: '14px',
        padding: '40px 36px',
        boxShadow: 'var(--shadow-lg)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--primary)', margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px var(--primary-glow)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#fff' }}>bolt</span>
          </div>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-on-surface)', marginBottom: '2px' }}>
            SistemIA Tarefas
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Workspace
          </p>
        </div>

        {/* Google — acesso com um clique */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            padding: '11px 16px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface-low)', color: 'var(--text-on-surface)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            opacity: googleLoading ? 0.7 : 1, transition: 'all 0.15s',
            marginBottom: '16px',
          }}
          onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)'; }}
          onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--outline-variant)'; }}
        >
          {googleLoading ? (
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)', animation: 'spin 1.2s linear infinite' }}>sync</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
          )}
          {googleLoading ? 'Conectando…' : 'Entrar com Google'}
        </button>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--outline)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ou</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--outline)' }} />
        </div>

        {/* Formulário e-mail + senha */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            placeholder="E-mail"
            required
            autoComplete="email"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'}
          />

          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Senha"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={{ ...inputStyle, paddingRight: '40px' }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {showPass ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>

          {error && (
            <p style={{ fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', margin: '0' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '11px', borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--primary)', color: '#fff',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'all 0.15s',
              marginTop: '2px',
            }}
            onMouseOver={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-hover)'; }}
            onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary)'}
          >
            {loading
              ? <><span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'spin 1.2s linear infinite' }}>sync</span>Entrando…</>
              : mode === 'login' ? 'Entrar' : 'Criar conta'
            }
          </button>
        </form>

        {/* Toggle modo */}
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '12px', padding: 0 }}
          >
            {mode === 'login' ? 'Criar agora' : 'Fazer login'}
          </button>
        </p>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--outline-variant)',
  background: 'var(--surface-low)',
  color: 'var(--text-on-surface)',
  fontSize: '13px',
  outline: 'none',
  transition: 'border-color 0.15s',
};
