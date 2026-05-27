import { createClient } from '@supabase/supabase-js';

// Usa service role key: bypassa RLS e nunca é exposta ao browser
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: cfg } = await supabase
    .from('sia_tarefas_notif_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (!cfg?.evolution_url || !cfg?.whatsapp_number) {
    return new Response(JSON.stringify({ ok: false, reason: 'not configured' }), { status: 200 });
  }

  const today = new Date().toISOString().split('T')[0];

  const { data: tasks } = await supabase
    .from('sia_tarefas_tasks')
    .select('id, description, client_name, end_date, status')
    .is('parent_id', null)
    .not('status', 'eq', 'Concluído');

  if (!tasks?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  const sent: string[] = [];

  for (const task of tasks) {
    if (!task.end_date) continue;

    const daysUntil = Math.ceil(
      (new Date(task.end_date).getTime() - new Date(today).getTime()) / 86400000
    );
    const endFormatted = new Date(task.end_date + 'T00:00:00').toLocaleDateString('pt-BR');

    // Prazo próximo
    if (cfg.notify_expiring && daysUntil === cfg.expiring_days_before) {
      const { error } = await supabase.from('sia_tarefas_notif_log').insert({
        task_id: task.id, notif_type: 'expiring', date_key: today,
      });
      if (!error) {
        const days = cfg.expiring_days_before;
        await sendMsg(cfg,
          `⚠️ *Prazo próximo*\n\n*${task.description}* (${task.client_name}) vence em *${days} dia${days > 1 ? 's' : ''}*, em ${endFormatted}.\nStatus atual: ${task.status}.`
        );
        sent.push(`expiring:${task.id}`);
      }
    }

    // Vence hoje
    if (cfg.notify_due_today && daysUntil === 0) {
      const { error } = await supabase.from('sia_tarefas_notif_log').insert({
        task_id: task.id, notif_type: 'due_today', date_key: today,
      });
      if (!error) {
        await sendMsg(cfg,
          `📅 *Vence hoje*\n\n*${task.description}* (${task.client_name}) tem prazo *hoje*.\nStatus atual: ${task.status}.`
        );
        sent.push(`due_today:${task.id}`);
      }
    }

    // Em atraso
    if (cfg.notify_overdue && daysUntil < 0) {
      const daysLate = Math.abs(daysUntil);
      const { error } = await supabase.from('sia_tarefas_notif_log').insert({
        task_id: task.id, notif_type: 'overdue', date_key: today,
      });
      if (!error) {
        await sendMsg(cfg,
          `🔴 *Projeto em atraso*\n\n*${task.description}* (${task.client_name}) está atrasado há *${daysLate} dia${daysLate > 1 ? 's' : ''}*.\nPrazo era: ${endFormatted}\nStatus: ${task.status}.`
        );
        sent.push(`overdue:${task.id}`);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: sent.length, notifications: sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendMsg(cfg: Record<string, string>, text: string) {
  try {
    await fetch(`${cfg.evolution_url}/message/sendText/${cfg.evolution_instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.evolution_api_key },
      body: JSON.stringify({ number: cfg.whatsapp_number, text }),
    });
  } catch (e) {
    console.error('WhatsApp send error:', e);
  }
}
