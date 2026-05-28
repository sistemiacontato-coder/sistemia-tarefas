import React, { useState } from 'react';
import { supabaseRealClient } from '../supabaseClient';

type Mode = 'login' | 'signup';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '11px', borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--primary)', color: '#fff',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'all 0.15s',
              marginTop: '4px',
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
