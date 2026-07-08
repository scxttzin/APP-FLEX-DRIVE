/* ============================================================
   ÁREA DA EMPRESA — Dashboard interativo
   ============================================================ */
import { api } from '../api.js';
import { buildShell } from './shell.js';
import {
  icon, fmt, badge, toast, modal, confirmDialog, openFile, copyText,
  paymentStatus, todayISO, daysFromToday, escapeHtml, vigencia, safeUrl,
} from '../ui.js';

const VEHICLE_STATUS = { locado: 'Locado', disponivel: 'Disponível', manutencao: 'Manutenção' };
const WEEKDAYS = [
  { v: 1, l: 'Segunda-feira' }, { v: 2, l: 'Terça-feira' }, { v: 3, l: 'Quarta-feira' },
  { v: 4, l: 'Quinta-feira' }, { v: 5, l: 'Sexta-feira' }, { v: 6, l: 'Sábado' }, { v: 0, l: 'Domingo' },
];

export async function renderEmpresa(root, user, onLogout) {
  const nav = [
    { key: 'dashboard',   label: 'Dashboard',     icon: 'dashboard' },
    { key: 'pagamentos',  label: 'Recebimentos',  icon: 'payments' },
    { key: 'manutencoes', label: 'Manutenções',   icon: 'wrench' },
    { key: 'carros',      label: 'Veículos',      icon: 'car' },
    { key: 'motoristas',  label: 'Motoristas',    icon: 'users' },
    { key: 'parceiros',   label: 'Parceiros',     icon: 'store' },
    { key: 'documentos',  label: 'Documentação',  icon: 'doc' },
  ];

  const shell = buildShell({ root, user, roleLabel: 'Empresa', nav, onNav: go, onLogout });

  // cache simples de mapas
  let clientsMap = {}, vehiclesMap = {};
  let currentKey = 'dashboard';
  async function refreshMaps() {
    const [clients, vehicles] = await Promise.all([api.clients(), api.listVehicles()]);
    clientsMap = Object.fromEntries(clients.map((c) => [c.id, c]));
    vehiclesMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
    return { clients, vehicles };
  }
  const clientName = (id) => clientsMap[id]?.full_name || '—';
  const vehicleLabel = (id) => { const v = vehiclesMap[id]; return v ? `${v.brand} ${v.model} · ${v.plate}` : '—'; };

  const loading = () => `<div class="loading-screen"><div class="spinner"></div></div>`;

  async function go(key) {
    currentKey = key;
    shell.setActive(key);
    refreshNotifications();
    document.body.classList.toggle('dash-active', key === 'dashboard');
    shell.content.innerHTML = loading();
    try {
      if (key === 'dashboard') await pageDashboard();
      else if (key === 'pagamentos') await pagePagamentos();
      else if (key === 'manutencoes') await pageManutencoes();
      else if (key === 'carros') await pageCarros();
      else if (key === 'motoristas') await pageMotoristas();
      else if (key === 'parceiros') await pageParceiros();
      else if (key === 'documentos') await pageDocumentos();
    } catch (err) {
      shell.content.innerHTML = `<div class="panel glass"><div class="empty">${icon('alert', 'empty-ico')}<p>Erro ao carregar: ${escapeHtml(err.message)}</p></div></div>`;
    }
  }

  /* ════════════ DASHBOARD ════════════ */
  async function pageDashboard() {
    shell.setTitle('Dashboard', `Visão geral · ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`);
    const { vehicles } = await refreshMaps();
    const [payments, maints] = await Promise.all([api.listPayments(), api.listMaintenances()]);

    const month = todayISO().slice(0, 7);
    const recebidoMes = payments.filter((p) => paymentStatus(p) === 'pago' && (p.paid_date || '').slice(0, 7) === month).reduce((s, p) => s + Number(p.amount), 0);
    const aReceber = payments.filter((p) => paymentStatus(p) !== 'pago').reduce((s, p) => s + Number(p.amount), 0);
    const atrasados = payments.filter((p) => paymentStatus(p) === 'atrasado');
    const locados = vehicles.filter((v) => v.status === 'locado').length;
    const disponiveis = vehicles.filter((v) => v.status === 'disponivel').length;
    const emManut = vehicles.filter((v) => v.status === 'manutencao').length;
    const manutAbertas = maints.filter((m) => m.status !== 'concluida');
    const taxaOcupacao = vehicles.length ? Math.round((locados / vehicles.length) * 100) : 0;

    const proximos = payments.filter((p) => paymentStatus(p) !== 'pago').sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6);

    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="kpi-grid">
          ${kpi('money', 'Recebido no mês', fmt.money(recebidoMes), `${payments.filter((p) => paymentStatus(p) === 'pago' && (p.paid_date || '').slice(0, 7) === month).length} pagamentos`, 'up')}
          ${kpi('clock', 'A receber', fmt.money(aReceber), `${atrasados.length} em atraso`, atrasados.length ? 'down' : '')}
          ${kpi('users', 'Motoristas', `${Object.keys(clientsMap).length}`, 'cadastrados')}
          ${kpi('wrench', 'Manutenções abertas', `${manutAbertas.length}`, `${emManut} veículo(s) parado(s)`)}
        </div>

        <div class="panel glass">
          <div class="panel-head"><span class="panel-ico">${icon('payments')}</span><h3>Próximos recebimentos</h3>
            <button class="btn btn-ghost btn-sm" id="ver-pag">Ver todos</button></div>
          ${proximos.length ? `
            <div class="table-wrap"><table class="tbl">
              <thead><tr><th>Motorista</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${proximos.map((p) => `
                  <tr>
                    <td><div class="cell-drv cell-strong">${escapeHtml(clientName(p.client_id))}<div class="cell-sub">${escapeHtml(vehicleLabel(p.vehicle_id))}</div></div></td>
                    <td class="nowrap">${fmt.date(p.due_date)}</td>
                    <td class="cell-strong mono nowrap">${fmt.money(p.amount)}</td>
                    <td>${badge(paymentStatus(p))}</td>
                    <td class="row-actions"><button class="btn btn-green btn-sm" data-pay="${p.id}">${icon('check')} Efetuado</button></td>
                  </tr>`).join('')}
              </tbody>
            </table></div>` : emptyBox('Nenhum recebimento pendente. Tudo em dia! 🎉')}
        </div>

        <div class="grid-cols grid-2">
          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('car')}</span><h3>Status da frota</h3></div>
            ${fleetBar(locados, disponiveis, emManut, vehicles.length)}
            <div class="info-list" style="margin-top:1rem">
              <div class="info-row"><span class="k">Total de veículos cadastrados</span><span class="v cell-strong">${vehicles.length}</span></div>
              <div class="info-row"><span class="k">Ocupação</span><span class="v">${taxaOcupacao}%</span></div>
              <div class="info-row"><span class="k">${badge('locado')}</span><span class="v">${locados}</span></div>
              <div class="info-row"><span class="k">${badge('disponivel')}</span><span class="v">${disponiveis}</span></div>
              <div class="info-row"><span class="k">${badge('manutencao')}</span><span class="v">${emManut}</span></div>
            </div>
          </div>

          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('wrench')}</span><h3>Manutenções próximas</h3></div>
            ${manutAbertas.length ? manutAbertas.slice(0, 4).map((m) => `
              <div class="file-row" style="background:transparent;border:none;padding:.5rem 0;margin:0">
                <div class="file-ico blue">${icon('wrench')}</div>
                <div class="f-meta"><div class="f-name">${escapeHtml(m.type)} · ${escapeHtml(vehiclesMap[m.vehicle_id]?.plate || '')}</div>
                  <div class="f-sub">${fmt.date(m.scheduled_date)} · ${fmt.money(m.cost)}</div></div>
                ${badge(m.status)}
              </div>`).join('') : emptyBox('Sem manutenções agendadas.')}
          </div>
        </div>
      </div>`;

    shell.content.querySelector('#ver-pag').onclick = () => go('pagamentos');
    shell.content.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => receberPagamento(b.dataset.pay, () => go('dashboard')));
  }

  /* ════════════ RECEBIMENTOS ════════════ */
  async function pagePagamentos() {
    shell.setTitle('Recebimentos', 'Pagamentos dos motoristas');
    await refreshMaps();
    const payments = await api.listPayments();
    const cfg = await api.getPaymentSettings();

    const pagos = payments.filter((p) => paymentStatus(p) === 'pago').length;
    const pend = payments.filter((p) => paymentStatus(p) === 'pendente').length;
    const atras = payments.filter((p) => paymentStatus(p) === 'atrasado').length;
    const analise = payments.filter((p) => paymentStatus(p) === 'em_analise');

    shell.content.innerHTML = `
      <div class="fade-in">
        ${analise.length ? `<div class="alert alert-info show" style="margin-bottom:1.2rem;display:flex;align-items:center;gap:10px">${icon('bell')} <span><strong>${analise.length} comprovante(s)</strong> aguardando sua confirmação.</span></div>` : ''}
        <div class="kpi-grid">
          ${kpi('check', 'Pagos', `${pagos}`, fmt.money(payments.filter((p) => paymentStatus(p) === 'pago').reduce((s, p) => s + +p.amount, 0)))}
          ${kpi('eye', 'Em análise', `${analise.length}`, 'comprovantes a confirmar')}
          ${kpi('clock', 'Pendentes', `${pend}`, 'aguardando')}
          ${kpi('alert', 'Atrasados', `${atras}`, 'requer atenção')}
        </div>
        <div class="panel glass">
          <div class="panel-head"><span class="panel-ico">${icon('pix')}</span><h3>Configuração de pagamento</h3></div>
          <p class="body-sm" style="margin-bottom:1rem">Cadastre a chave Pix que os motoristas usam para pagar e defina o juros por dia de atraso. Quando o pagamento está vencido, o Pix gerado para o motorista já vem com o juros embutido.</p>
          <form id="f-pgto-cfg">
            <div class="form-grid">
              <div class="field full"><label>Chave Pix</label><input class="input" name="pix_key" value="${escapeHtml(cfg.pix_key)}" placeholder="CPF, e-mail, telefone ou chave aleatória"></div>
              <div class="field"><label>Nome do recebedor (máx. 25, sem acentos)</label><input class="input" name="pix_name" value="${escapeHtml(cfg.pix_name)}" maxlength="25" placeholder="Flex Drive Locadora"></div>
              <div class="field"><label>Cidade (máx. 15, sem acentos)</label><input class="input" name="pix_city" value="${escapeHtml(cfg.pix_city)}" maxlength="15" placeholder="Brasilia"></div>
              <div class="field"><label>Valor fixo de atraso por dia (R$)</label><input class="input" type="number" step="0.01" min="0" name="late_fee_per_day" value="${cfg.late_fee_per_day}" placeholder="25,00"></div>
            </div>
            <button class="btn btn-blue" type="submit">${icon('check')} Salvar configuração</button>
          </form>
        </div>
        <div class="panel glass">
          <div class="panel-head"><span class="panel-ico">${icon('payments')}</span><h3>Todos os recebimentos</h3>
            <button class="btn btn-blue btn-sm" id="novo-plano">${icon('calendar')} Gerar Cobrança semanal</button></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Motorista</th><th>Vencimento</th><th>Pago em</th><th>Forma</th><th>Valor</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${payments.length ? payments.map((p) => `
                <tr>
                  <td><div class="cell-drv cell-strong">${escapeHtml(clientName(p.client_id))}<div class="cell-sub">${escapeHtml(vehicleLabel(p.vehicle_id))}</div></div></td>
                  <td class="nowrap">${fmt.date(p.due_date)}</td>
                  <td class="muted nowrap">${p.paid_date ? fmt.date(p.paid_date) : '—'}</td>
                  <td class="muted nowrap">${escapeHtml(p.method || '—')}</td>
                  <td class="cell-strong mono nowrap">${fmt.money(p.amount)}</td>
                  <td>${badge(paymentStatus(p))}</td>
                  <td class="row-actions">
                    ${paymentStatus(p) === 'em_analise' ? `<button class="icon-btn" title="Ver comprovante" data-receipt="${p.id}">${icon('eye')}</button>` : ''}
                    ${paymentStatus(p) !== 'pago' ? `<button class="icon-btn" title="Confirmar recebimento" data-pay="${p.id}">${icon('check')}</button>` : ''}
                    <button class="icon-btn" title="Editar" data-edit="${p.id}">${icon('edit')}</button>
                    <button class="icon-btn danger" title="Excluir" data-del="${p.id}">${icon('trash')}</button>
                  </td>
                </tr>`).join('') : `<tr><td colspan="7">${emptyBox('Nenhum pagamento lançado.')}</td></tr>`}
            </tbody>
          </table></div>
        </div>
      </div>`;

    const cfgForm = shell.content.querySelector('#f-pgto-cfg');
    cfgForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = cfgForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try { await api.savePaymentSettings(Object.fromEntries(new FormData(cfgForm))); toast('Configuração de pagamento salva! 💾', 'ok'); }
      catch (err) { toast('Erro ao salvar: ' + err.message, 'err'); }
      finally { btn.disabled = false; }
    });
    shell.content.querySelector('#novo-plano').onclick = () => formPlano(() => go('pagamentos'));
    shell.content.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => receberPagamento(b.dataset.pay, () => go('pagamentos')));
    shell.content.querySelectorAll('[data-receipt]').forEach((b) => b.onclick = async () => { const p = payments.find((x) => x.id === b.dataset.receipt); openFile(await api.receiptUrl(p), p.receipt_name || 'comprovante'); });
    shell.content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => formPagamento(payments.find((p) => p.id === b.dataset.edit), () => go('pagamentos')));
    shell.content.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => confirmDialog('Excluir este pagamento?', async () => { await api.deletePayment(b.dataset.del); toast('Pagamento excluído', 'ok'); go('pagamentos'); }));
  }

  /* gerar plano semanal de cobranças */
  async function formPlano(after) {
    const clients = Object.values(clientsMap), vehicles = Object.values(vehiclesMap);
    const m = modal({
      title: 'Gerar plano semanal', icon: 'calendar',
      body: `
        <form id="f-plano">
          <div class="form-grid">
            <div class="field full"><label>Motorista</label><select class="select" name="client_id" required>${clients.map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)}</option>`).join('')}</select></div>
            <div class="field full"><label>Veículo</label><select class="select" name="vehicle_id" required>${vehicles.map((v) => `<option value="${v.id}">${escapeHtml(v.brand + ' ' + v.model + ' · ' + v.plate)}</option>`).join('')}</select></div>
            <div class="field"><label>Valor por semana (R$)</label><input class="input" type="number" step="0.01" name="amount" placeholder="650" required></div>
            <div class="field"><label>Forma</label><select class="select" name="method">${['Pix', 'Cartão', 'Dinheiro', 'Transferência'].map((x) => `<option>${x}</option>`).join('')}</select></div>
            <div class="field"><label>1º vencimento</label><input class="input" type="date" name="first_due" value="${todayISO()}" required></div>
            <div class="field"><label>Nº de semanas</label><input class="input" type="number" min="1" max="52" name="weeks" value="8" required></div>
          </div>
          <div class="alert alert-info show" id="plano-preview" style="margin-top:.3rem"></div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Gerar cobranças</button>`,
    });
    const f = m.overlay.querySelector('#f-plano'); const prev = m.overlay.querySelector('#plano-preview');
    const upd = () => { const wd = f.first_due.value ? fmt.weekday(f.first_due.value) : ''; const n = Number(f.weeks.value || 0); const amt = Number(f.amount.value || 0); prev.innerHTML = `Serão geradas <strong>${n} cobranças</strong>${wd ? ` (toda <strong>${wd}</strong>)` : ''} · total ${fmt.money(n * amt)}.`; };
    f.addEventListener('input', upd); upd();
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f)); d.weeks = Number(d.weeks);
      await api.createWeeklyPlan(d);
      toast(`${d.weeks} cobranças geradas! 📅`, 'ok');
      m.close(); after && after();
    };
  }

  async function receberPagamento(id, after) {
    const payments = await api.listPayments();
    const p = payments.find((x) => x.id === id); if (!p) return;
    await api.savePayment({ ...p, status: 'pago', paid_date: todayISO() });
    toast('Pagamento recebido! ✅', 'ok');
    after && after();
  }

  async function formPagamento(p, after) {
    const [clients, vehicles] = [Object.values(clientsMap), Object.values(vehiclesMap)];
    const isEdit = !!p;
    const m = modal({
      title: isEdit ? 'Editar pagamento' : 'Novo lançamento', icon: 'payments',
      body: `
        <form id="f-pag">
          <div class="form-grid">
            <div class="field full"><label>Motorista</label>
              <select class="select" name="client_id" required>${clients.map((c) => `<option value="${c.id}" ${p?.client_id === c.id ? 'selected' : ''}>${escapeHtml(c.full_name)}</option>`).join('')}</select></div>
            <div class="field full"><label>Veículo</label>
              <select class="select" name="vehicle_id" required>${vehicles.map((v) => `<option value="${v.id}" ${p?.vehicle_id === v.id ? 'selected' : ''}>${escapeHtml(v.brand + ' ' + v.model + ' · ' + v.plate)}</option>`).join('')}</select></div>
            <div class="field"><label>Valor (R$)</label><input class="input" type="number" step="0.01" name="amount" value="${p?.amount ?? ''}" required></div>
            <div class="field"><label>Vencimento</label><input class="input" type="date" name="due_date" value="${p?.due_date ?? todayISO()}" required></div>
            <div class="field"><label>Forma</label>
              <select class="select" name="method">${['Pix', 'Cartão', 'Dinheiro', 'Transferência'].map((x) => `<option ${p?.method === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
            <div class="field"><label>Status</label>
              <select class="select" name="status">
                <option value="pendente" ${p?.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                <option value="pago" ${p?.status === 'pago' ? 'selected' : ''}>Pago</option>
              </select></div>
          </div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Salvar</button>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      const f = m.overlay.querySelector('#f-pag');
      if (!f.reportValidity()) return;
      const data = Object.fromEntries(new FormData(f));
      data.amount = Number(data.amount);
      if (data.status === 'pago' && !p?.paid_date) data.paid_date = todayISO();
      if (data.status === 'pendente') data.paid_date = null;
      if (isEdit) data.id = p.id;
      await api.savePayment(data);
      toast(isEdit ? 'Pagamento atualizado' : 'Pagamento lançado', 'ok');
      m.close(); after && after();
    };
  }

  /* ════════════ MANUTENÇÕES ════════════ */
  async function pageManutencoes() {
    shell.setTitle('Manutenções', 'Solicitações dos motoristas, histórico e agenda');
    await refreshMaps();
    const maints = await api.listMaintenances();
    const solicitadas = maints.filter((m) => m.status === 'solicitada');
    const outras = maints.filter((m) => m.status !== 'solicitada');
    const abertas = maints.filter((m) => m.status === 'agendada' || m.status === 'andamento');
    const custoTotal = maints.reduce((s, m) => s + Number(m.cost || 0), 0);

    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="kpi-grid">
          ${kpi('bell', 'Solicitações', `${solicitadas.length}`, 'dos motoristas')}
          ${kpi('clock', 'Agendadas', `${abertas.length}`, 'em aberto')}
          ${kpi('check', 'Concluídas', `${maints.filter((m) => m.status === 'concluida').length}`, 'no histórico')}
          ${kpi('money', 'Custo acumulado', fmt.money(custoTotal), 'todas')}
        </div>

        ${solicitadas.length ? `
        <div class="panel glass">
          <div class="panel-head"><span class="panel-ico">${icon('bell')}</span><h3>Solicitações dos motoristas</h3>
            <span class="badge badge-amber"><span class="dot"></span>${solicitadas.length} nova(s)</span></div>
          ${solicitadas.map((m) => `
            <div class="file-row" style="align-items:flex-start">
              <div class="file-ico ${m.category === 'desgaste' ? '' : 'blue'}">${icon(m.category === 'desgaste' ? 'alert' : 'wrench')}</div>
              <div class="f-meta">
                <div class="f-name">${escapeHtml(m.type || 'Manutenção')} · ${escapeHtml(vehiclesMap[m.vehicle_id]?.plate || '')}</div>
                <div class="f-sub" style="white-space:normal">${escapeHtml(clientName(m.requested_by))} · ${m.km ? fmt.km(m.km) : 'km não informado'} · ${fmt.date(m.scheduled_date)}${m.description ? ' · ' + escapeHtml(m.description) : ''}</div>
              </div>
              <div class="row-actions" style="align-items:center">
                <button class="icon-btn" title="Ver solicitação" data-view="${m.id}">${icon('eye')}</button>
                <button class="btn btn-blue btn-sm" data-accept="${m.id}">${icon('check')} Agendar</button>
                <button class="icon-btn danger" title="Recusar" data-del="${m.id}">${icon('trash')}</button>
              </div>
            </div>`).join('')}
        </div>` : ''}

        <div class="panel glass">
          <div class="panel-head"><span class="panel-ico">${icon('wrench')}</span><h3>Agenda e histórico</h3>
            <button class="btn btn-glass btn-sm" id="editar-manut">${icon('edit')} Editar</button></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Veículo</th><th>Tipo</th><th>Descrição</th><th>Data</th><th>Custo</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${outras.length ? outras.map((m) => `
                <tr>
                  <td class="cell-strong">${escapeHtml(vehiclesMap[m.vehicle_id]?.plate || '—')}</td>
                  <td>${escapeHtml(m.type)}</td>
                  <td class="muted">${escapeHtml(m.description || '')}</td>
                  <td>${fmt.date(m.scheduled_date)}</td>
                  <td class="mono">${fmt.money(m.cost)}</td>
                  <td>${badge(m.status)}</td>
                  <td class="row-actions">
                    ${m.status !== 'concluida' ? `<button class="icon-btn" title="Concluir" data-done="${m.id}">${icon('check')}</button>` : ''}
                    <button class="icon-btn" title="Editar" data-edit="${m.id}">${icon('edit')}</button>
                    <button class="icon-btn danger" title="Excluir" data-del="${m.id}">${icon('trash')}</button>
                  </td>
                </tr>`).join('') : `<tr><td colspan="7">${emptyBox('Nenhuma manutenção agendada.')}</td></tr>`}
            </tbody>
          </table></div>
        </div>
      </div>`;

    shell.content.querySelector('#editar-manut').onclick = () => editMaintenancePicker(outras, () => go('manutencoes'));
    shell.content.querySelectorAll('[data-accept]').forEach((b) => b.onclick = () => scheduleMaintenance(maints.find((m) => m.id === b.dataset.accept), () => go('manutencoes')));
    shell.content.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => viewMaintRequest(maints.find((m) => m.id === b.dataset.view)));
    shell.content.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => formManutencao(maints.find((m) => m.id === b.dataset.edit), () => go('manutencoes')));
    shell.content.querySelectorAll('[data-done]').forEach((b) => b.onclick = async () => { const m = maints.find((x) => x.id === b.dataset.done); await api.saveMaintenance({ ...m, status: 'concluida', done_date: todayISO() }); toast('Manutenção concluída', 'ok'); go('manutencoes'); });
    shell.content.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => confirmDialog('Excluir esta manutenção?', async () => { await api.deleteMaintenance(b.dataset.del); toast('Excluída', 'ok'); go('manutencoes'); }));
  }

  /* seletor para editar data/valores de manutenções já registradas */
  function editMaintenancePicker(list, after) {
    const m = modal({
      title: 'Editar manutenção', icon: 'edit',
      body: `
        <p class="body-sm" style="margin-bottom:1rem">Selecione uma manutenção para alterar a data e os valores.</p>
        ${list.length ? list.map((x) => `
          <div class="file-row" style="cursor:pointer" data-pick="${x.id}">
            <div class="file-ico blue">${icon('wrench')}</div>
            <div class="f-meta"><div class="f-name">${escapeHtml(x.type || 'Manutenção')} · ${escapeHtml(vehiclesMap[x.vehicle_id]?.plate || '')}</div>
            <div class="f-sub">${fmt.date(x.scheduled_date)} · ${fmt.money(x.cost)}${x.partner_name ? ' · ' + escapeHtml(x.partner_name) : ''}</div></div>
            ${badge(x.status)}
          </div>`).join('') : emptyBox('Nenhuma manutenção registrada para editar.')}`,
      footer: `<button class="btn btn-glass" data-cancel>Fechar</button>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelectorAll('[data-pick]').forEach((row) => row.onclick = () => { const mm = list.find((x) => x.id === row.dataset.pick); m.close(); formManutencao(mm, after); });
  }

  /* ver a solicitação do motorista em card, com as fotos anexadas */
  async function viewMaintRequest(m) {
    if (!m) return;
    const veh = vehiclesMap[m.vehicle_id];
    const isDesg = m.category === 'desgaste';
    const shots = isDesg
      ? [{ which: 'photo_path', label: 'Foto do desgaste' }]
      : [{ which: 'photo_path2', label: 'Foto do veículo' }, { which: 'photo_path', label: 'Foto do painel (km)' }];
    const mod = modal({
      title: 'Solicitação do motorista', icon: 'eye',
      body: `
        <div class="info-list" style="margin-bottom:1rem">
          <div class="info-row"><span class="k">Motorista</span><span class="v">${escapeHtml(clientName(m.requested_by))}</span></div>
          <div class="info-row"><span class="k">Veículo</span><span class="v">${escapeHtml((veh?.brand || '') + ' ' + (veh?.model || '') + ' · ' + (veh?.plate || ''))}</span></div>
          <div class="info-row"><span class="k">Tipo</span><span class="v">${escapeHtml(m.type || '')}</span></div>
          <div class="info-row"><span class="k">Quilometragem</span><span class="v">${m.km ? fmt.km(m.km) : '—'}</span></div>
          <div class="info-row"><span class="k">Solicitado em</span><span class="v">${fmt.date(m.scheduled_date)}</span></div>
          ${m.description ? `<div class="info-row"><span class="k">Relato</span><span class="v" style="text-align:right;max-width:60%">${escapeHtml(m.description)}</span></div>` : ''}
        </div>
        <div class="maint-shots">
          ${shots.map((s) => `<div class="shot"><div class="shot-label">${s.label}</div><div class="shot-img" data-shot="${s.which}"><div class="spinner"></div></div></div>`).join('')}
        </div>`,
      footer: `<button class="btn btn-glass" data-cancel>Fechar</button><button class="btn btn-blue" data-sched>${icon('wrench')} Agendar</button>`,
    });
    mod.overlay.querySelector('[data-cancel]').onclick = mod.close;
    mod.overlay.querySelector('[data-sched]').onclick = () => { mod.close(); scheduleMaintenance(m, () => go('manutencoes')); };
    for (const s of shots) {
      const box = mod.overlay.querySelector(`[data-shot="${s.which}"]`);
      if (!m[s.which]) { box.innerHTML = `<div class="shot-empty">${icon('camera')} Sem foto</div>`; continue; }
      try {
        const url = await api.maintenancePhotoUrl(m, s.which);
        if (!url) { box.innerHTML = `<div class="shot-empty">${icon('camera')} Sem foto</div>`; continue; }
        box.innerHTML = '';
        const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
        const img = document.createElement('img'); img.src = url; img.alt = s.label; img.loading = 'lazy';
        a.appendChild(img); box.appendChild(a);
      } catch { box.innerHTML = `<div class="shot-empty">${icon('alert')} Erro ao carregar</div>`; }
    }
  }

  /* aceitar solicitação do motorista: agendar com data + valor, e avisar o motorista */
  async function scheduleMaintenance(m, after) {
    if (!m) return;
    const veh = vehiclesMap[m.vehicle_id];
    const partners = await api.listPartners();
    const mod = modal({
      title: 'Agendar manutenção solicitada', icon: 'wrench',
      body: `
        <div class="info-list" style="margin-bottom:1rem">
          <div class="info-row"><span class="k">Motorista</span><span class="v">${escapeHtml(clientName(m.requested_by))}</span></div>
          <div class="info-row"><span class="k">Veículo</span><span class="v">${escapeHtml((veh?.brand || '') + ' ' + (veh?.model || '') + ' · ' + (veh?.plate || ''))}</span></div>
          <div class="info-row"><span class="k">Tipo</span><span class="v">${escapeHtml(m.type || '')}${m.km ? ' · ' + fmt.km(m.km) : ''}</span></div>
          ${m.description ? `<div class="info-row"><span class="k">Relato</span><span class="v" style="text-align:right;max-width:60%">${escapeHtml(m.description)}</span></div>` : ''}
        </div>
        ${m.photo_path ? `<button type="button" class="btn btn-glass btn-block btn-sm" id="ver-foto-km" style="margin-bottom:1rem">${icon('camera')} Ver foto da quilometragem</button>` : ''}
        <form id="f-sched">
          <div class="form-grid">
            <div class="field"><label>Data do agendamento</label><input class="input" type="date" name="scheduled_date" value="${m.scheduled_date || todayISO()}" required></div>
            <div class="field"><label>Valor previsto (R$)</label><input class="input" type="number" step="0.01" name="cost" value="${m.cost || 0}"></div>
            <div class="field full"><label>Parceiro (oficina / mecânico)</label>
              <select class="select" name="partner_id"><option value="">— Nenhum —</option>${partners.map((p) => `<option value="${p.id}" ${m.partner_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}${p.role ? ' · ' + escapeHtml(p.role) : ''}</option>`).join('')}</select></div>
          </div>
          <div class="body-sm" style="margin-top:-.2rem">O motorista verá o nome e a localização do parceiro escolhido.</div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Confirmar agendamento</button>`,
    });
    mod.overlay.querySelector('[data-cancel]').onclick = mod.close;
    mod.overlay.querySelector('#ver-foto-km')?.addEventListener('click', async () => openFile(await api.maintenancePhotoUrl(m), 'painel-km.jpg'));
    mod.overlay.querySelector('[data-save]').onclick = async () => {
      const f = mod.overlay.querySelector('#f-sched'); if (!f.reportValidity()) return;
      const d = Object.fromEntries(new FormData(f));
      const partner = partners.find((p) => p.id === d.partner_id);
      await api.saveMaintenance({ id: m.id, status: 'agendada', scheduled_date: d.scheduled_date, cost: Number(d.cost || 0), partner_id: d.partner_id || null, partner_name: partner?.name || null, partner_location: partner?.location || null, partner_link: partner?.map_link || null });
      // atualiza a quilometragem do veículo com a km informada pelo motorista no pedido
      if (m.km && veh) await api.saveVehicle({ id: veh.id, km: Math.max(Number(veh.km) || 0, Number(m.km)) });
      toast('Manutenção agendada! O motorista foi avisado. 🔧', 'ok');
      mod.close(); after && after();
    };
  }

  async function formManutencao(mm, after) {
    const vehicles = Object.values(vehiclesMap);
    const partners = await api.listPartners();
    const isEdit = !!mm;
    const m = modal({
      title: isEdit ? 'Editar manutenção' : 'Agendar manutenção', icon: 'wrench',
      body: `
        <form id="f-manut">
          <div class="form-grid">
            <div class="field full"><label>Veículo</label>
              <select class="select" name="vehicle_id" required>${vehicles.map((v) => `<option value="${v.id}" ${mm?.vehicle_id === v.id ? 'selected' : ''}>${escapeHtml(v.brand + ' ' + v.model + ' · ' + v.plate)}</option>`).join('')}</select></div>
            <div class="field"><label>Tipo</label>
              <select class="select" name="type">${['Revisão', 'Pneus', 'Freios', 'Bateria', 'Higienização', 'Elétrica', 'Outros'].map((x) => `<option ${mm?.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
            <div class="field"><label>Custo (R$)</label><input class="input" type="number" step="0.01" name="cost" value="${mm?.cost ?? 0}"></div>
            <div class="field full"><label>Descrição</label><input class="input" name="description" value="${escapeHtml(mm?.description || '')}" placeholder="Detalhes do serviço"></div>
            <div class="field"><label>Data agendada</label><input class="input" type="date" name="scheduled_date" value="${mm?.scheduled_date ?? todayISO()}" required></div>
            <div class="field"><label>Status</label>
              <select class="select" name="status">
                <option value="agendada" ${mm?.status === 'agendada' ? 'selected' : ''}>Agendada</option>
                <option value="andamento" ${mm?.status === 'andamento' ? 'selected' : ''}>Em andamento</option>
                <option value="concluida" ${mm?.status === 'concluida' ? 'selected' : ''}>Concluída</option>
              </select></div>
            <div class="field full"><label>Parceiro (oficina / mecânico)</label>
              <select class="select" name="partner_id"><option value="">— Nenhum —</option>${partners.map((p) => `<option value="${p.id}" ${mm?.partner_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}${p.role ? ' · ' + escapeHtml(p.role) : ''}</option>`).join('')}</select></div>
          </div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Salvar</button>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      const f = m.overlay.querySelector('#f-manut'); if (!f.reportValidity()) return;
      const data = Object.fromEntries(new FormData(f));
      data.cost = Number(data.cost || 0);
      if (data.status === 'concluida') data.done_date = todayISO();
      const partner = partners.find((p) => p.id === data.partner_id);
      data.partner_name = partner?.name || null; data.partner_location = partner?.location || null; data.partner_link = partner?.map_link || null;
      if (!data.partner_id) data.partner_id = null;
      if (isEdit) data.id = mm.id;
      await api.saveMaintenance(data);
      toast(isEdit ? 'Atualizada' : 'Manutenção agendada', 'ok');
      m.close(); after && after();
    };
  }

  /* ════════════ VEÍCULOS ════════════ */
  async function pageCarros() {
    shell.setTitle('Veículos', 'Frota cadastrada');
    const { vehicles } = await refreshMaps();
    let filter = 'todos';

    const render = () => {
      const list = filter === 'todos' ? vehicles : vehicles.filter((v) => v.status === filter);
      const grid = shell.content.querySelector('#veh-grid');
      grid.innerHTML = list.length ? list.map((v) => vehicleCard(v)).join('') : emptyBox('Nenhum veículo neste filtro.');
      grid.querySelectorAll('[data-docs]').forEach((b) => b.onclick = () => manageVehicleDocs(vehicles.find((v) => v.id === b.dataset.docs), () => go('carros')));
      grid.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => formVeiculo(vehicles.find((v) => v.id === b.dataset.edit), () => go('carros')));
      grid.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => confirmDialog('Excluir este veículo?', async () => { await api.deleteVehicle(b.dataset.del); toast('Veículo excluído', 'ok'); go('carros'); }));
    };

    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="panel glass" style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div class="seg" id="veh-filter" style="margin:0;flex-wrap:wrap">
            <button data-f="todos" class="active">Todos (${vehicles.length})</button>
            <button data-f="locado">Locados (${vehicles.filter((v) => v.status === 'locado').length})</button>
            <button data-f="disponivel">Disponíveis (${vehicles.filter((v) => v.status === 'disponivel').length})</button>
            <button data-f="manutencao">Manutenção (${vehicles.filter((v) => v.status === 'manutencao').length})</button>
          </div>
          <div class="spacer" style="flex:1"></div>
          <button class="btn btn-blue btn-sm" id="novo-veh">${icon('plus')} Cadastrar veículo</button>
        </div>
        <div class="veh-grid" id="veh-grid"></div>
      </div>`;

    shell.content.querySelector('#novo-veh').onclick = () => formVeiculo(null, () => go('carros'));
    const seg = shell.content.querySelector('#veh-filter');
    seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.f; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); render(); });
    render();
  }

  function vehicleCard(v) {
    return `
      <div class="veh-card glass">
        <div class="veh-thumb">
          <img src="${v.photo_url || 'assets/car-placeholder.png'}" alt="${escapeHtml(v.model)}" onerror="this.onerror=null;this.src='assets/car-placeholder.png'" style="${v.photo_url ? 'height:100%;width:100%;object-fit:cover' : ''}">
          ${badge(v.status)}
        </div>
        <div class="veh-body">
          <span class="plate">${escapeHtml(v.plate)}</span>
          <h4>${escapeHtml(v.brand)} ${escapeHtml(v.model)}</h4>
          <div class="veh-meta"><span>${v.year}</span><span>${escapeHtml(v.color)}</span><span>${fmt.km(v.km)}</span></div>
          ${v.client_id ? `<div class="body-sm" style="margin-top:.5rem">${icon('user', '')} ${escapeHtml(clientName(v.client_id))}</div>` : ''}
          <div class="veh-foot">
            <div class="veh-price">${fmt.money(v.weekly_value)} <small>/semana</small></div>
            <div class="row-actions">
              <button class="icon-btn" title="Documentos do veículo" data-docs="${v.id}">${icon('doc')}</button>
              <button class="icon-btn" title="Editar" data-edit="${v.id}">${icon('edit')}</button>
              <button class="icon-btn danger" title="Excluir" data-del="${v.id}">${icon('trash')}</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* documentos vinculados ao veículo (gerenciados na aba Veículos) */
  async function manageVehicleDocs(vehicle, after) {
    if (!vehicle) return;
    const documents = await api.listDocuments({ vehicle_id: vehicle.id });
    const m = modal({
      title: `Documentos — ${vehicle.plate}`, icon: 'shield',
      body: `
        <p class="body-sm" style="margin-bottom:1rem">Documentos ficam vinculados ao <strong>veículo</strong>. O motorista que estiver com este carro os vê automaticamente.</p>
        <div style="display:flex;gap:.6rem;align-items:flex-end;margin-bottom:1.1rem">
          <div class="field" style="flex:1;margin:0"><label>Tipo do documento</label>
            <select class="select" id="vdoc-type">${['CRLV', 'Seguro', 'IPVA', 'Laudo', 'Vistoria', 'Outros'].map((x) => `<option>${x}</option>`).join('')}</select></div>
          <button class="btn btn-blue" id="vdoc-add">${icon('upload')} Enviar</button>
          <input type="file" id="vdoc-file" accept="application/pdf,image/*" hidden>
        </div>
        ${documents.length ? documents.map((d) => `
          <div class="file-row"><div class="file-ico blue">${icon('doc')}</div>
            <div class="f-meta"><div class="f-name">${escapeHtml(d.title || 'Documento')}</div><div class="f-sub">${escapeHtml(d.type || '')}</div></div>
            <button class="icon-btn" data-open-vd="${d.id}" title="Abrir">${icon('eye')}</button>
            <button class="icon-btn danger" data-del-vd="${d.id}" title="Excluir">${icon('trash')}</button>
          </div>`).join('') : emptyBox('Nenhum documento neste veículo.')}`,
      footer: `<button class="btn btn-glass" data-cancel>Fechar</button>`,
    });
    const reopen = () => { m.close(); manageVehicleDocs(vehicle, after); };
    m.overlay.querySelector('[data-cancel]').onclick = () => { m.close(); after && after(); };
    const typeSel = m.overlay.querySelector('#vdoc-type');
    const vfile = m.overlay.querySelector('#vdoc-file');
    m.overlay.querySelector('#vdoc-add').onclick = () => vfile.click();
    vfile.onchange = async () => {
      if (!vfile.files[0]) return;
      const type = typeSel.value;
      try { await api.uploadDocument({ file: vfile.files[0], vehicle_id: vehicle.id, client_id: null, type, title: `${type} — ${vehicle.plate}` }); toast('Documento enviado', 'ok'); reopen(); }
      catch (e) { toast('Erro: ' + e.message, 'err'); }
    };
    m.overlay.querySelectorAll('[data-open-vd]').forEach((b) => b.onclick = async () => { const rec = documents.find((x) => x.id === b.dataset.openVd); openFile(await api.fileUrl(rec), rec.file_name || 'documento.pdf'); });
    m.overlay.querySelectorAll('[data-del-vd]').forEach((b) => b.onclick = () => confirmDialog('Excluir este documento?', async () => { await api.deleteDocument(b.dataset.delVd); toast('Excluído', 'ok'); reopen(); }));
  }

  async function formVeiculo(v, after) {
    const clients = Object.values(clientsMap);
    const isEdit = !!v;
    const m = modal({
      title: isEdit ? 'Editar veículo' : 'Cadastrar veículo', icon: 'car',
      body: `
        <form id="f-veh">
          <div class="form-grid">
            <div class="field"><label>Placa</label><input class="input" name="plate" value="${escapeHtml(v?.plate || '')}" placeholder="ABC1D23" required style="text-transform:uppercase"></div>
            <div class="field"><label>Marca</label><input class="input" name="brand" value="${escapeHtml(v?.brand || '')}" placeholder="BYD" required></div>
            <div class="field"><label>Modelo</label><input class="input" name="model" value="${escapeHtml(v?.model || '')}" placeholder="Dolphin Mini" required></div>
            <div class="field"><label>Ano</label><input class="input" type="number" name="year" value="${v?.year || new Date().getFullYear()}"></div>
            <div class="field"><label>Cor</label><input class="input" name="color" value="${escapeHtml(v?.color || '')}" placeholder="Branco"></div>
            <div class="field"><label>KM atual</label><input class="input" type="number" name="km" value="${v?.km || 0}"></div>
            <div class="field"><label>Valor semanal (R$)</label><input class="input" type="number" step="0.01" name="weekly_value" value="${v?.weekly_value || ''}"></div>
            <div class="field"><label>Renavam</label><input class="input" name="renavam" value="${escapeHtml(v?.renavam || '')}"></div>
            <div class="field"><label>Status</label>
              <select class="select" name="status">${Object.entries(VEHICLE_STATUS).map(([k, l]) => `<option value="${k}" ${v?.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label>Motorista (se locado)</label>
              <select class="select" name="client_id"><option value="">— Nenhum —</option>${clients.map((c) => `<option value="${c.id}" ${v?.client_id === c.id ? 'selected' : ''}>${escapeHtml(c.full_name)}</option>`).join('')}</select></div>
          </div>
          <div class="field" style="margin:.5rem 0 0"><label>Foto do veículo</label>
            <div class="upload-mini ${v?.photo_url ? 'has-file' : ''}" id="veh-photo-drop">${v?.photo_url ? icon('check') + ' Foto adicionada — toque para trocar' : icon('camera') + ' Adicionar foto'}</div>
            <input type="file" id="veh-photo-file" accept="image/*" hidden></div>
        </form>`,
      footer: `${isEdit ? `<button class="btn btn-danger" data-delete style="margin-right:auto">${icon('trash')} Excluir</button>` : ''}<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Salvar</button>`,
    });
    let photoFile = null;
    const drop = m.overlay.querySelector('#veh-photo-drop');
    const pin = m.overlay.querySelector('#veh-photo-file');
    drop.onclick = () => pin.click();
    pin.onchange = () => { if (pin.files[0]) { photoFile = pin.files[0]; drop.classList.add('has-file'); drop.innerHTML = `${icon('check')} ${escapeHtml(photoFile.name)}`; } };
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-delete]')?.addEventListener('click', () => {
      confirmDialog('Excluir este veículo? Não pode ser desfeito.', async () => { await api.deleteVehicle(v.id); toast('Veículo excluído', 'ok'); m.close(); after && after(); });
    });
    m.overlay.querySelector('[data-save]').onclick = async () => {
      const f = m.overlay.querySelector('#f-veh'); if (!f.reportValidity()) return;
      const data = Object.fromEntries(new FormData(f));
      data.plate = data.plate.toUpperCase(); data.year = Number(data.year); data.km = Number(data.km); data.weekly_value = Number(data.weekly_value || 0);
      if (!data.client_id) data.client_id = null;
      if (isEdit) data.id = v.id;
      // Regra: um motorista não pode estar vinculado a dois veículos ao mesmo tempo.
      // Troca é permitida (só a empresa, por aqui), desde que o novo veículo esteja disponível (não locado).
      if (data.client_id) {
        const all = await api.listVehicles();
        const already = all.find((x) => x.client_id === data.client_id && x.id !== (v?.id || null));
        if (already) {
          if (!isEdit) { toast('Este motorista já tem um veículo vinculado. Um motorista não pode ter dois veículos.', 'err'); return; }
          if (v.status !== 'disponivel' && v.client_id !== data.client_id) { toast('Para a troca, o novo veículo precisa estar disponível (não locado).', 'err'); return; }
          await api.saveVehicle({ id: already.id, client_id: null, status: 'disponivel' });  // libera o veículo anterior
        }
        data.status = 'locado';
      }
      const btn = m.overlay.querySelector('[data-save]'); btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span> Salvando...';
      try {
        const saved = await api.saveVehicle(data);
        const vid = saved?.id || v?.id;
        if (photoFile && vid) await api.uploadVehiclePhoto(vid, photoFile);
        toast(isEdit ? 'Veículo atualizado' : 'Veículo cadastrado', 'ok');
        m.close(); after && after();
      } catch (err) { toast('Erro: ' + err.message, 'err'); btn.disabled = false; btn.innerHTML = `${icon('check')} Salvar`; }
    };
  }

  /* ════════════ MOTORISTAS ════════════ */
  async function pageMotoristas() {
    shell.setTitle('Motoristas', 'Visualize, gerencie e cadastre');
    const { clients, vehicles } = await refreshMaps();
    const vehByClient = {};
    vehicles.forEach((v) => { if (v.client_id) (vehByClient[v.client_id] = vehByClient[v.client_id] || []).push(v); });
    const trocas = (await api.listRequests()).filter((r) => r.subject === 'Troca de veículo' && r.status !== 'fechado');
    const curVeh = (cid) => { const v = (vehByClient[cid] || [])[0]; return v ? `${v.brand} ${v.model} · ${v.plate}` : '—'; };

    shell.content.innerHTML = `
      <div class="fade-in">
        ${trocas.length ? `
        <div class="panel glass">
          <div class="panel-head"><span class="panel-ico">${icon('renew')}</span><h3>Solicitações de troca de veículo</h3>
            <span class="badge badge-amber"><span class="dot"></span>${trocas.length} nova(s)</span></div>
          ${trocas.map((r) => `
            <div class="file-row" style="align-items:flex-start">
              <div class="file-ico blue">${icon('renew')}</div>
              <div class="f-meta"><div class="f-name">${escapeHtml(clientName(r.client_id))}</div>
                <div class="f-sub">Veículo atual: ${escapeHtml(curVeh(r.client_id))}</div>
                <div class="f-sub">Solicitado em ${fmt.date(r.created_at)}</div></div>
              <div class="row-actions" style="align-items:center">
                <a class="btn btn-glass btn-sm" href="https://wa.me/${clientsMap[r.client_id]?.phone ? clientsMap[r.client_id].phone.replace(/\\D/g, '') : ''}" target="_blank" rel="noopener">${icon('whatsapp')} Contato</a>
                <button class="btn btn-blue btn-sm" data-troca-done="${r.id}">${icon('check')} Resolver</button>
              </div>
            </div>`).join('')}
        </div>` : ''}
        <div class="panel glass" style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div><h3>Motoristas cadastrados</h3><div class="body-sm">${clients.length} conta(s) · toque em um motorista para ver detalhes e gerenciar</div></div>
        </div>
        <div class="veh-grid">
          ${clients.map((c) => {
            const vs = vehByClient[c.id] || [];
            return `<button class="panel glass driver-card" data-driver="${c.id}" style="margin:0;text-align:left;width:100%">
              <div style="display:flex;align-items:center;gap:12px">
                <div class="avatar" style="width:46px;height:46px">${fmt.initials(c.full_name)}</div>
                <div style="min-width:0;flex:1">
                  <div class="cell-strong" style="font-size:1.02rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.full_name)}</div>
                  <div class="body-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${vs.length ? escapeHtml(vs.map((v) => v.plate).join(', ')) : 'sem veículo'}</div>
                </div>
                ${c.second_name ? `<span class="badge badge-blue"><span class="dot"></span>Conjunta</span>` : ''}
                <span style="color:var(--gray-4);flex-shrink:0">${icon('chevR')}</span>
              </div>
            </button>`;
          }).join('')}
          <button class="panel glass add-tile" id="novo-motorista" style="margin:0">
            <span class="add-ico">${icon('plus')}</span>
            <span>Cadastrar novo motorista</span>
          </button>
        </div>
      </div>`;

    shell.content.querySelector('#novo-motorista').onclick = () => formMotorista(() => go('motoristas'));
    shell.content.querySelectorAll('[data-driver]').forEach((card) => card.onclick = () => driverDetail(card.dataset.driver));
    shell.content.querySelectorAll('[data-troca-done]').forEach((b) => b.onclick = async () => { await api.updateRequest(b.dataset.trocaDone, 'fechado'); toast('Solicitação de troca resolvida.', 'ok'); go('motoristas'); });
  }

  /* detalhe + ações de um motorista */
  async function driverDetail(id) {
    const c = clientsMap[id]; if (!c) return;
    const myVehs = Object.values(vehiclesMap).filter((v) => v.client_id === id);
    const payments = (await api.listPayments({ client_id: id }));
    const next = payments.filter((p) => paymentStatus(p) !== 'pago').sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    const weekly = myVehs[0]?.weekly_value;
    const m = modal({
      title: c.full_name, icon: 'user',
      body: `
        <div class="info-list">
          <div class="info-row"><span class="k">E-mail (login)</span><span class="v">${escapeHtml(c.email || '—')}</span></div>
          <div class="info-row"><span class="k">CPF</span><span class="v">${escapeHtml(c.cpf || '—')}</span></div>
          <div class="info-row"><span class="k">Telefone</span><span class="v">${escapeHtml(c.phone || '—')}</span></div>
          ${c.city ? `<div class="info-row"><span class="k">Cidade</span><span class="v">${escapeHtml(c.city)}</span></div>` : ''}
          ${c.second_name ? `<div class="info-row"><span class="k">2º motorista</span><span class="v">${escapeHtml(c.second_name)}${c.second_cpf ? ' · ' + escapeHtml(c.second_cpf) : ''}</span></div>` : ''}
          <div class="info-row"><span class="k">Veículo</span><span class="v">${myVehs.length ? escapeHtml(myVehs.map((v) => v.brand + ' ' + v.model + ' · ' + v.plate).join(', ')) : '—'}</span></div>
          <div class="info-row"><span class="k">Valor semanal</span><span class="v">${weekly ? fmt.money(weekly) : '—'}</span></div>
          <div class="info-row"><span class="k">Próximo pagamento</span><span class="v">${next ? fmt.money(next.amount) + ' · ' + fmt.date(next.due_date) : '—'}</span></div>
        </div>
        <div style="margin-top:1.3rem">
          <div class="eyebrow" style="margin-bottom:.6rem">Ações possíveis</div>
          <div style="display:flex;flex-direction:column;gap:.6rem">
            <button class="btn btn-glass" data-act="edit" style="justify-content:flex-start">${icon('edit')} Editar dados do motorista</button>
            <button class="btn btn-glass" data-act="vehicle" style="justify-content:flex-start">${icon('car')} Veículo vinculado — desvincular / trocar</button>
            <button class="btn btn-glass" data-act="payment" style="justify-content:flex-start">${icon('payments')} Gerenciar pagamento — valor ou dia</button>
            <button class="btn btn-glass" data-act="docs" style="justify-content:flex-start">${icon('doc')} Gerenciar documentação</button>
            <button class="btn btn-danger" data-act="remove" style="justify-content:flex-start">${icon('trash')} Remover motorista</button>
          </div>
        </div>`,
      footer: `<button class="btn btn-glass" data-cancel>Fechar</button>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-act="edit"]').onclick = () => { m.close(); formEditDriver(c, () => go('motoristas')); };
    m.overlay.querySelector('[data-act="vehicle"]').onclick = () => { m.close(); manageVehicle(c, myVehs); };
    m.overlay.querySelector('[data-act="payment"]').onclick = () => { m.close(); managePayment(c, myVehs[0]); };
    m.overlay.querySelector('[data-act="docs"]').onclick = () => { m.close(); manageDocumentation(c, () => go('motoristas')); };
    m.overlay.querySelector('[data-act="remove"]').onclick = () => {
      m.close();
      confirmDialog(`Remover o motorista ${c.full_name}? Isso exclui a conta de acesso, os pagamentos e desvincula o veículo. Não pode ser desfeito.`, async () => {
        await api.deleteDriver(c.id); toast('Motorista removido.', 'ok'); go('motoristas');
      });
    };
  }

  /* editar dados cadastrais do motorista */
  function formEditDriver(c, after) {
    const has2 = !!c.second_name;
    const m = modal({
      title: 'Editar dados do motorista', icon: 'edit',
      body: `
        <form id="f-edit-mot">
          <div class="form-grid">
            <div class="field full"><label>Nome completo (nome e sobrenome)</label><input class="input" name="full_name" required value="${escapeHtml(c.full_name || '')}"></div>
            <div class="field"><label>CPF</label><input class="input" name="cpf" value="${escapeHtml(c.cpf || '')}"></div>
            <div class="field"><label>Telefone / WhatsApp</label><input class="input" name="phone" value="${escapeHtml(c.phone || '')}"></div>
            <div class="field"><label>Cidade</label><input class="input" name="city" value="${escapeHtml(c.city || '')}"></div>
            <div class="field"><label>E-mail (login)</label><input class="input" value="${escapeHtml(c.email || '')}" disabled title="O e-mail de login não pode ser alterado aqui"></div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin:.6rem 0 .3rem;cursor:pointer;font-size:.86rem;font-weight:600;color:var(--gray-2)">
            <input type="checkbox" id="edit-second" ${has2 ? 'checked' : ''}> 2º motorista (conta conjunta)
          </label>
          <div id="edit-second-fields" style="display:${has2 ? 'block' : 'none'}">
            <div class="form-grid">
              <div class="field full"><label>Nome do 2º motorista</label><input class="input" name="second_name" value="${escapeHtml(c.second_name || '')}"></div>
              <div class="field"><label>CPF</label><input class="input" name="second_cpf" value="${escapeHtml(c.second_cpf || '')}"></div>
              <div class="field"><label>Telefone</label><input class="input" name="second_phone" value="${escapeHtml(c.second_phone || '')}"></div>
            </div>
          </div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Salvar</button>`,
    });
    const f = m.overlay.querySelector('#f-edit-mot');
    const toggle = m.overlay.querySelector('#edit-second');
    const sf = m.overlay.querySelector('#edit-second-fields');
    toggle.onchange = () => { sf.style.display = toggle.checked ? 'block' : 'none'; };
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      if (!f.reportValidity()) return;
      const data = Object.fromEntries(new FormData(f));
      if (!toggle.checked) { data.second_name = null; data.second_cpf = null; data.second_phone = null; }
      const btn = m.overlay.querySelector('[data-save]'); btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span> Salvando...';
      try { await api.updateDriver(c.id, data); toast('Dados atualizados.', 'ok'); m.close(); after && after(); }
      catch (err) { toast('Erro: ' + err.message, 'err'); btn.disabled = false; btn.innerHTML = `${icon('check')} Salvar`; }
    };
  }

  /* desvincular / trocar veículo do motorista */
  function manageVehicle(c, myVehs) {
    const current = myVehs[0];
    const opts = Object.values(vehiclesMap).filter((v) => v.status === 'disponivel' || v.client_id === c.id);
    const m = modal({
      title: 'Veículo vinculado', icon: 'car',
      body: `
        <p class="body-sm" style="margin-bottom:1rem">Veículo atual: <strong>${current ? escapeHtml(current.brand + ' ' + current.model + ' · ' + current.plate) : 'nenhum'}</strong></p>
        <div class="field" style="margin-bottom:0"><label>Vincular veículo</label>
          <select class="select" id="veh-link">
            <option value="">— Sem veículo (desvincular) —</option>
            ${opts.map((v) => `<option value="${v.id}" ${v.client_id === c.id ? 'selected' : ''}>${escapeHtml(v.brand + ' ' + v.model + ' · ' + v.plate)}</option>`).join('')}
          </select></div>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Salvar</button>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      const newId = m.overlay.querySelector('#veh-link').value;
      if (current && current.id !== newId) await api.saveVehicle({ id: current.id, client_id: null, status: 'disponivel' });
      if (newId) await api.saveVehicle({ id: newId, client_id: c.id, status: 'locado' });
      toast('Veículo atualizado.', 'ok'); m.close(); go('motoristas');
    };
  }

  /* alterar valor / dia das cobranças pendentes do motorista */
  async function managePayment(c, vehicle) {
    const pend = (await api.listPayments({ client_id: c.id })).filter((p) => paymentStatus(p) !== 'pago').sort((a, b) => a.due_date.localeCompare(b.due_date));
    const curVal = vehicle?.weekly_value || pend[0]?.amount || '';
    const curWd = pend[0] ? new Date(pend[0].due_date + 'T00:00:00').getDay() : 5;
    const m = modal({
      title: 'Gerenciar pagamento', icon: 'payments',
      body: `
        <p class="body-sm" style="margin-bottom:1rem">${pend.length} cobrança(s) pendente(s) serão atualizadas com o novo valor e dia.</p>
        <div class="form-grid">
          <div class="field"><label>Valor semanal (R$)</label><input class="input" type="number" step="0.01" id="mp-amount" value="${curVal}"></div>
          <div class="field"><label>Dia de pagamento</label><select class="select" id="mp-weekday">${WEEKDAYS.map((w) => `<option value="${w.v}" ${w.v === curWd ? 'selected' : ''}>${w.l}</option>`).join('')}</select></div>
        </div>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Aplicar</button>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      const amount = Number(m.overlay.querySelector('#mp-amount').value);
      const weekday = Number(m.overlay.querySelector('#mp-weekday').value);
      const btn = m.overlay.querySelector('[data-save]'); btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span> Aplicando...';
      try {
        for (const p of pend) {
          const d = new Date(p.due_date + 'T00:00:00'); d.setDate(d.getDate() + (weekday - d.getDay()));
          await api.savePayment({ id: p.id, amount, due_date: d.toISOString().slice(0, 10) });
        }
        if (vehicle && amount) await api.saveVehicle({ id: vehicle.id, weekly_value: amount });
        toast('Pagamentos atualizados.', 'ok'); m.close(); go('motoristas');
      } catch (err) { toast('Erro: ' + err.message, 'err'); btn.disabled = false; btn.innerHTML = `${icon('check')} Aplicar`; }
    };
  }

  /* gerenciar documentação (contratos + documentos) de um motorista */
  async function manageDocumentation(c, after) {
    const contracts = await api.listContracts({ client_id: c.id });
    const veh = Object.values(vehiclesMap).find((v) => v.client_id === c.id);
    const sixMonths = () => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); };
    const m = modal({
      title: `Contratos — ${c.full_name}`, icon: 'doc',
      body: `
        <p class="body-sm" style="margin-bottom:1rem">Contratos de locação deste motorista. Os <strong>documentos do veículo</strong> ficam vinculados ao carro, na aba <strong>Veículos</strong>.</p>
        <div class="panel-head" style="margin-bottom:.6rem"><h3 style="font-size:1rem;flex:1">Contratos</h3><button class="btn btn-ghost btn-sm" data-add-ct>${icon('upload')} Enviar</button></div>
        ${contracts.length ? contracts.map((ct) => `
          <div class="file-row"><div class="file-ico">${icon('doc')}</div>
            <div class="f-meta"><div class="f-name">${escapeHtml(ct.title || 'Contrato')}</div><div class="f-sub">${ct.end_date ? vigencia(ct.end_date).texto : 'sem vigência'}</div></div>
            <button class="icon-btn" data-open-ct="${ct.id}" title="Abrir">${icon('eye')}</button>
            <button class="icon-btn danger" data-del-ct="${ct.id}" title="Excluir">${icon('trash')}</button>
          </div>`).join('') : emptyBox('Nenhum contrato.')}`,
      footer: `<button class="btn btn-blue" data-cancel>Fechar</button>`,
    });
    const reopen = () => { m.close(); manageDocumentation(c, after); };
    m.overlay.querySelector('[data-cancel]').onclick = () => { m.close(); after && after(); };
    m.overlay.querySelector('[data-add-ct]').onclick = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,image/*';
      inp.onchange = async () => { if (!inp.files[0]) return; try { await api.uploadContract({ file: inp.files[0], client_id: c.id, vehicle_id: veh?.id || null, title: `Contrato de Locação — ${c.full_name}`, signed_date: todayISO(), start_date: todayISO(), end_date: sixMonths(), status: 'vigente' }); toast('Contrato enviado', 'ok'); reopen(); } catch (e) { toast('Erro: ' + e.message, 'err'); } };
      inp.click();
    };
    m.overlay.querySelectorAll('[data-open-ct]').forEach((b) => b.onclick = async () => { const rec = contracts.find((x) => x.id === b.dataset.openCt); openFile(await api.fileUrl(rec), rec.file_name || 'contrato.pdf'); });
    m.overlay.querySelectorAll('[data-del-ct]').forEach((b) => b.onclick = () => confirmDialog('Excluir este contrato?', async () => { await api.deleteContract(b.dataset.delCt); toast('Excluído', 'ok'); reopen(); }));
  }

  async function formMotorista(after) {
    const vehicles = Object.values(vehiclesMap);
    const m = modal({
      title: 'Cadastrar novo motorista', icon: 'users',
      body: `
        <form id="f-mot">
          <div class="form-grid">
            <div class="field full"><label>Nome completo (nome e sobrenome)</label><input class="input" name="full_name" required placeholder="Ex.: João da Silva"></div>
            <div class="field"><label>CPF</label><input class="input" name="cpf" placeholder="000.000.000-00"></div>
            <div class="field"><label>Telefone / WhatsApp</label><input class="input" name="phone" placeholder="5561988887777"></div>
            <div class="field"><label>E-mail (login)</label><input class="input" type="email" name="email" required placeholder="motorista@email.com"></div>
            <div class="field"><label>Cidade</label><input class="input" name="city" placeholder="Brasília/DF"></div>
            <div class="field full"><label>Vincular veículo</label>
              <select class="select" name="vehicle_id"><option value="">— Nenhum por enquanto —</option>${vehicles.map((v) => `<option value="${v.id}">${escapeHtml(v.brand + ' ' + v.model + ' · ' + v.plate)}${v.status !== 'disponivel' ? ' (em uso)' : ''}</option>`).join('')}</select></div>
          </div>

          <div class="eyebrow" style="margin:.7rem 0 .5rem">Pagamento semanal</div>
          <div class="form-grid">
            <div class="field"><label>Valor por semana (R$)</label><input class="input" type="number" step="0.01" name="weekly_value" placeholder="650"></div>
            <div class="field"><label>Dia a ser pago</label><select class="select" name="pay_weekday">${WEEKDAYS.map((w) => `<option value="${w.v}" ${w.v === 5 ? 'selected' : ''}>${w.l}</option>`).join('')}</select></div>
          </div>
          <div class="body-sm" style="margin:-.2rem 0 .2rem">Com valor + veículo, geramos 12 cobranças semanais automaticamente.</div>

          <div class="eyebrow" style="margin:.7rem 0 .5rem">Contrato de locação</div>
          <div class="field" style="margin-bottom:.2rem"><label>Contrato assinado (opcional)</label>
            <div class="upload-mini" id="mot-contract-drop">${icon('upload')} Anexar o contrato assinado (PDF ou imagem)</div>
            <input type="file" id="mot-contract-file" accept="application/pdf,image/*" hidden></div>
          <div class="body-sm" style="margin:0 0 .2rem">Fica salvo na Documentação do motorista.</div>

          <label style="display:flex;align-items:center;gap:8px;margin:.6rem 0 .3rem;cursor:pointer;font-size:.86rem;font-weight:600;color:var(--gray-2)">
            <input type="checkbox" id="toggle-second"> Adicionar 2º motorista (conta conjunta)
          </label>
          <div id="second-fields" style="display:none">
            <div class="form-grid">
              <div class="field full"><label>Nome do 2º motorista</label><input class="input" name="second_name" placeholder="Nome completo"></div>
              <div class="field"><label>CPF</label><input class="input" name="second_cpf"></div>
              <div class="field"><label>Telefone</label><input class="input" name="second_phone"></div>
            </div>
          </div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Cadastrar</button>`,
    });
    const f = m.overlay.querySelector('#f-mot');
    const toggle = m.overlay.querySelector('#toggle-second');
    const secondFields = m.overlay.querySelector('#second-fields');
    toggle.onchange = () => { secondFields.style.display = toggle.checked ? 'block' : 'none'; };
    let contractFile = null;
    const cDrop = m.overlay.querySelector('#mot-contract-drop');
    const cFile = m.overlay.querySelector('#mot-contract-file');
    cDrop.onclick = () => cFile.click();
    cFile.onchange = () => { if (cFile.files[0]) { contractFile = cFile.files[0]; cDrop.classList.add('has-file'); cDrop.innerHTML = `${icon('check')} ${escapeHtml(contractFile.name)}`; } };
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      if (!f.reportValidity()) return;
      const data = Object.fromEntries(new FormData(f));
      if (!toggle.checked) { data.second_name = null; data.second_cpf = null; data.second_phone = null; }
      data.weeks = 12;
      const btn = m.overlay.querySelector('[data-save]'); btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span> Cadastrando...';
      try {
        const cred = await api.createDriver(data);
        if (contractFile && cred.user_id) {
          const end = (() => { const dd = new Date(); dd.setMonth(dd.getMonth() + 6); return dd.toISOString().slice(0, 10); })();
          try { await api.uploadContract({ file: contractFile, client_id: cred.user_id, vehicle_id: data.vehicle_id || null, title: `Contrato de Locação — ${data.full_name}`, signed_date: todayISO(), start_date: todayISO(), end_date: end, status: 'vigente' }); }
          catch (e) { toast('Motorista criado, mas o contrato falhou: ' + e.message, 'err'); }
        }
        m.close(); showCredentials(cred, data.full_name, data.phone);
        after && after();
      } catch (err) { toast('Erro: ' + err.message, 'err'); btn.disabled = false; btn.innerHTML = `${icon('check')} Cadastrar`; }
    };
  }

  function showCredentials(cred, name, phone) {
    const txt = `Olá ${name?.split(' ')[0] || ''}! Seu acesso ao app Flex Drive:\nE-mail: ${cred.email}\nSenha provisória: ${cred.password}\n\nNo primeiro acesso você define sua senha pessoal.`;
    const m = modal({
      title: 'Motorista cadastrado!', icon: 'check',
      body: `
        <p class="body-sm" style="margin-bottom:1rem">Conta criada com sucesso. Envie a <strong>senha de primeiro acesso</strong> ao motorista — ele troca por uma senha pessoal ao entrar.</p>
        <div class="info-list" style="margin-bottom:1rem"><div class="info-row"><span class="k">E-mail (login)</span><span class="v">${escapeHtml(cred.email)}</span></div></div>
        <label style="font-size:.8rem;font-weight:600;color:var(--gray-2)">Senha de primeiro acesso</label>
        <div class="pix-copy" style="margin-top:6px">
          <div class="pix-code" style="font-size:1.15rem;text-align:center;letter-spacing:.12em;font-weight:700;max-height:none">${escapeHtml(cred.password)}</div>
          <button class="btn btn-blue btn-sm" id="cred-copy">${icon('copy')} Copiar</button>
        </div>`,
      footer: `<button class="btn btn-glass" data-cancel>Fechar</button>${phone ? `<a class="btn btn-blue" href="https://wa.me/${phone}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">${icon('whatsapp')} Enviar no WhatsApp</a>` : ''}`,
    });
    m.overlay.querySelector('#cred-copy').onclick = async () => { const ok = await copyText(`E-mail: ${cred.email}\nSenha: ${cred.password}`); toast(ok ? 'Acesso copiado!' : 'Copie manualmente.', ok ? 'ok' : 'info'); };
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
  }

  /* ════════════ PARCEIROS ════════════ */
  async function pageParceiros() {
    shell.setTitle('Parceiros', 'Oficinas, concessionárias e mecânicos');
    const partners = await api.listPartners();
    shell.content.innerHTML = `
      <div class="fade-in">
        <div class="panel glass" style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div><h3>Parceiros cadastrados</h3><div class="body-sm">${partners.length} parceiro(s)</div></div>
          <div class="spacer" style="flex:1"></div>
          <button class="btn btn-blue" id="novo-parceiro">${icon('plus')} Cadastrar parceiro</button>
        </div>
        <div class="veh-grid">
          ${partners.length ? partners.map((p) => `
            <div class="panel glass" style="margin:0">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:.8rem">
                <div class="kpi-ico" style="width:44px;height:44px;flex-shrink:0">${icon('store')}</div>
                <div style="min-width:0;flex:1"><div class="cell-strong" style="font-size:1.02rem">${escapeHtml(p.name)}</div>
                ${p.role ? `<span class="badge badge-blue" style="margin-top:.2rem">${escapeHtml(p.role)}</span>` : ''}</div>
              </div>
              ${p.location ? `<div class="body-sm" style="display:flex;gap:6px;align-items:flex-start">${icon('pin')} <span>${escapeHtml(p.location)}</span></div>` : ''}
              ${safeUrl(p.map_link) ? `<a class="body-sm text-blue" href="${escapeHtml(safeUrl(p.map_link))}" target="_blank" rel="noopener" style="display:inline-flex;gap:6px;align-items:center;margin-top:.4rem">${icon('map')} Ver no mapa</a>` : ''}
              <div class="row-actions" style="margin-top:1rem">
                <button class="icon-btn" title="Editar" data-edit-pt="${p.id}">${icon('edit')}</button>
                <button class="icon-btn danger" title="Excluir" data-del-pt="${p.id}">${icon('trash')}</button>
              </div>
            </div>`).join('') : emptyBox('Nenhum parceiro cadastrado. Clique em "Cadastrar parceiro".')}
        </div>
      </div>`;
    shell.content.querySelector('#novo-parceiro').onclick = () => formParceiro(null, () => go('parceiros'));
    shell.content.querySelectorAll('[data-edit-pt]').forEach((b) => b.onclick = () => formParceiro(partners.find((p) => p.id === b.dataset.editPt), () => go('parceiros')));
    shell.content.querySelectorAll('[data-del-pt]').forEach((b) => b.onclick = () => confirmDialog('Excluir este parceiro?', async () => { await api.deletePartner(b.dataset.delPt); toast('Parceiro excluído', 'ok'); go('parceiros'); }));
  }

  function formParceiro(p, after) {
    const isEdit = !!p;
    const m = modal({
      title: isEdit ? 'Editar parceiro' : 'Cadastrar parceiro', icon: 'store',
      body: `
        <form id="f-parc">
          <div class="field"><label>Nome do parceiro</label><input class="input" name="name" required value="${escapeHtml(p?.name || '')}" placeholder="Ex.: Auto Center do Zé"></div>
          <div class="field"><label>Função</label><input class="input" name="role" value="${escapeHtml(p?.role || '')}" placeholder="Revisão, Concessionária, Mecânico, Lanternagem..." list="parc-roles"></div>
          <datalist id="parc-roles"><option>Revisão</option><option>Concessionária</option><option>Mecânico</option><option>Lanternagem</option><option>Pneus e alinhamento</option><option>Elétrica</option><option>Funilaria e pintura</option></datalist>
          <div class="field"><label>Endereço</label><textarea class="textarea" name="location" placeholder="Rua, número, bairro, cidade" style="min-height:70px">${escapeHtml(p?.location || '')}</textarea></div>
          <div class="field" style="margin-bottom:0"><label>Link de localização</label><input class="input" type="url" name="map_link" value="${escapeHtml(p?.map_link || '')}" placeholder="Cole o link do Google Maps ou Waze">
            <div class="body-sm" style="margin-top:.3rem">Esse link é o que abre no botão <strong>"Ir até lá"</strong> do motorista.</div></div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('check')} Salvar</button>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      const f = m.overlay.querySelector('#f-parc'); if (!f.reportValidity()) return;
      const data = Object.fromEntries(new FormData(f));
      if (isEdit) data.id = p.id;
      await api.savePartner(data);
      toast(isEdit ? 'Parceiro atualizado' : 'Parceiro cadastrado', 'ok'); m.close(); after && after();
    };
  }

  /* ════════════ DOCUMENTAÇÃO ════════════ */
  async function pageDocumentos() {
    shell.setTitle('Documentação', 'Contratos assinados e documentos dos veículos');
    await refreshMaps();
    const [contracts, documents] = await Promise.all([api.listContracts(), api.listDocuments()]);
    const renov = contracts.filter((c) => c.status === 'renovacao_solicitada');

    shell.content.innerHTML = `
      <div class="fade-in">
        ${renov.length ? `<div class="alert alert-info show" style="margin-bottom:1.2rem;display:flex;align-items:center;gap:10px">${icon('renew')} <span><strong>${renov.length} pedido(s) de renovação</strong> de contrato — envie o novo documento assinado pelo botão "Renovar".</span></div>` : ''}
        <div class="panel glass">
          <div class="panel-head"><span class="panel-ico">${icon('upload')}</span><h3>Subir contrato assinado</h3></div>
          <div class="dropzone" id="dz-contract">
            <div class="dz-ico">${icon('upload', '')}</div>
            <div class="dz-title">Arraste o PDF aqui ou clique para selecionar</div>
            <div class="dz-sub">Defina a vigência ao enviar — o motorista vê o contador e pode pedir renovação</div>
            <input type="file" id="file-contract" accept="application/pdf,image/*" hidden>
          </div>
        </div>

        <div class="grid-cols grid-2-3">
          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('doc')}</span><h3>Contratos e vigência (${contracts.length})</h3></div>
            <div id="contract-list">${contracts.length ? contracts.map((c) => contractRow(c)).join('') : emptyBox('Nenhum contrato enviado.')}</div>
          </div>
          <div class="panel glass">
            <div class="panel-head"><span class="panel-ico">${icon('shield')}</span><h3>Docs. veículos (${documents.length})</h3>
              <button class="btn btn-ghost btn-sm" id="add-doc">${icon('plus')}</button></div>
            <div id="doc-list">${documents.length ? documents.map((d) => fileRow(d, 'document')).join('') : emptyBox('Nenhum documento.')}</div>
          </div>
        </div>
      </div>`;

    // dropzone contrato
    const dz = shell.content.querySelector('#dz-contract');
    const fileInput = shell.content.querySelector('#file-contract');
    dz.onclick = () => fileInput.click();
    ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) uploadContrato(e.dataTransfer.files[0]); });
    fileInput.onchange = () => { if (fileInput.files[0]) uploadContrato(fileInput.files[0]); };

    shell.content.querySelector('#add-doc').onclick = () => formDocumento(() => go('documentos'));
    shell.content.querySelectorAll('[data-renew-ct]').forEach((b) => b.onclick = () => {
      const c = contracts.find((x) => x.id === b.dataset.renewCt);
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,image/*';
      inp.onchange = () => { if (inp.files[0]) uploadContrato(inp.files[0], c); };
      inp.click();
    });
    bindFileRows();
  }

  async function uploadContrato(file, renewalOf = null) {
    const clients = Object.values(clientsMap), vehicles = Object.values(vehiclesMap);
    const preClient = renewalOf?.client_id, preVehicle = renewalOf?.vehicle_id;
    const start = todayISO();
    const end = (() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); })();
    const m = modal({
      title: renewalOf ? 'Renovar contrato' : 'Vincular contrato', icon: renewalOf ? 'renew' : 'doc',
      body: `
        <div class="file-row" style="margin-bottom:1rem"><div class="file-ico">${icon('doc')}</div><div class="f-meta"><div class="f-name">${escapeHtml(file.name)}</div><div class="f-sub">${(file.size / 1024).toFixed(0)} KB</div></div></div>
        <form id="f-ct">
          <div class="field"><label>Motorista</label><select class="select" name="client_id" required>${clients.map((c) => `<option value="${c.id}" ${preClient === c.id ? 'selected' : ''}>${escapeHtml(c.full_name)}</option>`).join('')}</select></div>
          <div class="field"><label>Veículo</label><select class="select" name="vehicle_id">${vehicles.map((v) => `<option value="${v.id}" ${preVehicle === v.id ? 'selected' : ''}>${escapeHtml(v.brand + ' ' + v.model + ' · ' + v.plate)}</option>`).join('')}</select></div>
          <div class="form-grid">
            <div class="field"><label>Assinatura</label><input class="input" type="date" name="signed_date" value="${start}"></div>
            <div class="field"><label>Início da vigência</label><input class="input" type="date" name="start_date" value="${start}" required></div>
            <div class="field full"><label>Fim da vigência</label><input class="input" type="date" name="end_date" value="${end}" required></div>
          </div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('upload')} ${renewalOf ? 'Renovar' : 'Enviar'}</button>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      const f = m.overlay.querySelector('#f-ct'); if (!f.reportValidity()) return;
      const data = Object.fromEntries(new FormData(f));
      data.title = `Contrato de Locação — ${clientsMap[data.client_id]?.full_name || ''}`;
      data.status = 'vigente';
      const btn = m.overlay.querySelector('[data-save]'); btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span> Enviando...';
      try {
        await api.uploadContract({ file, ...data });
        if (renewalOf) await api.setContractStatus(renewalOf.id, 'substituido');
        toast(renewalOf ? 'Contrato renovado! 🔄' : 'Contrato enviado! 📄', 'ok'); m.close(); go('documentos');
      } catch (err) { toast('Erro: ' + err.message, 'err'); btn.disabled = false; btn.innerHTML = `${icon('upload')} ${renewalOf ? 'Renovar' : 'Enviar'}`; }
    };
  }

  function contractRow(c) {
    const vig = vigencia(c.end_date);
    const st = c.status === 'renovacao_solicitada' ? 'renovacao_solicitada' : (c.status === 'substituido' ? 'substituido' : (vig.vencido ? 'vencido' : 'vigente'));
    return `
      <div class="file-row" style="align-items:center;flex-wrap:wrap;gap:10px">
        <div class="file-ico">${icon('doc')}</div>
        <div class="f-meta" style="flex:1 1 150px;min-width:150px">
          <div class="f-name">${escapeHtml(c.title || 'Contrato')}</div>
          ${c.client_id ? `<div class="f-sub">Motorista: <strong style="color:var(--blue)">${escapeHtml(clientName(c.client_id))}</strong></div>` : ''}
          <div class="f-sub">${escapeHtml(vehiclesMap[c.vehicle_id]?.plate || '—')} · ${c.end_date ? vig.texto : 'sem vigência'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:auto">
        ${badge(st)}
        ${c.status === 'renovacao_solicitada' ? `<button class="btn btn-blue btn-sm" data-renew-ct="${c.id}">${icon('renew')} Renovar</button>` : ''}
        <button class="icon-btn" title="Abrir" data-open='contract:${c.id}'>${icon('eye')}</button>
        <button class="icon-btn danger" title="Excluir" data-delfile='contract:${c.id}'>${icon('trash')}</button>
        </div>
      </div>`;
  }

  async function formDocumento(after) {
    const vehicles = Object.values(vehiclesMap);
    const m = modal({
      title: 'Documento do veículo', icon: 'shield',
      body: `
        <form id="f-doc">
          <div class="field"><label>Veículo</label><select class="select" name="vehicle_id" required>${vehicles.map((v) => `<option value="${v.id}">${escapeHtml(v.brand + ' ' + v.model + ' · ' + v.plate)}</option>`).join('')}</select></div>
          <div class="field"><label>Tipo</label><select class="select" name="type">${['CRLV', 'Seguro', 'Laudo', 'Vistoria', 'Outros'].map((x) => `<option>${x}</option>`).join('')}</select></div>
          <div class="field"><label>Arquivo</label><input class="input" type="file" name="file" accept="application/pdf,image/*" required></div>
        </form>`,
      footer: `<button class="btn btn-glass" data-cancel>Cancelar</button><button class="btn btn-blue" data-save>${icon('upload')} Enviar</button>`,
    });
    m.overlay.querySelector('[data-cancel]').onclick = m.close;
    m.overlay.querySelector('[data-save]').onclick = async () => {
      const f = m.overlay.querySelector('#f-doc'); if (!f.reportValidity()) return;
      const file = f.file.files[0];
      const v = vehiclesMap[f.vehicle_id.value];
      const data = { vehicle_id: f.vehicle_id.value, client_id: null, type: f.type.value, title: `${f.type.value} — ${v?.plate || ''}` };
      await api.uploadDocument({ file, ...data });
      toast('Documento enviado', 'ok'); m.close(); after && after();
    };
  }

  function fileRow(rec, kind) {
    return `
      <div class="file-row">
        <div class="file-ico ${kind === 'document' ? 'blue' : ''}">${icon('doc')}</div>
        <div class="f-meta">
          <div class="f-name">${escapeHtml(rec.title || rec.file_name || 'Documento')}</div>
          <div class="f-sub">${kind === 'contract' ? 'Assinado em ' + fmt.date(rec.signed_date) : escapeHtml(rec.type || '')} · ${escapeHtml(vehiclesMap[rec.vehicle_id]?.plate || '')}</div>
        </div>
        <button class="icon-btn" title="Abrir" data-open='${kind}:${rec.id}'>${icon('eye')}</button>
        <button class="icon-btn danger" title="Excluir" data-delfile='${kind}:${rec.id}'>${icon('trash')}</button>
      </div>`;
  }

  function bindFileRows() {
    shell.content.querySelectorAll('[data-open]').forEach((b) => b.onclick = async () => {
      const [kind, id] = b.dataset.open.split(':');
      const list = kind === 'contract' ? await api.listContracts() : await api.listDocuments();
      const rec = list.find((x) => x.id === id);
      const url = await api.fileUrl(rec);
      openFile(url, rec.file_name || 'documento.pdf');
    });
    shell.content.querySelectorAll('[data-delfile]').forEach((b) => b.onclick = () => {
      const [kind, id] = b.dataset.delfile.split(':');
      confirmDialog('Excluir este arquivo?', async () => {
        if (kind === 'contract') await api.deleteContract(id); else await api.deleteDocument(id);
        toast('Excluído', 'ok'); go('documentos');
      });
    });
  }

  /* ── helpers visuais ── */
  function kpi(ico, label, val, delta = '', dir = '') {
    return `<div class="kpi glass">
      <div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-ico">${icon(ico)}</span></div>
      <div class="kpi-val">${val}</div>
      ${delta ? `<div class="kpi-delta ${dir}">${delta}</div>` : ''}
    </div>`;
  }
  function fleetBar(loc, disp, manut, total) {
    if (!total) return emptyBox('Sem veículos.');
    const pct = (n) => (n / total * 100).toFixed(0);
    return `<div style="display:flex;height:14px;border-radius:8px;overflow:hidden;background:var(--off2)">
      <div style="width:${pct(loc)}%;background:var(--blue)"></div>
      <div style="width:${pct(disp)}%;background:var(--green)"></div>
      <div style="width:${pct(manut)}%;background:var(--amber)"></div>
    </div>`;
  }
  function emptyBox(msg) { return `<div class="empty">${icon('info', 'empty-ico')}<p>${escapeHtml(msg)}</p></div>`; }

  /* ── Sino de notificações (topo) ── */
  async function refreshNotifications() {
    try {
      const [payments, maints, contracts] = await Promise.all([api.listPayments(), api.listMaintenances(), api.listContracts()]);
      if (!Object.keys(clientsMap).length || !Object.keys(vehiclesMap).length) await refreshMaps();
      const analise = payments.filter((p) => paymentStatus(p) === 'em_analise');
      const atras = payments.filter((p) => paymentStatus(p) === 'atrasado');
      const hoje = payments.filter((p) => paymentStatus(p) === 'pendente' && daysFromToday(p.due_date) === 0);
      const semana = payments.filter((p) => paymentStatus(p) === 'pendente' && daysFromToday(p.due_date) > 0 && daysFromToday(p.due_date) <= 7);
      const manutReq = maints.filter((m) => m.status === 'solicitada');
      const renovReq = contracts.filter((c) => c.status === 'renovacao_solicitada');
      const count = analise.length + manutReq.length + renovReq.length + atras.length + hoje.length;
      const items = [
        ...analise.map((p) => ({ cls: 'pay', ico: 'check', title: `${clientName(p.client_id)} enviou comprovante`, sub: `${fmt.money(p.amount)} · confirme o recebimento`, goto: 'pagamentos' })),
        ...manutReq.map((m) => ({ cls: 'due', ico: 'wrench', title: `Manutenção solicitada — ${clientName(m.requested_by)}`, sub: `${escapeHtml(m.type || '')} · ${vehiclesMap[m.vehicle_id]?.plate || ''}`, goto: 'manutencoes' })),
        ...renovReq.map((c) => ({ cls: 'due', ico: 'renew', title: `Renovação de contrato — ${clientName(c.client_id)}`, sub: `${vehiclesMap[c.vehicle_id]?.plate || ''} · enviar novo documento`, goto: 'documentos' })),
        ...atras.map((p) => ({ cls: 'late', ico: 'alert', title: `Atrasado — ${clientName(p.client_id)}`, sub: `${fmt.money(p.amount)} · venceu ${fmt.date(p.due_date)}`, goto: 'pagamentos' })),
        ...hoje.map((p) => ({ cls: 'due', ico: 'clock', title: `Vence hoje — ${clientName(p.client_id)}`, sub: `${fmt.money(p.amount)}`, goto: 'pagamentos' })),
        ...semana.map((p) => ({ cls: 'due', ico: 'calendar', title: `Vence em ${daysFromToday(p.due_date)} dia(s) — ${clientName(p.client_id)}`, sub: `${fmt.money(p.amount)} · ${fmt.date(p.due_date)}`, goto: 'pagamentos' })),
      ];
      const latest = (currentKey === 'dashboard' && items.length) ? items[0] : null;
      shell.topbarActions.innerHTML = `
        ${latest ? `<button class="notif-latest ${latest.cls}" data-goto="${latest.goto}" title="Ver notificação">
          <span class="nl-ico">${icon(latest.ico)}</span>
          <span class="nl-txt"><span class="nl-title">${escapeHtml(latest.title)}</span><span class="nl-sub">${escapeHtml(latest.sub)}</span></span>
        </button>` : ''}
        <button class="bell-btn" id="bell-btn" aria-label="Notificações">${icon('bell')}${count ? `<span class="bell-badge">${count}</span>` : ''}</button>
        <div class="notif-dropdown" id="notif-dd">
          <div class="notif-head">${icon('bell')} Notificações ${count ? `<span class="badge badge-red" style="margin-left:auto">${count} nova(s)</span>` : ''}</div>
          ${items.length ? items.map((n) => `
            <div class="notif-item" data-goto="${n.goto}">
              <div class="notif-ico ${n.cls}">${icon(n.ico)}</div>
              <div style="min-width:0"><div class="n-title">${escapeHtml(n.title)}</div><div class="n-sub">${escapeHtml(n.sub)}</div></div>
            </div>`).join('') : `<div class="empty" style="padding:1.6rem">${icon('check', 'empty-ico')}<p>Tudo em dia! 🎉</p></div>`}
        </div>`;
      const btn = shell.topbarActions.querySelector('#bell-btn');
      const dd = shell.topbarActions.querySelector('#notif-dd');
      const closeDD = () => { dd.classList.remove('show'); document.removeEventListener('click', closeDD); };
      btn.onclick = (e) => { e.stopPropagation(); const open = dd.classList.toggle('show'); if (open) setTimeout(() => document.addEventListener('click', closeDD), 0); else document.removeEventListener('click', closeDD); };
      dd.querySelectorAll('[data-goto]').forEach((it) => it.onclick = () => { closeDD(); go(it.dataset.goto); });
      const nl = shell.topbarActions.querySelector('.notif-latest');
      if (nl) nl.onclick = () => go(nl.dataset.goto);
    } catch (e) { /* silencioso */ }
  }

  // inicia no dashboard
  go('dashboard');
}
