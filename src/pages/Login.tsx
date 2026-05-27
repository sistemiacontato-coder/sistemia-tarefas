import React, { useState } from 'react';
import { supabaseRealClient } from '../supabaseClient';

type Step = 'form' | 'sent';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !supabaseRealClient) return;
    setLoading(true);
    setError('');

    const { error: err } = await supabaseRealClient.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });

    setLoading(false);
    if (err) {
      setError('Não foi possível enviar o link. Verifique o e-mail e tente novamente.');
    } else {
      setStep('sent');
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

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--surface)',
        border: '1px solid var(--outline)',
        borderRadius: '12px',
        padding: '40px 36px',
        boxShadow: 'var(--shadow-lg)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--primary)', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px var(--primary-glow)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#fff' }}>bolt</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-on-surface)', marginBottom: '4px' }}>
            SistemIA Tarefas
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Workspace</p>
        </div>

        {step === 'form' ? (
          <>
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-on-surface)', marginBottom: '6px' }}>
                Acesso por link mágico
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Informe seu e-mail. Vamos enviar um link seguro — sem senha.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted-dark)' }}>
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoFocus
                  required
                  style={{
                    padding: '11px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${error ? '#ef4444' : 'var(--outline-variant)'}`,
                    background: 'var(--surface-low)',
                    color: 'var(--text-on-surface)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    width: '100%',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; setError(''); }}
                  onBlur={e => e.target.style.borderColor = error ? '#ef4444' : 'var(--outline-variant)'}
                />
              </div>

              {error && (
                <p style={{ fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px', borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'var(--primary)', color: '#fff',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  opacity: loading || !email.trim() ? 0.6 : 1,
                  transition: 'opacity 0.15s, background 0.15s',
                  marginTop: '4px',
                }}
                onMouseOver={e => { if (!loading && email.trim()) (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-hover)'; }}
                onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary)'}
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: 'spin 1.2s linear infinite' }}>sync</span>
                    Enviando…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                    Enviar link de acesso
                  </>
                )}
              </button>
            </form>

            {/* Segurança */}
            <div style={{
              marginTop: '24px', padding: '12px 14px',
              background: 'var(--surface-low)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--outline)',
              display: 'flex', gap: '10px', alignItems: 'flex-start',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981', flexShrink: 0, marginTop: '1px' }}>shield</span>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-muted-dark)' }}>Sem senha.</strong>{' '}
                O link expira em 1 hora e só pode ser usado uma vez. Nenhuma credencial é armazenada no dispositivo.
              </p>
            </div>
          </>
        ) : (
          /* Estado: link enviado */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.1)', border: '2px solid rgba(16, 185, 129, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#10b981' }}>mark_email_read</span>
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-on-surface)', marginBottom: '8px' }}>
              Link enviado!
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '24px' }}>
              Acesse o e-mail <strong style={{ color: 'var(--text-on-surface)' }}>{email}</strong> e clique no link para entrar. Ele expira em 1 hora.
            </p>
            <button
              onClick={() => { setStep('form'); setError(''); }}
              style={{
                fontSize: '13px', color: 'var(--primary)', background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0,
              }}
            >
              ← Usar outro e-mail
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
