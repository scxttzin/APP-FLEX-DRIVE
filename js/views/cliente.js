/* ============================================================
   ÁREA DO CLIENTE
   ============================================================ */
import { api } from '../api.js';
import { CONFIG } from '../config.js';
import { buildShell } from './shell.js';
import { pixPayload, pixQrDataUrl } from '../pix.js';
import {
  icon, fmt, badge, toast, modal, openFile, copyText,
  paymentStatus, todayISO, daysFromToday, escapeHtml, vigencia,
} from '../ui.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export async function renderCliente(root, user, onLogout) {
  const nav = [
    { key: 'inicio',     label: 'Início',          icon: 'dashboard' },
    { key: 'pagamentos', label: 'Pagamentos',      icon: 'calendar' },
    { key: 'veiculo',    label: 'Meu Veículo',     icon: 'car' },
    { key: 'manutencao', label: 'Manutenção',      icon: 'wrench' },
    { key: 'contrato',   label: 'Contrato',        icon: 'doc' },
    { key: 'contato',    label: 'Falar com a empresa', icon: 'phone' },
  ];
  const shell = buildShell({ root, user, roleLabel: 'Motorista', nav, onNav: go, onLogout });

  const loading = () => `<div class="loading-screen"><div class="spinner"></div></div>`;
  let calRef = new Date(); // mês em exibição no calendário

  async function go(key) {
    shell.setActive(key);
    refreshNotifications();
    shell.content.innerHTML = loading();
    try {
      if (key === 'inicio') await pageInicio();
      else if (key === 'pagamentos') await pagePagamentos();
      else if (key === 'veiculo') await pageVeiculo();
      else if (key === 'manutencao') await pageManutencao();
      else if (key === 'contrato') await pageContrato();
      else if (key === 'contato') await pageContato();
    } catch (err) {
      shell.content.innerHTML = `<div class="panel glass"><div class="empty">${icon('alert', 'empty-ico')}<p>${escapeHtml(err.message)}</p></div></div>`;
    }
  }

  async function loadAll() {
    const [vehicles, payments] = await Promise.all([
      api.listVehicles({ client_id: user.id }),
      api.listPayments({ client_id: user.id }),
    ]);
    return { vehicle: vehicles[0] || null, payments };
  }

  function nextPayment(payments) {
    const pend = payments.filter((p) => paymentStatus(p) !== 'pago').sort((a, b) => a.due_date.localeCompare(b.due_date));
    return pend[0] || null;
  }

  /* ════════════ INÍCIO ════════════ */
  async function pageInicio() {
    shell.setTitle(`Olá, ${user.full_name?.split(' ')[0] || ''} 👋`, 'Sua área Flex Drive');
    const { vehicle, payments } = await loadAll();
    const np = nextPayment(payments);

    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="grid-cols grid-2-3">
          <div>
            ${np ? paymentHero(np) : `<div class="pay-hero" style="background:linear-gradient(135deg,var(--green),#22c55e)"><div class="ph-label">Pagamentos</div><div class="ph-val">Tudo em dia!</div><div class="ph-date">${icon('check')} Nenhum pagamento pendente</div></div>`}

            <div class="panel glass" style="margin-top:1.4rem">
              <div class="panel-head"><span class="panel-ico">${icon('calendar')}</span><h3>Calendário de pagamentos</h3></div>
              <div id="cal-mount"></div>
              <div style="display:flex;gap:1.2rem;flex-wrap:wrap;margin-top:1rem;font-size:.78rem;color:var(--gray-3)">
                <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:4px;background:var(--blue)"></span>A vencer</span>
                <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:4px;background:var(--green)"></span>Pago</span>
                <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border-radius:4px;background:var(--red)"></span>Atrasado</span>
              </div>
            </div>
          </div>

          <div>
            ${vehicle ? `
            <div class="panel glass">
              <div class="panel-head"><span class="panel-ico">${icon('car')}</span><h3>Meu veículo</h3></div>
              <div class="veh-thumb" style="border-radius:16px;margin-bottom:1rem"><img src="${vehicle.photo_url || 'assets/car-placeholder.png'}" alt="" onerror="this.onerror=null;this.src='assets/car-placeholder.png'" style="${vehicle.photo_url ? 'height:100%;width:100%;object-fit:cover' : ''}"></div>
              <h3 style="margin-bottom:.2rem">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</h3>
              <span class="plate" style="display:inline-block;font-weight:700;font-size:.8rem;letter-spacing:.08em;color:var(--gray-3);background:var(--off2);padding:.2rem .5rem;border-radius:6px">${escapeHtml(vehicle.plate)}</span>
              <div class="info-list" style="margin-top:1rem">
                <div class="info-row"><span class="k">Ano</span><span class="v">${vehicle.year}</span></div>
                <div class="info-row"><span class="k">Cor</span><span class="v">${escapeHtml(vehicle.color)}</span></div>
                <div class="info-row"><span class="k">Valor semanal</span><span class="v">${fmt.money(vehicle.weekly_value)}</span></div>
              </div>
              <button class="btn btn-ghost btn-block" id="ver-veh" style="margin-top:1rem">Ver detalhes</button>
            </div>` : `<div class="panel glass"><div class="empty">${icon('car', 'empty-ico')}<p>Nenhum veículo vinculado ainda.</p></div></div>`}

            <div class="panel glass">
              <div class="panel-head"><span class="panel-ico">${icon('phone')}</span><h3>Precisa de ajuda?</h3></div>
              <p class="body-sm" style="margin-bottom:1rem">Fale direto com a equipe Flex Drive.</p>
              <a class="btn btn-blue btn-block" href="https://wa.me/${CONFIG.EMPRESA.whatsapp}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp</a>
              <button class="btn btn-glass btn-block" id="ir-contato" style="margin-top:.6rem">${icon('send')} Solicitar contato</button>
            </div>
          </div>
        </div>
      </div>`;

    mountCalendar(shell.content.querySelector('#cal-mount'), payments);
    shell.content.querySelector('#ver-veh')?.addEventListener('click', () => go('veiculo'));
    shell.content.querySelector('#ir-contato')?.addEventListener('click', () => go('contato'));
    shell.content.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => openPayModal(payments.find((p) => p.id === b.dataset.pay)));
  }

  function paymentHero(p) {
    const st = paymentStatus(p);
    if (st === 'em_analise') {
      return `
        <div class="pay-hero" style="background:linear-gradient(135deg,#6366F1,#8B5CF6)">
          <div class="ph-label">Pagamento em análise</div>
          <div class="ph-val">${fmt.money(p.amount)}</div>
          <div class="ph-date">${icon('clock')} Comprovante enviado · aguardando confirmação da empresa</div>
        </div>`;
    }
    const dias = daysFromToday(p.due_date);
    const quando = st === 'atrasado' ? `Vencido há ${Math.abs(dias)} dia(s)` : dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`;
    const bg = st === 'atrasado' ? 'linear-gradient(135deg,var(--red),#f87171)' : 'linear-gradient(135deg,var(--blue),var(--blue-light))';
    return `
      <div class="pay-hero" style="background:${bg}">
        <div class="ph-label">Próximo pagamento</div>
        <div class="ph-val">${fmt.money(p.amount)}</div>
        <div class="ph-date">${icon('calendar')} ${fmt.weekday(p.due_date)}, ${fmt.date(p.due_date)} · ${quando}</div>
        <div style="margin-top:1.1rem;display:flex;gap:.6rem;flex-wrap:wrap">
          <button class="btn btn-sm" data-pay="${p.id}" style="background:#fff;color:var(--blue);font-weight:700">${icon('pix')} Pagar com Pix</button>
          <a class="btn btn-glass btn-sm" href="https://wa.me/${CONFIG.EMPRESA.whatsapp}" target="_blank" rel="noopener" style="background:rgba(255,255,255,.85)">${icon('whatsapp')} Dúvidas</a>
        </div>
      </div>`;
  }

  /* ── Modal de pagamento Pix + envio de comprovante ── */
  async function openPayModal(p) {
    if (!p) return;
    const pix = CONFIG.EMPRESA.pix || {};
    const payload = pixPayload({ key: pix.chave, name: pix.nome, city: pix.cidade, amount: p.amount, txid: 'FLEX' + (p.week_ref || '') });
    const hasKey = !!payload;
    const m = modal({
      title: 'Pagar com Pix', icon: 'pix',
      body: `
        <div class="pix-amount">
          <div class="pa-label">Valor a pagar</div>
          <div class="pa-val">${fmt.money(p.amount)}</div>
          <div class="body-sm">Vencimento ${fmt.date(p.due_date)}${p.week_ref ? ' · Semana ' + p.week_ref : ''}</div>
        </div>
        ${hasKey ? `
          <div class="pix-qr" id="pix-qr"><div class="spinner"></div></div>
          <div class="pix-copy">
            <div class="pix-code" id="pix-code">${escapeHtml(payload)}</div>
            <button class="btn btn-blue btn-sm" id="pix-copy-btn">${icon('copy')} Copiar</button>
          </div>
          <div class="pix-steps">
            <div class="pix-step"><span class="ps-num">1</span><span>Copie o código ou escaneie o QR no app do seu banco.</span></div>
            <div class="pix-step"><span class="ps-num">2</span><span>Confirme o pagamento de <strong>${fmt.money(p.amount)}</strong>.</span></div>
            <div class="pix-step"><span class="ps-num">3</span><span>Anexe o comprovante abaixo e envie.</span></div>
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Comprovante (PDF ou imagem)</label>
            <div class="upload-mini" id="rcpt-drop">${icon('upload')} Toque para anexar o comprovante</div>
            <input type="file" id="rcpt-file" accept="application/pdf,image/*" hidden>
          </div>
        ` : `
          <div class="alert alert-info show">A chave Pix ainda não foi configurada pela empresa. Fale no WhatsApp para combinar o pagamento.</div>
        `}`,
      footer: hasKey
        ? `<button class="btn btn-glass" data-cancel>Fechar</button><button class="btn btn-blue" data-send disabled>${icon('check')} Enviar comprovante</button>`
        : `<a class="btn btn-blue btn-block" href="https://wa.me/${CONFIG.EMPRESA.whatsapp}" target="_blank" rel="noopener">${icon('whatsapp')} Falar no WhatsApp</a>`,
    });
    if (!hasKey) { m.overlay.querySelector('a')?.addEventListener('click', m.close); return; }

    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    pixQrDataUrl(payload).then((url) => { const el = m.overlay.querySelector('#pix-qr'); if (el) el.innerHTML = url ? `<img src="${url}" alt="QR Pix">` : `<div class="body-sm" style="padding:1rem">QR indisponível — use o código abaixo.</div>`; });
    m.overlay.querySelector('#pix-copy-btn').onclick = async () => { const ok = await copyText(payload); toast(ok ? 'Código Pix copiado!' : 'Copie manualmente o código.', ok ? 'ok' : 'info'); };

    let chosen = null;
    const drop = m.overlay.querySelector('#rcpt-drop');
    const fin = m.overlay.querySelector('#rcpt-file');
    const sendBtn = m.overlay.querySelector('[data-send]');
    const setFile = (f) => { chosen = f; drop.classList.add('has-file'); drop.innerHTML = `${icon('check')} ${escapeHtml(f.name)}`; sendBtn.disabled = false; };
    drop.onclick = () => fin.click();
    fin.onchange = () => { if (fin.files[0]) setFile(fin.files[0]); };
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });

    sendBtn.onclick = async () => {
      sendBtn.disabled = true; sendBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span> Enviando...';
      try {
        await api.submitReceipt(p, chosen);
        m.close();
        toast('Comprovante enviado! A empresa vai confirmar. ✅', 'ok');
        whatsappNotice(`Olá! Acabei de pagar ${fmt.money(p.amount)} (venc. ${fmt.date(p.due_date)}) pelo app e enviei o comprovante.`);
        go('inicio');
      } catch (err) { toast('Erro: ' + err.message, 'err'); sendBtn.disabled = false; sendBtn.innerHTML = `${icon('check')} Enviar comprovante`; }
    };
  }

  function whatsappNotice(text) {
    const m = modal({
      title: 'Avisar a empresa', icon: 'whatsapp',
      body: `<p class="body-sm" style="font-size:.92rem">Quer avisar a Flex Drive pelo WhatsApp que o pagamento foi feito? <span class="muted">(opcional)</span></p>`,
      footer: `<button class="btn btn-glass" data-cancel>Agora não</button><a class="btn btn-blue" href="https://wa.me/${CONFIG.EMPRESA.whatsapp}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" data-go>${icon('whatsapp')} Avisar</a>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-go]').onclick = m.close;
  }

  /* ════════════ PAGAMENTOS ════════════ */
  async function pagePagamentos() {
    shell.setTitle('Pagamentos', 'Seu calendário e histórico');
    const { payments } = await loadAll();
    const np = nextPayment(payments);
    const pagosCount = payments.filter((p) => paymentStatus(p) === 'pago').length;

    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="kpi-grid">
          ${np ? `<div class="kpi glass"><div class="kpi-top"><span class="kpi-label">Próximo vencimento</span><span class="kpi-ico">${icon('clock')}</span></div><div class="kpi-val" style="font-size:1.4rem">${fmt.date(np.due_date)}</div><div class="kpi-delta">${fmt.money(np.amount)}</div></div>` : ''}
          <div class="kpi glass"><div class="kpi-top"><span class="kpi-label">Pagamentos efetuados</span><span class="kpi-ico">${icon('check')}</span></div><div class="kpi-val">${pagosCount}</div><div class="kpi-delta up">pagamentos concluídos</div></div>
        </div>
        <div class="grid-cols grid-2-3">
          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('calendar')}</span><h3>Calendário</h3></div>
            <div id="cal-mount"></div>
          </div>
          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('payments')}</span><h3>Histórico</h3></div>
            <div class="table-wrap"><table class="tbl">
              <thead><tr><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead>
              <tbody>${payments.length ? payments.slice().sort((a, b) => b.due_date.localeCompare(a.due_date)).map((p) => {
                const st = paymentStatus(p);
                return `<tr><td>${fmt.date(p.due_date)}</td><td class="cell-strong mono">${fmt.money(p.amount)}</td><td>${badge(st)}</td>
                  <td class="row-actions">${(st === 'pendente' || st === 'atrasado') ? `<button class="btn btn-blue btn-sm" data-pay="${p.id}">${icon('pix')} Pagar</button>` : ''}</td></tr>`;
              }).join('') : `<tr><td colspan="4"><div class="empty">${icon('info', 'empty-ico')}<p>Sem pagamentos.</p></div></td></tr>`}</tbody>
            </table></div>
          </div>
        </div>
      </div>`;
    mountCalendar(shell.content.querySelector('#cal-mount'), payments);
    shell.content.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => openPayModal(payments.find((p) => p.id === b.dataset.pay)));
  }

  /* calendário com pré/próximo mês */
  function mountCalendar(mount, payments) {
    const byDate = {};
    payments.forEach((p) => { byDate[p.due_date] = paymentStatus(p); });
    const render = () => {
      const y = calRef.getFullYear(), mo = calRef.getMonth();
      const first = new Date(y, mo, 1); const startDow = first.getDay();
      const daysInMonth = new Date(y, mo + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startDow; i++) cells.push('<div class="cal-cell empty"></div>');
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = ds === todayISO();
        const st = byDate[ds];
        let cls = 'cal-cell';
        if (st) cls += ' pay' + (st === 'pago' ? ' paid' : st === 'atrasado' ? ' late' : '');
        else if (isToday) cls += ' today';
        cells.push(`<div class="${cls}" title="${st ? 'Pagamento ' + st : ''}">${d}</div>`);
      }
      mount.innerHTML = `
        <div class="cal">
          <div class="cal-head">
            <button class="icon-btn" id="cal-prev">${icon('chevL')}</button>
            <span class="cal-month">${MONTHS[mo]} ${y}</span>
            <button class="icon-btn" id="cal-next">${icon('chevR')}</button>
          </div>
          <div class="cal-grid">
            ${DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
            ${cells.join('')}
          </div>
        </div>`;
      mount.querySelector('#cal-prev').onclick = () => { calRef = new Date(y, mo - 1, 1); render(); };
      mount.querySelector('#cal-next').onclick = () => { calRef = new Date(y, mo + 1, 1); render(); };
    };
    render();
  }

  /* ════════════ MEU VEÍCULO ════════════ */
  async function pageVeiculo() {
    shell.setTitle('Meu Veículo', 'Dados e documentação');
    const { vehicle } = await loadAll();
    if (!vehicle) { shell.content.innerHTML = `<div class="panel glass"><div class="empty">${icon('car', 'empty-ico')}<p>Nenhum veículo vinculado à sua conta.</p></div></div>`; return; }
    const documents = await api.listDocuments({ vehicle_id: vehicle.id });

    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="grid-cols grid-2-3">
          <div class="panel glass">
            <div class="veh-thumb" style="border-radius:18px;height:200px;margin-bottom:1.2rem"><img src="${vehicle.photo_url || 'assets/car-placeholder.png'}" style="${vehicle.photo_url ? 'height:100%;width:100%;object-fit:cover' : 'height:140px'}" alt="" onerror="this.onerror=null;this.src='assets/car-placeholder.png'"></div>
            <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:1rem">
              <div><h2 style="font-size:1.4rem">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</h2>
              <span class="plate" style="display:inline-block;font-weight:700;font-size:.8rem;letter-spacing:.08em;color:var(--gray-3);background:var(--off2);padding:.2rem .5rem;border-radius:6px;margin-top:.3rem">${escapeHtml(vehicle.plate)}</span></div>
              <div style="margin-left:auto">${badge('locado')}</div>
            </div>
            <div class="info-list">
              <div class="info-row"><span class="k">Ano</span><span class="v">${vehicle.year}</span></div>
              <div class="info-row"><span class="k">Cor</span><span class="v">${escapeHtml(vehicle.color)}</span></div>
              <div class="info-row"><span class="k">KM atual</span><span class="v">${fmt.km(vehicle.km)}</span></div>
              <div class="info-row"><span class="k">Renavam</span><span class="v">${escapeHtml(vehicle.renavam || '—')}</span></div>
              <div class="info-row"><span class="k">Próxima revisão</span><span class="v">${fmt.date(vehicle.next_revision)}</span></div>
              <div class="info-row"><span class="k">Valor semanal</span><span class="v text-blue">${fmt.money(vehicle.weekly_value)}</span></div>
            </div>
          </div>

          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('shield')}</span><h3>Documentação do carro</h3></div>
            ${documents.length ? documents.map((d) => `
              <div class="file-row">
                <div class="file-ico blue">${icon('doc')}</div>
                <div class="f-meta"><div class="f-name">${escapeHtml(d.title)}</div><div class="f-sub">${escapeHtml(d.type)}</div></div>
                <button class="icon-btn" title="Abrir" data-open="${d.id}">${icon('download')}</button>
              </div>`).join('') : `<div class="empty">${icon('info', 'empty-ico')}<p>Nenhum documento disponibilizado ainda.</p></div>`}
          </div>
        </div>
      </div>`;

    shell.content.querySelectorAll('[data-open]').forEach((b) => b.onclick = async () => {
      const rec = documents.find((x) => x.id === b.dataset.open);
      openFile(await api.fileUrl(rec), rec.file_name || 'documento.pdf');
    });
  }

  /* ════════════ MANUTENÇÃO (motorista) ════════════ */
  async function pageManutencao() {
    shell.setTitle('Manutenção', 'Solicite manutenção do seu veículo');
    const { vehicle } = await loadAll();
    if (!vehicle) { shell.content.innerHTML = `<div class="panel glass"><div class="empty">${icon('car', 'empty-ico')}<p>Nenhum veículo vinculado à sua conta.</p></div></div>`; return; }
    const maints = (await api.listMaintenances({ vehicle_id: vehicle.id })).filter((m) => m.status !== 'concluida' || m.requested_by);
    const agendadas = maints.filter((m) => m.status === 'agendada' && m.requested_by === user.id);

    shell.content.innerHTML = `
      <div class="fade-in">
        ${agendadas.length ? `<div class="alert alert-info show" style="margin-bottom:1.2rem;display:flex;align-items:flex-start;gap:10px">${icon('wrench')} <span>${agendadas.map((m) => `<strong>${escapeHtml(m.type || 'Manutenção')}</strong> agendada para <strong>${fmt.date(m.scheduled_date)}</strong>${m.cost ? ' · valor previsto ' + fmt.money(m.cost) : ''}${m.partner_name ? ' — Local: <strong>' + escapeHtml(m.partner_name) + '</strong>' + (m.partner_location ? ' (' + escapeHtml(m.partner_location) + ')' : '') : ''}.`).join('<br>')}</span></div>` : ''}
        <div class="grid-cols grid-2-3">
          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('wrench')}</span><h3>Solicitar manutenção</h3></div>
            <p class="body-sm" style="margin-bottom:1.1rem">Informe a quilometragem atual e envie uma foto do painel. A empresa recebe o pedido na hora.</p>
            <button class="btn btn-blue btn-block" id="req-completa">${icon('wrench')} Manutenção completa</button>
            <button class="btn btn-ghost btn-block" id="req-desgaste" style="margin-top:.7rem">${icon('alert')} Relatar desgaste</button>
            <div class="info-list" style="margin-top:1.3rem">
              <div class="info-row"><span class="k">Veículo</span><span class="v">${escapeHtml(vehicle.brand + ' ' + vehicle.model)}</span></div>
              <div class="info-row"><span class="k">Placa</span><span class="v">${escapeHtml(vehicle.plate)}</span></div>
              <div class="info-row"><span class="k">KM registrado</span><span class="v">${fmt.km(vehicle.km)}</span></div>
            </div>
          </div>
          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('clock')}</span><h3>Minhas solicitações</h3></div>
            ${maints.length ? maints.map((m) => {
                const rawLink = m.status === 'agendada' ? (m.partner_link || (m.partner_location ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(m.partner_location) : '')) : '';
                const goUrl = rawLink && !/^https?:\/\//i.test(rawLink) ? 'https://' + rawLink : rawLink;
                return `
              <div class="file-row" style="align-items:flex-start;flex-wrap:wrap;gap:10px">
                <div class="file-ico blue">${icon('wrench')}</div>
                <div class="f-meta" style="flex:1;min-width:150px">
                  <div class="f-name">${escapeHtml(m.type || 'Manutenção')}${m.km ? ' · ' + fmt.km(m.km) : ''}</div>
                  <div class="f-sub" style="white-space:normal">${m.status === 'agendada' ? 'Agendada para ' : 'Solicitada em '}${fmt.date(m.scheduled_date)}${m.status === 'agendada' && m.cost ? ' · ' + fmt.money(m.cost) : ''}${m.description ? ' · ' + escapeHtml(m.description) : ''}</div>
                  ${m.status === 'agendada' && m.partner_name ? `<div class="f-sub" style="margin-top:.35rem;color:var(--blue);display:flex;gap:6px;align-items:flex-start">${icon('store')} <span>${escapeHtml(m.partner_name)}${m.partner_location ? ' · ' + escapeHtml(m.partner_location) : ''}</span></div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
                  ${badge(m.status)}
                  ${goUrl ? `<a class="btn btn-blue btn-sm" href="${escapeHtml(goUrl)}" target="_blank" rel="noopener">${icon('map')} Ir até lá</a>` : ''}
                </div>
              </div>`;
              }).join('') : `<div class="empty">${icon('info', 'empty-ico')}<p>Nenhuma solicitação ainda.</p></div>`}
          </div>
        </div>
      </div>`;

    shell.content.querySelector('#req-completa').onclick = () => openMaintReq('completa', vehicle, () => go('manutencao'));
    shell.content.querySelector('#req-desgaste').onclick = () => openMaintReq('desgaste', vehicle, () => go('manutencao'));
  }

  function openMaintReq(category, vehicle, after) {
    const isDesg = category === 'desgaste';
    const m = modal({
      title: isDesg ? 'Relatar desgaste' : 'Manutenção completa', icon: 'wrench',
      body: `
        <form id="f-maint">
          ${isDesg ? `<div class="field"><label>Tipo de desgaste</label>
            <select class="select" name="wear_type">
              <option value="pneus">Desgaste de pneus</option>
              <option value="pastilha">Pastilha de freio</option>
              <option value="outros">Outros</option>
            </select></div>` : ''}
          <div class="field"><label>Quilometragem atual (km)</label><input class="input" type="number" name="km" placeholder="Ex.: 31500" required></div>
          <div class="field"><label>Foto do painel (quilometragem)</label>
            <div class="upload-mini" id="km-drop">${icon('camera')} Toque para tirar / enviar a foto</div>
            <input type="file" id="km-file" accept="image/*" capture="environment" hidden></div>
          <div class="field" style="margin-bottom:0"><label>Observação (opcional)</label><textarea class="textarea" name="description" placeholder="Descreva o problema, se houver"></textarea></div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save disabled>${icon('send')} Enviar solicitação</button>`,
    });
    let photo = null;
    const f = m.overlay.querySelector('#f-maint');
    const drop = m.overlay.querySelector('#km-drop');
    const fin = m.overlay.querySelector('#km-file');
    const send = m.overlay.querySelector('[data-save]');
    const setPhoto = (file) => { photo = file; drop.classList.add('has-file'); drop.innerHTML = `${icon('check')} ${escapeHtml(file.name)}`; send.disabled = false; };
    drop.onclick = () => fin.click();
    fin.onchange = () => { if (fin.files[0]) setPhoto(fin.files[0]); };
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) setPhoto(e.dataTransfer.files[0]); });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    send.onclick = async () => {
      if (!f.reportValidity()) return;
      if (!photo) { toast('Anexe a foto do painel.', 'err'); return; }
      const d = Object.fromEntries(new FormData(f));
      send.disabled = true; send.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span> Enviando...';
      try {
        await api.requestMaintenance({ vehicle_id: vehicle.id, km: d.km, file: photo, category, wear_type: isDesg ? d.wear_type : null, description: d.description });
        m.close(); toast('Solicitação enviada à empresa! 🔧', 'ok'); after && after();
      } catch (err) { toast('Erro: ' + err.message, 'err'); send.disabled = false; send.innerHTML = `${icon('send')} Enviar solicitação`; }
    };
  }

  /* ════════════ CONTRATO ════════════ */
  async function pageContrato() {
    shell.setTitle('Contrato', 'Vigência, documento e renovação');
    const contracts = await api.listContracts({ client_id: user.id });
    if (!contracts.length) { shell.content.innerHTML = `<div class="panel glass" style="max-width:640px"><div class="empty">${icon('info', 'empty-ico')}<p>Nenhum contrato disponível ainda.<br>Assim que a empresa enviar, ele aparece aqui.</p></div></div>`; return; }

    const active = contracts.find((c) => c.status !== 'substituido' && c.status !== 'encerrado') || contracts[0];
    const vig = vigencia(active.end_date);
    const stBadge = vig.vencido ? 'vencido' : (active.status === 'renovacao_solicitada' ? 'renovacao_solicitada' : 'vigente');

    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="grid-cols grid-2-3">
          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('doc')}</span><h3>Contrato atual</h3>${badge(stBadge)}</div>
            ${vig.vencido ? `<div class="alert alert-error show" style="display:flex;gap:8px;align-items:center">${icon('alert')} A vigência do seu contrato terminou. Solicite a renovação para continuar.</div>` : ''}
            <div class="info-list">
              <div class="info-row"><span class="k">Documento</span><span class="v">${escapeHtml(active.title)}</span></div>
              <div class="info-row"><span class="k">Início da vigência</span><span class="v">${fmt.date(active.start_date || active.signed_date)}</span></div>
              <div class="info-row"><span class="k">Vencimento</span><span class="v">${fmt.date(active.end_date)}</span></div>
              <div class="info-row"><span class="k">Vigência</span><span class="v ${vig.vencido ? '' : 'text-blue'}">${vig.texto}</span></div>
            </div>
            <div style="display:flex;gap:.7rem;margin-top:1.2rem;flex-wrap:wrap">
              <button class="btn btn-glass" data-open="${active.id}">${icon('download')} Abrir documento</button>
              ${active.status === 'renovacao_solicitada'
                ? `<button class="btn btn-ghost" disabled>${icon('clock')} Renovação solicitada</button>`
                : `<button class="btn btn-blue" data-renew="${active.id}">${icon('renew')} Solicitar renovação</button>`}
            </div>
          </div>

          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('clock')}</span><h3>Histórico de documentos</h3></div>
            ${contracts.map((c) => `
              <div class="file-row">
                <div class="file-ico">${icon('doc')}</div>
                <div class="f-meta"><div class="f-name">${escapeHtml(c.title)}</div>
                  <div class="f-sub">${fmt.date(c.start_date || c.signed_date)} → ${fmt.date(c.end_date)}</div></div>
                <button class="icon-btn" title="Abrir" data-open="${c.id}">${icon('download')}</button>
              </div>`).join('')}
          </div>
        </div>
      </div>`;

    shell.content.querySelectorAll('[data-open]').forEach((b) => b.onclick = async () => {
      const rec = contracts.find((x) => x.id === b.dataset.open);
      openFile(await api.fileUrl(rec), rec.file_name || 'contrato.pdf');
    });
    shell.content.querySelector('[data-renew]')?.addEventListener('click', () => {
      const c = active;
      const mm = modal({
        title: 'Solicitar renovação', icon: 'renew',
        body: `<p class="body-sm" style="font-size:.95rem">Deseja solicitar a renovação do contrato <strong>${escapeHtml(c.title)}</strong>? A empresa será avisada e providenciará o novo documento.</p>`,
        footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-ok>${icon('renew')} Solicitar</button>`,
      });
      mm.overlay.querySelector('[data-cancel]').onclick = mm.close;
      mm.overlay.querySelector('[data-ok]').onclick = async () => { await api.requestRenewal(c.id); mm.close(); toast('Renovação solicitada! A empresa foi avisada. 📨', 'ok'); go('contrato'); };
    });
  }

  /* ════════════ CONTATO ════════════ */
  async function pageContato() {
    shell.setTitle('Falar com a empresa', 'Estamos aqui para ajudar');
    const reqs = await api.listRequests({ client_id: user.id });
    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="grid-cols grid-2-3">
          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('send')}</span><h3>Solicitar contato</h3></div>
            <form id="f-contato">
              <div class="field"><label>Assunto</label>
                <select class="select" name="subject">${['Dúvida sobre pagamento', 'Manutenção do veículo', 'Documentação', 'Troca de veículo', 'Outros'].map((x) => `<option>${x}</option>`).join('')}</select></div>
              <div class="field"><label>Mensagem</label><textarea class="textarea" name="message" placeholder="Como podemos ajudar?" required></textarea></div>
              <button class="btn btn-blue btn-block" type="submit">${icon('send')} Enviar solicitação</button>
            </form>
            <div style="display:flex;gap:.6rem;margin-top:1rem">
              <a class="btn btn-glass" style="flex:1" href="https://wa.me/${CONFIG.EMPRESA.whatsapp}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp</a>
              <a class="btn btn-glass" style="flex:1" href="mailto:${CONFIG.EMPRESA.email}">${icon('mail')} E-mail</a>
            </div>
          </div>

          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('clock')}</span><h3>Minhas solicitações</h3></div>
            <div id="req-list">${reqs.length ? reqs.map((r) => `
              <div class="file-row" style="align-items:flex-start">
                <div class="file-ico blue">${icon('send')}</div>
                <div class="f-meta"><div class="f-name">${escapeHtml(r.subject)}</div><div class="f-sub" style="white-space:normal">${escapeHtml(r.message)}</div><div class="f-sub">${fmt.date(r.created_at)}</div></div>
                ${badge(r.status)}
              </div>`).join('') : `<div class="empty">${icon('info', 'empty-ico')}<p>Nenhuma solicitação ainda.</p></div>`}</div>
          </div>
        </div>
      </div>`;

    shell.content.querySelector('#f-contato').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      await api.createRequest({ client_id: user.id, subject: f.subject.value, message: f.message.value });
      toast('Solicitação enviada! Entraremos em contato. 📨', 'ok');
      go('contato');
    });
  }

  /* ── Sino de notificações do motorista (avisos da empresa) ── */
  async function refreshNotifications() {
    try {
      const [vehicles, payments] = await Promise.all([api.listVehicles({ client_id: user.id }), api.listPayments({ client_id: user.id })]);
      const vehicle = vehicles[0];
      const maints = vehicle ? await api.listMaintenances({ vehicle_id: vehicle.id }) : [];
      const agendadas = maints.filter((m) => m.status === 'agendada' && m.requested_by === user.id);
      const np = payments.filter((p) => paymentStatus(p) !== 'pago').sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
      const items = [
        ...agendadas.map((m) => ({ cls: 'due', ico: 'wrench', title: 'Manutenção agendada', sub: `${escapeHtml(m.type || '')} · ${fmt.date(m.scheduled_date)}${m.cost ? ' · ' + fmt.money(m.cost) : ''}`, goto: 'manutencao' })),
      ];
      if (np) items.push({ cls: 'pay', ico: 'calendar', title: 'Próximo pagamento', sub: `${fmt.money(np.amount)} · ${fmt.date(np.due_date)}`, goto: 'pagamentos' });
      const count = agendadas.length + (np && daysFromToday(np.due_date) <= 3 ? 1 : 0);
      shell.topbarActions.innerHTML = `
        <button class="bell-btn" id="bell-btn" aria-label="Notificações">${icon('bell')}${count ? `<span class="bell-badge">${count}</span>` : ''}</button>
        <div class="notif-dropdown" id="notif-dd">
          <div class="notif-head">${icon('bell')} Notificações</div>
          ${items.length ? items.map((n) => `
            <div class="notif-item" data-goto="${n.goto}">
              <div class="notif-ico ${n.cls}">${icon(n.ico)}</div>
              <div style="min-width:0"><div class="n-title">${escapeHtml(n.title)}</div><div class="n-sub">${escapeHtml(n.sub)}</div></div>
            </div>`).join('') : `<div class="empty" style="padding:1.6rem">${icon('check', 'empty-ico')}<p>Nada de novo por aqui.</p></div>`}
        </div>`;
      const btn = shell.topbarActions.querySelector('#bell-btn');
      const dd = shell.topbarActions.querySelector('#notif-dd');
      const closeDD = () => { dd.classList.remove('show'); document.removeEventListener('click', closeDD); };
      btn.onclick = (e) => { e.stopPropagation(); const open = dd.classList.toggle('show'); if (open) setTimeout(() => document.addEventListener('click', closeDD), 0); else document.removeEventListener('click', closeDD); };
      dd.querySelectorAll('[data-goto]').forEach((it) => it.onclick = () => { closeDD(); go(it.dataset.goto); });
    } catch (e) { /* silencioso */ }
  }

  go('inicio');
}
