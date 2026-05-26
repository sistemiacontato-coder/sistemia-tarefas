import React, { useState, useEffect } from 'react';

export interface ClientProfile {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  contact: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  notes: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (profile: ClientProfile) => void;
  initial?: Partial<ClientProfile>;
  isEdit?: boolean;
}

const empty: ClientProfile = {
  name: '', cnpj: '', email: '', phone: '', contact: '',
  cep: '', street: '', number: '', complement: '',
  neighborhood: '', city: '', state: '', notes: '',
};

const fmtCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const fmtPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
};

const fmtCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
};

export const ClientProfileModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, initial, isEdit }) => {
  const [form, setForm] = useState<ClientProfile>({ ...empty, ...initial });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setForm({ ...empty, ...initial }); setError(''); }
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (k: keyof ClientProfile, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('O nome da empresa é obrigatório.'); return; }
    onSubmit(form);
  };

  const fetchCEP = async () => {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setForm(f => ({ ...f, street: d.logradouro || f.street, neighborhood: d.bairro || f.neighborhood, city: d.localidade || f.city, state: d.uf || f.state }));
      }
    } catch { /* ignore */ }
  };

  const input = (label: string, key: keyof ClientProfile, opts?: { placeholder?: string; mask?: (v: string) => string; onBlur?: () => void; required?: boolean; half?: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', gridColumn: opts?.half ? 'span 1' : 'span 2' }}>
      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}{opts?.required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <input
        value={form[key]}
        onChange={e => set(key, opts?.mask ? opts.mask(e.target.value) : e.target.value)}
        onBlur={opts?.onBlur}
        placeholder={opts?.placeholder}
        style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', fontSize: '13px', background: 'var(--surface)', color: 'var(--text-on-surface)', outline: 'none', width: '100%' }}
        onFocus={e => e.target.style.borderColor = 'var(--primary)'}
      />
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '560px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--outline)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-on-surface)' }}>
            {isEdit ? 'Editar cliente' : 'Novo cliente'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>

          {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600 }}>{error}</div>}

          {/* Dados da Empresa */}
          <section>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>business</span>
              Dados da empresa
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {input('Nome da empresa', 'name', { required: true })}
              {input('CNPJ', 'cnpj', { mask: fmtCNPJ, placeholder: '00.000.000/0000-00', half: true })}
              {input('Email', 'email', { placeholder: 'contato@empresa.com.br', half: true })}
              {input('Telefone / WhatsApp', 'phone', { mask: fmtPhone, placeholder: '(00) 00000-0000', half: true })}
              {input('Responsável / Contato', 'contact', { placeholder: 'Nome do responsável', half: true })}
            </div>
          </section>

          {/* Endereço */}
          <section>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>location_on</span>
              Endereço
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {input('CEP', 'cep', { mask: fmtCEP, placeholder: '00000-000', onBlur: fetchCEP, half: true })}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estado</label>
                <select value={form.state} onChange={e => set('state', e.target.value)}
                  style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', fontSize: '13px', background: 'var(--surface)', color: form.state ? 'var(--text-on-surface)' : 'var(--text-muted)', outline: 'none' }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}>
                  <option value="">UF</option>
                  {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              {input('Logradouro', 'street', { placeholder: 'Rua, Avenida...' })}
              {input('Número', 'number', { placeholder: '123', half: true })}
              {input('Complemento', 'complement', { placeholder: 'Sala, Andar...', half: true })}
              {input('Bairro', 'neighborhood', { placeholder: 'Bairro', half: true })}
              {input('Cidade', 'city', { placeholder: 'Cidade', half: true })}
            </div>
          </section>

          {/* Observações */}
          <section>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>notes</span>
              Observações
            </p>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Informações adicionais sobre o cliente..."
              rows={3}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', fontSize: '13px', background: 'var(--surface)', color: 'var(--text-on-surface)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--outline-variant)'}
            />
          </section>

          {/* Ações */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px solid var(--outline)' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '9px 20px', background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted-dark)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit"
              style={{ padding: '9px 20px', background: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
              {isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
