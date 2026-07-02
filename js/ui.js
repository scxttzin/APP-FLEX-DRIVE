/* ============================================================
   UTILIDADES DE INTERFACE — ícones, formatação BR, toasts, modais
   ============================================================ */

/* ── ÍCONES (linha, estilo lucide) ── */
const I = {
  dashboard: '<path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/>',
  payments: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 1-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.1-.6-.6-2.1 2.7-2.7Z"/>',
  car: '<path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13M5 13h14v4H5v-4Z"/><circle cx="8" cy="17" r="1.4"/><circle cx="16" cy="17" r="1.4"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5 7-5s7 1.5 7 5"/><path d="M16 5a3.5 3.5 0 0 1 0 7M18 20c0-2.5-1-4-2.5-4.7"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  upload: '<path d="M12 17V5M7 10l5-5 5 5"/><path d="M5 21h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.7-2.5 2s1 1.7 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5M12 6.5v11"/>',
  alert: '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  whatsapp: '<path d="M3 21l1.6-4.5A8.4 8.4 0 1 1 12 20a8.5 8.5 0 0 1-4.3-1.2L3 21Z"/><path d="M8.5 9c0 4 3 6.5 6.5 6.5.7 0 1.3-1 1.3-1.5l-2-1-1 1c-1.5-.5-2.8-1.8-3.3-3.3l1-1-1-2C9.5 7.7 8.5 8.3 8.5 9Z" fill="currentColor" stroke="none"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7Z"/>',
  gauge: '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 14 8 8M4 18a9 9 0 1 1 16 0"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2v11Z"/><circle cx="12" cy="13" r="4"/>',
  renew: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  store: '<path d="M3 9l1.5-5h15L21 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18M9 20v-6h6v6"/>',
  map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/>',
  pin: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3"/>',
  pix: '<path d="M12 2 22 12 12 22 2 12 12 2Z"/><path d="M7 12h10M12 7v10"/>',
};

export function icon(name, cls = '') {
  const path = I[name] || I.info;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">${path}</svg>`;
}

/* ── FORMATAÇÃO BR ── */
export const fmt = {
  money(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
  date(d) { if (!d) return '—'; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); },
  dateShort(d) { if (!d) return '—'; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); },
  weekday(d) { if (!d) return ''; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('pt-BR', { weekday: 'long' }); },
  km(n) { return (Number(n) || 0).toLocaleString('pt-BR') + ' km'; },
  initials(name) { return (name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); },
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const daysFromToday = (d) => Math.round((new Date(d + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);

/* duração legível em meses e dias (aprox. 30 dias/mês) */
export function humanDuration(totalDays) {
  const meses = Math.floor(totalDays / 30); const dias = totalDays % 30; const p = [];
  if (meses) p.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`);
  if (dias || !meses) p.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
  return p.join(' e ');
}
/* status de vigência de um contrato a partir do fim (end_date) */
export function vigencia(end_date) {
  if (!end_date) return { dias: null, vencido: false, texto: 'Sem vigência definida', status: 'vigente' };
  const dias = daysFromToday(end_date);
  if (dias < 0) return { dias, vencido: true, texto: `Vencido há ${humanDuration(-dias)}`, status: 'vencido' };
  if (dias === 0) return { dias, vencido: false, texto: 'Vence hoje', status: 'vigente' };
  return { dias, vencido: false, texto: `Faltam ${humanDuration(dias)}`, status: 'vigente' };
}

/* status normalizado (atrasado se vencido e não pago) */
export function paymentStatus(p) {
  if (p.paid_date || p.status === 'pago') return 'pago';
  if (p.status === 'em_analise') return 'em_analise';
  if (daysFromToday(p.due_date) < 0) return 'atrasado';
  return 'pendente';
}

export const STATUS_BADGE = {
  pago: ['badge-green', 'Pago'], pendente: ['badge-amber', 'Pendente'], atrasado: ['badge-red', 'Atrasado'],
  em_analise: ['badge-blue', 'Em análise'],
  locado: ['badge-blue', 'Locado'], disponivel: ['badge-green', 'Disponível'], manutencao: ['badge-amber', 'Manutenção'],
  agendada: ['badge-amber', 'Agendada'], concluida: ['badge-green', 'Concluída'], andamento: ['badge-blue', 'Em andamento'],
  solicitada: ['badge-blue', 'Solicitada'],
  aberto: ['badge-amber', 'Aberto'], respondido: ['badge-green', 'Respondido'], fechado: ['badge-gray', 'Fechado'],
  vigente: ['badge-green', 'Vigente'], vencido: ['badge-red', 'Vencido'],
  renovacao_solicitada: ['badge-amber', 'Renovação pedida'], substituido: ['badge-gray', 'Substituído'],
};
export function badge(status) {
  const [cls, label] = STATUS_BADGE[status] || ['badge-gray', status];
  return `<span class="badge ${cls}"><span class="dot"></span>${label}</span>`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Sanitiza URL para uso em href: só permite http(s)/mailto/tel; bloqueia javascript:, data:, etc.
   Retorna '' (link inofensivo) para qualquer coisa suspeita. */
export function safeUrl(url) {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;             // esquemas permitidos
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';                    // outro esquema (javascript:, data:, vbscript:...) → bloqueia
  return 'https://' + u;                                            // sem esquema → assume https
}

/* ── TOAST ── */
export function toast(msg, type = 'info') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; document.body.appendChild(stack); }
  const t = document.createElement('div');
  t.className = `toast ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : ''}`;
  const ico = type === 'ok' ? icon('check', 't-ico') : type === 'err' ? icon('alert', 't-ico') : icon('info', 't-ico');
  t.innerHTML = `${ico}<span>${escapeHtml(msg)}</span>`;
  stack.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; setTimeout(() => t.remove(), 300); }, 3200);
}

/* ── MODAL ── */
export function modal({ title, icon: ico = 'edit', body, footer }) {
  let overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <span class="panel-ico">${icon(ico)}</span>
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" aria-label="Fechar">${icon('close')}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 250); };
  overlay.querySelector('.modal-close').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  return { overlay, close };
}

export function confirmDialog(message, onConfirm) {
  const m = modal({
    title: 'Confirmar', icon: 'alert',
    body: `<p class="body-sm" style="font-size:.95rem;color:var(--gray-2)">${escapeHtml(message)}</p>`,
    footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-danger" data-ok>Excluir</button>`,
  });
  m.overlay.querySelector('[data-cancel]').onclick = m.close;
  m.overlay.querySelector('[data-ok]').onclick = async () => { await onConfirm(); m.close(); };
}

/* copia texto para a área de transferência */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); return ok;
  }
}

/* abre/baixa um arquivo (data URL no demo, signed URL no real) */
export function openFile(url, fallbackName = 'documento') {
  if (!url) { toast('Arquivo de exemplo — envie um arquivo real para visualizar.', 'info'); return; }
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  if (url.startsWith('data:')) a.download = fallbackName;
  document.body.appendChild(a); a.click(); a.remove();
}
