/* ============================================================
   ÁREA DO CLIENTE
   ============================================================ */
import { api, lateFeeForBrand } from '../api.js';
import { CONFIG } from '../config.js';
import { buildShell } from './shell.js';
import { applyReadState, markNotifRead } from '../notifs.js';
import { pixPayload, pixQrDataUrl } from '../pix.js';
import { buildDriverContext, askAssistant, whatsappHandoffUrl, assistantMode } from '../chatbot.js';
import {
  icon, fmt, badge, toast, modal, openFile, copyText,
  paymentStatus, todayISO, daysFromToday, escapeHtml, vigencia, safeUrl,
} from '../ui.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export async function renderCliente(root, user, onLogout) {
  const nav = [
    { key: 'inicio',     label: 'Início',          icon: 'dashboard' },
    { key: 'pagamentos', label: 'Pagamentos',      icon: 'calendar' },
    { key: 'veiculo',    label: 'Veículo',         icon: 'car' },
    { key: 'manutencao', label: 'Manutenção',      icon: 'wrench' },
    { key: 'contrato',   label: 'Seu contrato',    icon: 'doc' },
    { key: 'contato',    label: 'Falar com a empresa', icon: 'phone' },
  ];
  const shell = buildShell({ root, user, roleLabel: 'Motorista', nav, onNav: go, onLogout });

  const loading = () => `<div class="loading-screen"><div class="spinner"></div></div>`;
  let calRef = new Date(); // mês em exibição no calendário

  async function go(key) {
    shell.setActive(key);
    refreshNotifications();
    document.body.classList.toggle('dash-active', key === 'inicio');  // fundo azul só na aba Início (mesmo estilo do painel)
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
              <div class="panel-head"><span class="panel-ico">${icon('gauge')}</span><h3>Acesso rápido</h3></div>
              <button class="btn btn-blue btn-block" id="qa-manut">${icon('wrench')} Solicitar manutenção</button>
              <button class="btn btn-glass btn-block" id="qa-pag" style="margin-top:.6rem">${icon('payments')} Ver histórico de pagamentos</button>
            </div>

            <div class="panel glass">
              <div class="panel-head"><span class="panel-ico">${icon('bot')}</span><h3>Precisa de ajuda?</h3></div>
              <p class="body-sm" style="margin-bottom:1rem">Converse com o <strong>Flex App</strong>, nosso assistente virtual — ele tira suas dúvidas na hora.</p>
              <button class="btn btn-blue btn-block" id="ir-chat">${icon('chat')} Abrir chat do Flex App</button>
            </div>
          </div>
        </div>
      </div>`;

    mountCalendar(shell.content.querySelector('#cal-mount'), payments);
    shell.content.querySelector('#ver-veh')?.addEventListener('click', () => go('veiculo'));
    shell.content.querySelector('#qa-manut')?.addEventListener('click', () => go('manutencao'));
    shell.content.querySelector('#qa-pag')?.addEventListener('click', () => go('pagamentos'));
    shell.content.querySelector('#ir-chat')?.addEventListener('click', () => go('contato'));
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
          <a class="btn btn-glass btn-sm" href="https://wa.me/${CONFIG.EMPRESA.whatsapp}" target="_blank" rel="noopener" style="background:rgba(255,255,255,.85)">${icon('whatsapp')} WhatsApp</a>
        </div>
      </div>`;
  }

  /* ── Modal de pagamento Pix + envio de comprovante ── */
  async function openPayModal(p) {
    if (!p) return;
    const cfg = await api.getPaymentSettings();
    const method = await api.getMyPaymentMethod();          // chave Pix vinculada a este motorista
    const veh = p.vehicle_id ? await api.getVehicle(p.vehicle_id) : null;
    const daysLate = paymentStatus(p) === 'atrasado' ? Math.max(0, -daysFromToday(p.due_date)) : 0;
    const perDay = lateFeeForBrand(cfg, veh?.brand);        // juros/dia conforme a marca do veículo
    const lateFee = daysLate * perDay;
    const total = Number(p.amount) + lateFee;
    const payload = pixPayload({ key: method?.pix_key, name: method?.pix_name, city: method?.pix_city, amount: total, txid: 'FLEX' + (p.week_ref || '') });
    const hasKey = !!payload;
    const m = modal({
      title: 'Pagar com Pix', icon: 'pix',
      body: `
        <div class="pix-amount">
          <div class="pa-label">Valor a pagar</div>
          <div class="pa-val">${fmt.money(total)}</div>
          <div class="body-sm">Vencimento ${fmt.date(p.due_date)}${p.week_ref ? ' · Semana ' + p.week_ref : ''}</div>
          ${lateFee > 0 ? `<div class="pix-late">${icon('alert')} ${fmt.money(p.amount)} + ${fmt.money(lateFee)} de atraso acumulado</div>
          <div class="pix-late-note">Devido seu pagamento estar em atraso, cada dia de atraso é ${fmt.money(perDay)}, acumulando num total de ${fmt.money(lateFee)} (${daysLate} dia(s)).</div>` : ''}
        </div>
        ${hasKey ? `
          <div class="pix-qr" id="pix-qr"><div class="spinner"></div></div>
          <div class="pix-copy">
            <div class="pix-code" id="pix-code">${escapeHtml(payload)}</div>
            <button class="btn btn-blue btn-sm" id="pix-copy-btn">${icon('copy')} Copiar</button>
          </div>
          <div class="pix-steps">
            <div class="pix-step"><span class="ps-num">1</span><span>Copie o código ou escaneie o QR no app do seu banco.</span></div>
            <div class="pix-step"><span class="ps-num">2</span><span>Confirme o pagamento de <strong>${fmt.money(total)}</strong>.</span></div>
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
        whatsappNotice(`Olá! Acabei de pagar ${fmt.money(total)} (venc. ${fmt.date(p.due_date)}) pelo app e enviei o comprovante.`);
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
        <div class="grid-cols grid-3-2">
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
          <div class="cal-legend">
            <span class="cal-leg"><span class="cal-dot due"></span>A vencer</span>
            <span class="cal-leg"><span class="cal-dot paid"></span>Pago</span>
            <span class="cal-leg"><span class="cal-dot late"></span>Atrasado</span>
          </div>
        </div>`;
      mount.querySelector('#cal-prev').onclick = () => { calRef = new Date(y, mo - 1, 1); render(); };
      mount.querySelector('#cal-next').onclick = () => { calRef = new Date(y, mo + 1, 1); render(); };
    };
    render();
  }

  /* ════════════ MEU VEÍCULO ════════════ */
  async function pageVeiculo() {
    shell.setTitle('Veículo', 'Dados e documentação');
    const { vehicle } = await loadAll();
    if (!vehicle) { shell.content.innerHTML = `<div class="panel glass"><div class="empty">${icon('car', 'empty-ico')}<p>Nenhum veículo vinculado à sua conta.</p></div></div>`; return; }
    const documents = await api.listDocuments({ vehicle_id: vehicle.id });
    const trocaDisponivel = (await api.listVehicles({ status: 'disponivel' })).length > 0;

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

          <div>
            <div class="panel glass">
              <div class="panel-head"><span class="panel-ico">${icon('shield')}</span><h3>Documentação do carro</h3></div>
              ${documents.length ? documents.map((d) => `
                <div class="file-row">
                  <div class="file-ico blue">${icon('doc')}</div>
                  <div class="f-meta"><div class="f-name">${escapeHtml(d.title)}</div><div class="f-sub">${escapeHtml(d.type)}</div></div>
                  <button class="icon-btn" title="Abrir" data-open="${d.id}">${icon('download')}</button>
                </div>`).join('') : `<div class="empty">${icon('info', 'empty-ico')}<p>Nenhum documento disponibilizado ainda.</p></div>`}
            </div>

            <div class="panel glass">
              <div class="panel-head"><span class="panel-ico">${icon('renew')}</span><h3>Solicitar troca de veículo</h3></div>
              <p class="body-sm" style="margin-bottom:1rem">Gostaria de alterar o seu veículo? Solicite agora a mudança, caso possamos fazer a troca retornamos o contato.</p>
              <button class="btn ${trocaDisponivel ? 'btn-blue' : 'btn-glass'} btn-block" id="btn-troca" ${trocaDisponivel ? '' : 'disabled'}>${icon('renew')} ${trocaDisponivel ? 'Trocar Veículo' : 'Indisponível'}</button>
            </div>
          </div>
        </div>
      </div>`;

    shell.content.querySelectorAll('[data-open]').forEach((b) => b.onclick = async () => {
      const rec = documents.find((x) => x.id === b.dataset.open);
      openFile(await api.fileUrl(rec), rec.file_name || 'documento.pdf');
    });
    const btnTroca = shell.content.querySelector('#btn-troca');
    if (btnTroca && trocaDisponivel) btnTroca.onclick = async () => {
      btnTroca.disabled = true;
      try {
        await api.createRequest({ client_id: user.id, subject: 'Troca de veículo', message: `Solicitação de troca. Veículo atual: ${vehicle.brand} ${vehicle.model} · ${vehicle.plate}.` });
        toast('Solicitação de troca enviada! A empresa vai retornar o contato. 🔄', 'ok');
        btnTroca.innerHTML = `${icon('check')} Solicitação enviada`;
      } catch (err) { toast('Erro: ' + err.message, 'err'); btnTroca.disabled = false; }
    };
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
            <p class="body-sm" style="margin-bottom:1.1rem">Escolha o tipo de solicitação abaixo e anexe as fotos pedidas. A empresa recebe o pedido na hora.</p>
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
                const goUrl = m.status === 'agendada' ? safeUrl(m.partner_link || (m.partner_location ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(m.partner_location) : '')) : '';
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
    // Desgaste → 1 foto (do desgaste). Revisão completa → 2 fotos (veículo + painel).
    const uploaders = isDesg
      ? [{ id: 'wear', label: 'Foto do desgaste' }]
      : [{ id: 'vehicle', label: 'Foto do veículo' }, { id: 'dash', label: 'Foto do painel (quilometragem)' }];
    const upHtml = (u) => `
      <div class="field"><label>${u.label}</label>
        <div class="upload-mini" data-drop="${u.id}">${icon('camera')} Toque para tirar / enviar a foto</div>
        <input type="file" data-file="${u.id}" accept="image/*" capture="environment" hidden></div>`;
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
          ${uploaders.map(upHtml).join('')}
          <div class="field" style="margin-bottom:0"><label id="desc-label">Observação (opcional)</label><textarea class="textarea" name="description" placeholder="Descreva o problema, se houver"></textarea></div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save disabled>${icon('send')} Enviar solicitação</button>`,
    });
    const photos = {};
    const f = m.overlay.querySelector('#f-maint');
    const send = m.overlay.querySelector('[data-save]');
    const refreshSend = () => { send.disabled = !uploaders.every((u) => photos[u.id]); };
    uploaders.forEach((u) => {
      const drop = m.overlay.querySelector(`[data-drop="${u.id}"]`);
      const fin = m.overlay.querySelector(`[data-file="${u.id}"]`);
      const set = (file) => { photos[u.id] = file; drop.classList.add('has-file'); drop.innerHTML = `${icon('check')} ${escapeHtml(file.name)}`; refreshSend(); };
      drop.onclick = () => fin.click();
      fin.onchange = () => { if (fin.files[0]) set(fin.files[0]); };
      ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
      drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) set(e.dataTransfer.files[0]); });
    });
    // "Outros" → o campo vira "Descrição" e passa a ser obrigatório
    const wearSel = m.overlay.querySelector('[name="wear_type"]');
    const descLabel = m.overlay.querySelector('#desc-label');
    const descField = m.overlay.querySelector('[name="description"]');
    const syncDesc = () => {
      const outros = wearSel && wearSel.value === 'outros';
      descLabel.textContent = outros ? 'Descrição' : 'Observação (opcional)';
      descField.required = !!outros;
      descField.placeholder = outros ? 'Descreva o problema (obrigatório)' : 'Descreva o problema, se houver';
    };
    if (wearSel) { wearSel.onchange = syncDesc; syncDesc(); }
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    send.onclick = async () => {
      if (!f.reportValidity()) return;
      if (!uploaders.every((u) => photos[u.id])) { toast('Anexe todas as fotos solicitadas.', 'err'); return; }
      const d = Object.fromEntries(new FormData(f));
      send.disabled = true; send.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span> Enviando...';
      try {
        // desgaste: file = foto do desgaste. completa: file = painel, file2 = foto do veículo.
        const file = isDesg ? photos.wear : photos.dash;
        const file2 = isDesg ? null : photos.vehicle;
        await api.requestMaintenance({ vehicle_id: vehicle.id, km: d.km, file, file2, category, wear_type: isDesg ? d.wear_type : null, description: d.description });
        m.close(); toast('Solicitação enviada à empresa! 🔧', 'ok'); after && after();
      } catch (err) { toast('Erro: ' + err.message, 'err'); send.disabled = false; send.innerHTML = `${icon('send')} Enviar solicitação`; }
    };
  }

  /* ════════════ CONTRATO ════════════ */
  async function pageContrato() {
    shell.setTitle('Seu contrato', 'Vigência, documento e renovação');
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
              <button class="btn btn-danger" data-encerrar>${icon('close')} Encerrar Contrato</button>
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
    shell.content.querySelector('[data-encerrar]')?.addEventListener('click', () => {
      const mm = modal({
        title: 'Encerrar contrato', icon: 'alert',
        body: `<p class="body-sm" style="font-size:.95rem">Tem certeza de que quer cancelar sua locação?</p>`,
        footer: `<button class="btn btn-glass" data-nao>Não</button><a class="btn btn-danger" data-sim href="https://wa.me/${CONFIG.EMPRESA.whatsapp}?text=${encodeURIComponent('Olá! Gostaria de encerrar meu contrato de locação.')}" target="_blank" rel="noopener">Sim, encerrar</a>`,
      });
      mm.overlay.querySelector('[data-nao]').onclick = mm.close;
      mm.overlay.querySelector('[data-sim]').addEventListener('click', () => mm.close());
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

  /* ════════════ CONTATO (chat com assistente) ════════════ */
  async function pageContato() {
    shell.setTitle('Falar com a empresa', 'Fale com o Flex App — respondo qualquer dúvida aqui mesmo');
    const [{ vehicle, payments }, contracts] = await Promise.all([
      loadAll(),
      api.listContracts({ client_id: user.id }),
    ]);
    const contract = (contracts || []).find((c) => c.status !== 'substituido') || (contracts || [])[0] || null;
    const ctx = buildDriverContext({ user, vehicle, payments, contract });
    const papel = CONFIG.CHATBOT?.papel || 'Assistente virtual';
    const ig = safeUrl(CONFIG.EMPRESA.instagram || '');

    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="grid-cols grid-2-3">
          <div class="panel glass chat-panel">
            <div class="chat-head">
              <div class="chat-ava">${icon('bot')}</div>
              <div class="chat-id">
                <div class="chat-name">${escapeHtml(CONFIG.CHATBOT?.nome || 'Flex App')}</div>
                <div class="chat-status"><span class="chat-dot"></span>Online · ${escapeHtml(papel)}</div>
              </div>
              <a class="btn btn-glass btn-sm chat-wa" href="https://wa.me/${CONFIG.EMPRESA.whatsapp}" target="_blank" rel="noopener" title="Falar no WhatsApp">${icon('whatsapp')}</a>
            </div>
            <div class="chat-scroll" id="chat-scroll"></div>
            <div class="chat-replybar" id="chat-replybar" hidden></div>
            <form class="chat-input" id="chat-form" autocomplete="off">
              <input class="chat-field" id="chat-field" placeholder="Escreva sua mensagem…" maxlength="600" required />
              <button class="chat-send" type="submit" aria-label="Enviar">${icon('send')}</button>
            </form>
          </div>

          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('phone')}</span><h3>Contato rápido</h3></div>
            <p class="body-sm" style="margin-bottom:1rem">Prefere falar direto com a equipe Flex Drive? Escolha um canal:</p>
            <div class="quick-contact">
              <a class="quick-item wa" href="https://wa.me/${CONFIG.EMPRESA.whatsapp}" target="_blank" rel="noopener">
                <span class="qi-ico">${icon('whatsapp')}</span>
                <span class="qi-txt"><b>WhatsApp</b><small>Atendimento 24hrs</small></span>
              </a>
              <button type="button" class="quick-item mail" id="qc-mail">
                <span class="qi-ico">${icon('mail')}</span>
                <span class="qi-txt"><b>E-mail comercial</b><small id="qc-mail-sub">Atendimento Segunda a sexta-feira 10hrs até 17hrs</small></span>
              </button>
              ${ig ? `<a class="quick-item ig" href="${ig}" target="_blank" rel="noopener">
                <span class="qi-ico">${icon('instagram')}</span>
                <span class="qi-txt"><b>Instagram</b><small>Novidades e bastidores</small></span>
              </a>` : ''}
            </div>
          </div>
        </div>
      </div>`;

    // Contato rápido — E-mail revela o endereço ao pressionar (2º clique abre o e-mail)
    const mailBtn = shell.content.querySelector('#qc-mail');
    if (mailBtn) {
      let mailRevealed = false;
      mailBtn.addEventListener('click', () => {
        const sub = mailBtn.querySelector('#qc-mail-sub');
        if (!mailRevealed) {
          mailRevealed = true;
          sub.innerHTML = `<a href="mailto:${escapeHtml(CONFIG.EMPRESA.email)}" style="color:var(--blue);font-weight:600" onclick="event.stopPropagation()">${escapeHtml(CONFIG.EMPRESA.email)}</a>`;
        } else {
          window.location.href = 'mailto:' + CONFIG.EMPRESA.email;
        }
      });
    }

    const scroll = shell.content.querySelector('#chat-scroll');
    const form = shell.content.querySelector('#chat-form');
    const field = shell.content.querySelector('#chat-field');
    const history = [];
    let busy = false;
    let ended = false;                       // conversa encerrada por inatividade
    let idleTimer = null, nudgeTimer = null, nudged = false;
    const CLOSE_MS = 10 * 60 * 1000;         // 10 min sem retorno → encerra
    const NUDGE_MS = 55 * 1000;              // ~1 min em silêncio → Flex App puxa conversa

    let msgSeq = 0;                          // id incremental de cada mensagem
    const store = new Map();                 // id → { role, text } (para citar)
    let replyTo = null;                      // mensagem sendo citada { id, role, text }

    const fmtMsg = (t) => escapeHtml(t).replace(/\n/g, '<br>');
    const scrollDown = () => { scroll.scrollTop = scroll.scrollHeight; };
    const clip = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > 90 ? s.slice(0, 90) + '…' : s; };
    const whoLabel = (role) => (role === 'user' ? 'Você' : (CONFIG.CHATBOT?.nome || 'Flex App'));

    function addMsg(role, text, quote) {
      const id = ++msgSeq;
      store.set(id, { role, text });
      const el = document.createElement('div');
      el.className = `chat-msg ${role === 'user' ? 'me' : 'bot'}`;
      el.dataset.mid = String(id);
      const quoteHtml = quote
        ? `<div class="chat-quote"><b>${escapeHtml(whoLabel(quote.role))}</b><span>${escapeHtml(clip(quote.text))}</span></div>`
        : '';
      const avatar = role === 'user' ? '' : `<div class="chat-mini-ava">${icon('bot')}</div>`;
      el.innerHTML = `${avatar}<div class="bubble">${quoteHtml}${fmtMsg(text)}</div><button class="chat-reply-btn" type="button" title="Responder" aria-label="Responder">${icon('reply')}</button>`;
      el.querySelector('.chat-reply-btn').addEventListener('click', () => startReply(id));
      scroll.appendChild(el);
      scrollDown();
      return el;
    }

    // Inicia uma resposta citando a mensagem `id` (estilo WhatsApp)
    function startReply(id) {
      if (ended) return;
      const m = store.get(id);
      if (!m) return;
      replyTo = { id, role: m.role, text: m.text };
      renderReplyBar();
      field.focus();
    }

    function renderReplyBar() {
      const bar = shell.content.querySelector('#chat-replybar');
      if (!bar) return;
      if (!replyTo) { bar.hidden = true; bar.innerHTML = ''; return; }
      bar.hidden = false;
      bar.innerHTML = `
        <div class="rb-line"></div>
        <div class="rb-body"><b>${icon('reply')} Respondendo a ${escapeHtml(whoLabel(replyTo.role))}</b><span>${escapeHtml(clip(replyTo.text))}</span></div>
        <button class="rb-close" type="button" aria-label="Cancelar">${icon('close')}</button>`;
      bar.querySelector('.rb-close').addEventListener('click', () => { replyTo = null; renderReplyBar(); });
    }

    function addChips(items, onPick) {
      if (!items || !items.length) return;
      const wrap = document.createElement('div');
      wrap.className = 'chat-chips';
      items.forEach((label) => {
        const b = document.createElement('button');
        b.className = 'chat-chip';
        b.type = 'button';
        b.textContent = label;
        b.onclick = () => { wrap.remove(); onPick(label); };
        wrap.appendChild(b);
      });
      scroll.appendChild(wrap);
      scrollDown();
    }

    function addEscalation() {
      const last = [...history].reverse().find((m) => m.role === 'user');
      const url = safeUrl(whatsappHandoffUrl(ctx, last?.content || ''));
      const wrap = document.createElement('div');
      wrap.className = 'chat-escalate';
      wrap.innerHTML = `
        <p>${icon('whatsapp')} Vou te passar para um atendente da Flex Drive.</p>
        <a class="btn btn-blue btn-block" href="${url}" target="_blank" rel="noopener">${icon('whatsapp')} Continuar no WhatsApp</a>`;
      scroll.appendChild(wrap);
      scrollDown();
    }

    function typing(on) {
      let t = scroll.querySelector('.chat-typing');
      if (on && !t) {
        t = document.createElement('div');
        t.className = 'chat-msg bot chat-typing';
        t.innerHTML = `<div class="chat-mini-ava">${icon('bot')}</div><div class="bubble"><span class="dots"><i></i><i></i><i></i></span></div>`;
        scroll.appendChild(t);
        scrollDown();
      } else if (!on && t) { t.remove(); }
    }

    // Reinicia o relógio de inatividade (10 min → encerra a conversa)
    function scheduleClose() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(closeConversation, CLOSE_MS);
    }

    // Depois de responder, se o motorista ficar em silêncio, o Flex App puxa
    // conversa por conta própria (uma vez) — deixa o papo mais real.
    function scheduleNudge() {
      clearTimeout(nudgeTimer);
      if (nudged) return;
      nudgeTimer = setTimeout(() => {
        if (ended || nudged || busy || !scroll.isConnected) return;
        nudged = true;
        const msg = 'Ainda por aí? 😊 Se tiver qualquer outra dúvida sobre pagamento, contrato ou o carro, é só me escrever aqui.';
        addMsg('bot', msg);
        history.push({ role: 'assistant', content: msg });
      }, NUDGE_MS);
    }

    function closeConversation() {
      if (ended || !scroll.isConnected) return;
      ended = true;
      clearTimeout(idleTimer); clearTimeout(nudgeTimer);
      const msg = 'Como faz um tempinho que não recebo resposta, vou encerrar esta conversa por aqui. 👋 Quando precisar, é só iniciar de novo — estou sempre por aqui!';
      addMsg('bot', msg);
      history.push({ role: 'assistant', content: msg });
      field.disabled = true;
      field.placeholder = 'Conversa encerrada';
      const sendBtn = form.querySelector('.chat-send');
      if (sendBtn) sendBtn.disabled = true;
      const wrap = document.createElement('div');
      wrap.className = 'chat-ended';
      wrap.innerHTML = `<span>Conversa encerrada por inatividade</span><button class="btn btn-glass btn-sm" id="chat-restart">${icon('renew')} Iniciar nova conversa</button>`;
      scroll.appendChild(wrap);
      scrollDown();
      wrap.querySelector('#chat-restart').onclick = () => go('contato');
    }

    async function send(text) {
      const msg = (text || '').trim();
      if (!msg || busy || ended) return;
      busy = true;
      clearTimeout(nudgeTimer); nudged = false;   // motorista interagiu
      const q = replyTo;                          // mensagem citada (se houver)
      replyTo = null; renderReplyBar();
      field.value = '';
      addMsg('user', msg, q);
      // Dá o contexto da citação ao assistente, para ele responder "citando"
      const forModel = q ? `(Respondendo à mensagem ${q.role === 'user' ? 'que eu enviei' : 'do assistente'}: "${clip(q.text)}") ${msg}` : msg;
      history.push({ role: 'user', content: forModel });
      scheduleClose();
      typing(true);
      try {
        const { reply, escalate, chips } = await askAssistant({ history, context: ctx });
        typing(false);
        addMsg('bot', reply, q);                  // a resposta do Flex App cita a mesma mensagem
        history.push({ role: 'assistant', content: reply });
        if (escalate) addEscalation();
        else { addChips(chips, (label) => send(label)); scheduleNudge(); }
      } catch (err) {
        typing(false);
        addMsg('bot', 'Ops, tive um problema para responder agora. Você pode tentar de novo ou falar no WhatsApp.');
      } finally {
        busy = false;
        scheduleClose();
        if (!ended) field.focus();
      }
    }

    // Saudação + sugestões iniciais
    addMsg('bot', CONFIG.CHATBOT?.saudacao || 'Olá! Como posso ajudar?');
    history.push({ role: 'assistant', content: CONFIG.CHATBOT?.saudacao || 'Olá! Como posso ajudar?' });
    addChips(['Qual meu próximo pagamento?', 'Como faço para pagar?', 'Meu contrato', 'Manutenção'], (label) => send(label));
    scheduleClose();   // relógio de inatividade começa já na abertura
    scheduleNudge();

    form.addEventListener('submit', (e) => { e.preventDefault(); send(field.value); });
    field.focus();
  }

  /* ── Sino de notificações do motorista (avisos da empresa) ── */
  async function refreshNotifications() {
    try {
      const [vehicles, payments] = await Promise.all([api.listVehicles({ client_id: user.id }), api.listPayments({ client_id: user.id })]);
      const vehicle = vehicles[0];
      const maints = vehicle ? await api.listMaintenances({ vehicle_id: vehicle.id }) : [];
      const agendadas = maints.filter((m) => m.status === 'agendada' && m.requested_by === user.id);
      const np = payments.filter((p) => paymentStatus(p) !== 'pago').sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
      const allItems = [
        ...agendadas.map((m) => ({ id: `magend:${m.id}:${m.scheduled_date}`, cls: 'due', ico: 'wrench', title: 'Manutenção agendada', sub: `${escapeHtml(m.type || '')} · ${fmt.date(m.scheduled_date)}${m.cost ? ' · ' + fmt.money(m.cost) : ''}`, goto: 'manutencao' })),
      ];
      if (np) allItems.push({ id: `nextpay:${np.id}`, cls: 'pay', ico: 'calendar', title: 'Próximo pagamento', sub: `${fmt.money(np.amount)} · ${fmt.date(np.due_date)}`, goto: 'pagamentos' });
      const { visible: items, unreadCount } = applyReadState(user.id, allItems);
      shell.topbarActions.innerHTML = `
        <button class="bell-btn" id="bell-btn" aria-label="Notificações">${icon('bell')}${unreadCount ? `<span class="bell-badge">${unreadCount}</span>` : ''}</button>
        <div class="notif-dropdown" id="notif-dd">
          <div class="notif-head">${icon('bell')} Notificações ${unreadCount ? `<span class="badge badge-red" style="margin-left:auto">${unreadCount} nova(s)</span>` : ''}</div>
          ${items.length ? items.map((n) => `
            <div class="notif-item ${n.read ? 'read' : ''}" data-goto="${n.goto}" data-id="${n.id}">
              <div class="notif-ico ${n.cls}">${icon(n.ico)}</div>
              <div style="min-width:0"><div class="n-title">${escapeHtml(n.title)}</div><div class="n-sub">${escapeHtml(n.sub)}</div></div>
            </div>`).join('') : `<div class="empty" style="padding:1.6rem">${icon('check', 'empty-ico')}<p>Nada de novo por aqui.</p></div>`}
        </div>`;
      const btn = shell.topbarActions.querySelector('#bell-btn');
      const dd = shell.topbarActions.querySelector('#notif-dd');
      const closeDD = () => { dd.classList.remove('show'); document.removeEventListener('click', closeDD); };
      btn.onclick = (e) => { e.stopPropagation(); const open = dd.classList.toggle('show'); if (open) setTimeout(() => document.addEventListener('click', closeDD), 0); else document.removeEventListener('click', closeDD); };
      dd.querySelectorAll('[data-id]').forEach((it) => it.onclick = () => { markNotifRead(user.id, it.dataset.id); closeDD(); go(it.dataset.goto); });
    } catch (e) { /* silencioso */ }
  }

  go('inicio');
}
