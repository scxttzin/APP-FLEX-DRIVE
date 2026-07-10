/* ============================================================
   CAMADA DE DADOS — interface única para os dois backends:
   • MODO DEMO  → dados salvos no navegador (localStorage)
   • MODO REAL  → Supabase (Auth + Postgres + Storage)
   As telas usam sempre `api.*`, sem saber qual backend está ativo.
   ============================================================ */
import { CONFIG, IS_DEMO } from './config.js';
import { SEED } from './mockData.js';
import { getSupabase } from './supabaseClient.js';

const uid = (p = 'id') => p + '-' + Math.random().toString(36).slice(2, 9);
const clone = (x) => JSON.parse(JSON.stringify(x));
const isoDate = (d) => d.toISOString().slice(0, 10);

/* senha aleatória de 1º acesso (8 caracteres, sem caracteres ambíguos) */
export function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = ''; for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* gera as datas de vencimento semanais a partir de um 1º vencimento */
function weeklyDates(first_due, weeks) {
  const out = []; const d = new Date(first_due + 'T00:00:00');
  for (let i = 0; i < weeks; i++) { out.push(isoDate(d)); d.setDate(d.getDate() + 7); }
  return out;
}

/* próxima data (>= hoje) que cai no dia da semana escolhido (0=Dom..6=Sáb) */
function nextWeekdayISO(weekday) {
  const d = new Date(); while (d.getDay() !== Number(weekday)) d.setDate(d.getDate() + 1); return isoDate(d);
}
/* linhas de pagamento semanal a partir de um dia da semana + valor */
function weeklyPaymentRows(weekday, value, weeks = 12, method = 'Pix') {
  return weeklyDates(nextWeekdayISO(weekday), weeks).map((due, i) => ({ amount: Number(value), due_date: due, status: 'pendente', method, week_ref: i + 1, paid_date: null }));
}

/* ── CONFIGURAÇÃO DE COBRANÇA (métodos Pix + juros por marca) ──
   Normaliza qualquer formato salvo para a forma nova:
   { methods:[{id,label,pix_key,pix_name,pix_city}], late_fee_per_day, late_fees:[{brand,value}] } */
const normStr = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
function normalizePaymentSettings(raw, fallback = {}) {
  const s = raw || {};
  let methods = Array.isArray(s.methods) ? s.methods.filter(Boolean) : [];
  if (!methods.length) {
    // compat: monta um método padrão a partir das chaves soltas (formato antigo)
    const pk = s.pix_key ?? fallback.chave ?? '';
    methods = [{ id: 'default', label: 'Chave principal', pix_key: pk, pix_name: s.pix_name ?? fallback.nome ?? '', pix_city: s.pix_city ?? fallback.cidade ?? '' }];
  }
  methods = methods.map((m, i) => ({ id: m.id || ('m' + i), label: m.label || `Chave ${i + 1}`, pix_key: m.pix_key || '', pix_name: m.pix_name || '', pix_city: m.pix_city || '' }));
  const late_fees = Array.isArray(s.late_fees) ? s.late_fees.filter((x) => x && x.brand).map((x) => ({ brand: String(x.brand).trim(), value: Number(x.value || 0) })) : [];
  const first = methods[0];
  return {
    methods, late_fees,
    late_fee_per_day: Number(s.late_fee_per_day ?? 0),
    pix_key: first.pix_key, pix_name: first.pix_name, pix_city: first.pix_city, // legado (1º método)
  };
}
/* juros/dia para uma marca específica (usa exceção da marca ou o valor padrão) */
export function lateFeeForBrand(cfg, brand) {
  const ex = (cfg.late_fees || []).find((x) => normStr(x.brand) === normStr(brand));
  return Number(ex ? ex.value : (cfg.late_fee_per_day || 0));
}
/* método de cobrança escolhido para um motorista (por id), com fallback no 1º */
export function methodForDriver(cfg, methodId) {
  const list = cfg.methods || [];
  return list.find((m) => m.id === methodId) || list[0] || null;
}

/* ════════════════════════════════════════════════════════════
   BACKEND DEMO (localStorage)
   ════════════════════════════════════════════════════════════ */
const DB_KEY = 'flexdrive_demo_db';
const SESSION_KEY = 'flexdrive_demo_session';
const FILES_KEY = 'flexdrive_demo_files';

function loadDB() {
  let db = localStorage.getItem(DB_KEY);
  if (!db) { db = clone(SEED); localStorage.setItem(DB_KEY, JSON.stringify(db)); return db; }
  return JSON.parse(db);
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function loadFiles() { try { return JSON.parse(localStorage.getItem(FILES_KEY) || '{}'); } catch { return {}; } }
function saveFiles(f) { try { localStorage.setItem(FILES_KEY, JSON.stringify(f)); } catch (e) { /* quota — ignora conteúdo */ } }

const fileToDataURL = (file) => new Promise((res) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => res(null);
  r.readAsDataURL(file);
});

const DemoBackend = {
  async signIn({ email, password, role }) {
    const db = loadDB();
    const u = db.users.find((x) => x.email.toLowerCase() === String(email).toLowerCase() && x.password === password);
    if (!u) throw new Error('E-mail ou senha incorretos.');
    if (role && u.role !== role) throw new Error(`Esta conta é de ${u.role === 'empresa' ? 'Empresa' : 'Motorista'}. Selecione a aba correta.`);
    const session = { id: u.id, email: u.email, role: u.role, full_name: u.full_name, phone: u.phone, must_change_password: !!u.must_change_password };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },
  async signOut() { localStorage.removeItem(SESSION_KEY); },
  async currentUser() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } },
  async getAuthToken() { return localStorage.getItem(SESSION_KEY); },
  async restoreSession(token) { if (!token) throw new Error('Sessão expirada. Entre com a senha.'); localStorage.setItem(SESSION_KEY, token); return JSON.parse(token); },

  async clients() { return loadDB().clients; },

  async createDriver({ full_name, cpf, email, phone, city, second_name, second_cpf, second_phone, vehicle_id, weekly_value, pay_weekday, weeks, payment_method_id }) {
    const db = loadDB();
    if (db.users.find((x) => x.email.toLowerCase() === String(email).toLowerCase())) throw new Error('Já existe uma conta com este e-mail.');
    const password = genPassword(); const id = uid('u');
    db.users.push({ id, email, password, role: 'cliente', full_name, phone, must_change_password: true });
    db.clients.push({ id, full_name, email, phone, cpf, city, second_name: second_name || null, second_cpf: second_cpf || null, second_phone: second_phone || null, payment_method_id: payment_method_id || null, since: isoDate(new Date()) });
    if (vehicle_id) {
      const v = db.vehicles.find((x) => x.id === vehicle_id);
      if (v) { v.client_id = id; v.status = 'locado'; if (weekly_value) v.weekly_value = Number(weekly_value); }
      if (weekly_value && pay_weekday != null) {
        weeklyPaymentRows(pay_weekday, weekly_value, weeks || 12).forEach((r) => db.payments.push({ id: uid('p'), client_id: id, vehicle_id, ...r }));
      }
    }
    saveDB(db);
    return { email, password, user_id: id };
  },
  async deleteDriver(user_id) {
    const db = loadDB();
    db.users = db.users.filter((u) => u.id !== user_id);
    db.clients = db.clients.filter((c) => c.id !== user_id);
    db.payments = db.payments.filter((p) => p.client_id !== user_id);
    db.contracts = db.contracts.filter((c) => c.client_id !== user_id);
    db.vehicles.forEach((v) => { if (v.client_id === user_id) { v.client_id = null; v.status = 'disponivel'; } });
    saveDB(db);
  },
  async updateDriver(id, data) {
    const db = loadDB();
    const u = db.users.find((x) => x.id === id); if (u) { if (data.full_name) u.full_name = data.full_name; if (data.phone) u.phone = data.phone; }
    const c = db.clients.find((x) => x.id === id); if (c) Object.assign(c, data);
    saveDB(db);
  },
  async uploadVehiclePhoto(vehicleId, file) {
    const dataUrl = await fileToDataURL(file);
    const db = loadDB(); const v = db.vehicles.find((x) => x.id === vehicleId); if (v) v.photo_url = dataUrl;
    saveDB(db); return dataUrl;
  },
  async setOwnPassword(newPassword) {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); if (!session) throw new Error('Sessão expirada.');
    const db = loadDB(); const u = db.users.find((x) => x.id === session.id);
    if (u) { u.password = newPassword; u.must_change_password = false; }
    saveDB(db);
    session.must_change_password = false; localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  async listVehicles(filter = {}) {
    let v = loadDB().vehicles;
    if (filter.client_id) v = v.filter((x) => x.client_id === filter.client_id);
    if (filter.status) v = v.filter((x) => x.status === filter.status);
    return v;
  },
  async getVehicle(id) { return loadDB().vehicles.find((x) => x.id === id) || null; },
  async saveVehicle(data) {
    const db = loadDB();
    if (data.id) { const i = db.vehicles.findIndex((x) => x.id === data.id); db.vehicles[i] = { ...db.vehicles[i], ...data }; }
    else { data.id = uid('v'); db.vehicles.push(data); }
    saveDB(db); return data;
  },
  async deleteVehicle(id) { const db = loadDB(); db.vehicles = db.vehicles.filter((x) => x.id !== id); saveDB(db); },

  async listPayments(filter = {}) {
    let p = loadDB().payments;
    if (filter.client_id) p = p.filter((x) => x.client_id === filter.client_id);
    return p.slice().sort((a, b) => a.due_date.localeCompare(b.due_date));
  },
  async savePayment(data) {
    const db = loadDB();
    if (data.id) { const i = db.payments.findIndex((x) => x.id === data.id); db.payments[i] = { ...db.payments[i], ...data }; }
    else { data.id = uid('p'); db.payments.push(data); }
    saveDB(db); return data;
  },
  async deletePayment(id) { const db = loadDB(); db.payments = db.payments.filter((x) => x.id !== id); saveDB(db); },
  async createWeeklyPlan({ client_id, vehicle_id, amount, method, first_due, weeks }) {
    const db = loadDB(); const rows = weeklyDates(first_due, weeks).map((due, i) => ({
      id: uid('p'), client_id, vehicle_id, amount: Number(amount), due_date: due, paid_date: null, status: 'pendente', method, week_ref: i + 1,
    }));
    db.payments.push(...rows); saveDB(db); return rows;
  },
  async submitReceipt(payment, file) {
    const db = loadDB(); const p = db.payments.find((x) => x.id === payment.id); if (!p) return;
    const files = loadFiles();
    if (file) { files['rcpt-' + p.id] = await fileToDataURL(file); saveFiles(files); p.receipt_name = file.name; }
    p.status = 'em_analise'; p.submitted_at = new Date().toISOString(); saveDB(db); return p;
  },
  async receiptUrl(payment) { return loadFiles()['rcpt-' + payment.id] || null; },

  async listMaintenances(filter = {}) {
    let m = loadDB().maintenances;
    if (filter.vehicle_id) m = m.filter((x) => x.vehicle_id === filter.vehicle_id);
    return m.slice().sort((a, b) => (b.scheduled_date || '').localeCompare(a.scheduled_date || ''));
  },
  async saveMaintenance(data) {
    const db = loadDB();
    if (data.id) { const i = db.maintenances.findIndex((x) => x.id === data.id); db.maintenances[i] = { ...db.maintenances[i], ...data }; }
    else { data.id = uid('m'); db.maintenances.push(data); }
    saveDB(db); return data;
  },
  async deleteMaintenance(id) { const db = loadDB(); db.maintenances = db.maintenances.filter((x) => x.id !== id); saveDB(db); },
  async requestMaintenance({ vehicle_id, km, file, file2, category, wear_type, description }) {
    const db = loadDB(); const id = uid('m'); const files = loadFiles();
    let photo_path = null, photo_path2 = null;
    if (file) { photo_path = 'mphoto-' + id; files[photo_path] = await fileToDataURL(file); }
    if (file2) { photo_path2 = 'mphoto2-' + id; files[photo_path2] = await fileToDataURL(file2); }
    if (file || file2) saveFiles(files);
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    const rec = {
      id, vehicle_id, requested_by: session?.id || null, km: Number(km), photo_path, photo_path2, category, wear_type: wear_type || null,
      type: category === 'desgaste' ? (wear_type ? wear_type[0].toUpperCase() + wear_type.slice(1) : 'Desgaste') : 'Revisão completa',
      description: description || '', status: 'solicitada', cost: 0, scheduled_date: isoDate(new Date()), done_date: null,
    };
    db.maintenances.push(rec);
    const v = db.vehicles.find((x) => x.id === vehicle_id); if (v) v.km = Math.max(Number(v.km) || 0, Number(km));
    saveDB(db); return rec;
  },
  async maintenancePhotoUrl(record, which = 'photo_path') { const p = record[which]; return p ? (loadFiles()[p] || null) : null; },

  async listContracts(filter = {}) {
    let c = loadDB().contracts;
    if (filter.client_id) c = c.filter((x) => x.client_id === filter.client_id);
    return c.slice().sort((a, b) => (b.signed_date || '').localeCompare(a.signed_date || ''));
  },
  async uploadContract({ file, ...meta }) {
    const db = loadDB(); const id = uid('c');
    const files = loadFiles();
    if (file) { files[id] = await fileToDataURL(file); saveFiles(files); meta.file_name = file.name; }
    const rec = { id, file_url: null, ...meta };
    db.contracts.push(rec); saveDB(db); return rec;
  },
  async deleteContract(id) { const db = loadDB(); db.contracts = db.contracts.filter((x) => x.id !== id); saveDB(db); const f = loadFiles(); delete f[id]; saveFiles(f); },
  async requestRenewal(contract_id) { const db = loadDB(); const ct = db.contracts.find((x) => x.id === contract_id); if (ct) ct.status = 'renovacao_solicitada'; saveDB(db); },
  async setContractStatus(id, status) { const db = loadDB(); const ct = db.contracts.find((x) => x.id === id); if (ct) ct.status = status; saveDB(db); },
  async updateContract(id, data) { const db = loadDB(); const ct = db.contracts.find((x) => x.id === id); if (ct) Object.assign(ct, data); saveDB(db); return ct; },

  async listDocuments(filter = {}) {
    let d = loadDB().documents;
    if (filter.client_id) d = d.filter((x) => x.client_id === filter.client_id);
    if (filter.vehicle_id) d = d.filter((x) => x.vehicle_id === filter.vehicle_id);
    return d;
  },
  async uploadDocument({ file, ...meta }) {
    const db = loadDB(); const id = uid('d');
    const files = loadFiles();
    if (file) { files[id] = await fileToDataURL(file); saveFiles(files); meta.file_name = file.name; }
    const rec = { id, file_url: null, ...meta };
    db.documents.push(rec); saveDB(db); return rec;
  },
  async deleteDocument(id) { const db = loadDB(); db.documents = db.documents.filter((x) => x.id !== id); saveDB(db); const f = loadFiles(); delete f[id]; saveFiles(f); },

  async fileUrl(record) {
    const files = loadFiles();
    return files[record.id] || null; // null => arquivo de exemplo (sem conteúdo real)
  },

  async listRequests(filter = {}) {
    let r = loadDB().contact_requests;
    if (filter.client_id) r = r.filter((x) => x.client_id === filter.client_id);
    return r.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },
  async createRequest(data) {
    const db = loadDB(); data.id = uid('r'); data.status = 'aberto'; data.created_at = new Date().toISOString().slice(0, 10);
    db.contact_requests.push(data); saveDB(db); return data;
  },
  async updateRequest(id, status) { const db = loadDB(); const r = db.contact_requests.find((x) => x.id === id); if (r) r.status = status; saveDB(db); },

  async getPaymentSettings() {
    const db = loadDB();
    return normalizePaymentSettings((db.settings && db.settings.payment) || {}, CONFIG.EMPRESA.pix || {});
  },
  async savePaymentSettings(data) {
    const db = loadDB(); db.settings = db.settings || {};
    db.settings.payment = {
      methods: (data.methods || []).map((m) => ({ id: m.id, label: (m.label || '').trim(), pix_key: (m.pix_key || '').trim(), pix_name: (m.pix_name || '').trim(), pix_city: (m.pix_city || '').trim() })),
      late_fee_per_day: Number(data.late_fee_per_day || 0),
      late_fees: (data.late_fees || []).filter((x) => x && x.brand).map((x) => ({ brand: String(x.brand).trim(), value: Number(x.value || 0) })),
    };
    saveDB(db); return normalizePaymentSettings(db.settings.payment, CONFIG.EMPRESA.pix || {});
  },
  /* método de cobrança do usuário logado (motorista) já resolvido */
  async getMyPaymentMethod() {
    const cfg = await this.getPaymentSettings();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    const c = session ? loadDB().clients.find((x) => x.id === session.id) : null;
    return methodForDriver(cfg, c?.payment_method_id);
  },

  async listPartners() { return loadDB().partners || []; },
  async savePartner(data) {
    const db = loadDB(); db.partners = db.partners || [];
    if (data.id) { const i = db.partners.findIndex((x) => x.id === data.id); db.partners[i] = { ...db.partners[i], ...data }; }
    else { data.id = uid('pt'); data.created_at = isoDate(new Date()); db.partners.push(data); }
    saveDB(db); return data;
  },
  async deletePartner(id) { const db = loadDB(); db.partners = (db.partners || []).filter((x) => x.id !== id); saveDB(db); },
};

/* ════════════════════════════════════════════════════════════
   BACKEND SUPABASE (real)
   ════════════════════════════════════════════════════════════ */
async function sb() { const c = await getSupabase(); if (!c) throw new Error('Supabase não configurado'); return c; }
function unwrap({ data, error }) { if (error) throw new Error(error.message); return data; }

/* chama a Edge Function admin-driver (operações de administrador) */
async function callAdmin(action, payload) {
  const c = await sb();
  const { data: { session } } = await c.auth.getSession();
  if (!session) throw new Error('Sessão expirada.');
  const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/admin-driver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'Falha na operação.');
  return j;
}

const SupabaseBackend = {
  async signIn({ email, password, role }) {
    const c = await sb();
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error('E-mail ou senha incorretos.');
    const prof = unwrap(await c.from('profiles').select('*').eq('id', data.user.id).single());
    if (role && prof.role !== role) { await c.auth.signOut(); throw new Error(`Esta conta é de ${prof.role === 'empresa' ? 'Empresa' : 'Motorista'}. Selecione a aba correta.`); }
    return { id: data.user.id, email: data.user.email, ...prof };
  },
  async signOut() { const c = await sb(); await c.auth.signOut(); },
  async currentUser() {
    const c = await sb();
    const { data: { session } } = await c.auth.getSession();
    if (!session) return null;
    const prof = unwrap(await c.from('profiles').select('*').eq('id', session.user.id).single());
    return { id: session.user.id, email: session.user.email, ...prof };
  },
  async getAuthToken() { const c = await sb(); const { data: { session } } = await c.auth.getSession(); return session?.refresh_token || null; },
  async restoreSession(token) {
    const c = await sb();
    const { data, error } = await c.auth.refreshSession({ refresh_token: token });
    if (error || !data?.session) throw new Error('Sessão expirada. Entre com a senha.');
    const prof = unwrap(await c.from('profiles').select('*').eq('id', data.session.user.id).single());
    return { id: data.session.user.id, email: data.session.user.email, ...prof };
  },

  async clients() { const c = await sb(); return unwrap(await c.from('profiles').select('*').eq('role', 'cliente').order('full_name')); },

  async createDriver(d) {
    const payments = (d.vehicle_id && d.weekly_value && d.pay_weekday != null) ? weeklyPaymentRows(d.pay_weekday, d.weekly_value, d.weeks || 12) : [];
    const r = await callAdmin('create', {
      full_name: d.full_name, cpf: d.cpf, email: d.email, phone: d.phone, city: d.city,
      second_name: d.second_name || null, second_cpf: d.second_cpf || null, second_phone: d.second_phone || null,
      vehicle_id: d.vehicle_id || null, weekly_value: d.weekly_value ? Number(d.weekly_value) : null, payments,
    });
    let user_id = r.user_id || null;
    if (!user_id) { try { const c = await sb(); const prof = unwrap(await c.from('profiles').select('id').eq('email', d.email).single()); user_id = prof?.id; } catch {} }
    if (user_id && d.payment_method_id) { try { const c = await sb(); await c.from('profiles').update({ payment_method_id: d.payment_method_id }).eq('id', user_id); } catch {} }
    return { email: r.email, password: r.password, user_id };
  },
  async deleteDriver(user_id) { await callAdmin('delete', { user_id }); },
  async updateDriver(id, data) {
    const c = await sb();
    try { unwrap(await c.from('profiles').update(data).eq('id', id)); }
    catch (e) { const { payment_method_id, ...rest } = data; unwrap(await c.from('profiles').update(rest).eq('id', id)); } // coluna ausente
  },
  async uploadVehiclePhoto(vehicleId, file) {
    const c = await sb();
    const path = `${vehicleId}/${Date.now()}-${file.name}`;
    unwrap(await c.storage.from('vehicles').upload(path, file, { upsert: true }));
    const url = c.storage.from('vehicles').getPublicUrl(path).data.publicUrl;
    unwrap(await c.from('vehicles').update({ photo_url: url }).eq('id', vehicleId));
    return url;
  },
  async setOwnPassword(newPassword) {
    const c = await sb();
    const { error } = await c.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    const { data: { user } } = await c.auth.getUser();
    unwrap(await c.from('profiles').update({ must_change_password: false }).eq('id', user.id));
  },

  async listVehicles(filter = {}) {
    const c = await sb(); let q = c.from('vehicles').select('*').order('plate');
    if (filter.client_id) q = q.eq('client_id', filter.client_id);
    if (filter.status) q = q.eq('status', filter.status);
    return unwrap(await q);
  },
  async getVehicle(id) { const c = await sb(); return unwrap(await c.from('vehicles').select('*').eq('id', id).single()); },
  async saveVehicle(data) {
    const c = await sb();
    if (data.id) return unwrap(await c.from('vehicles').update(data).eq('id', data.id).select().single());
    const { id, ...ins } = data; return unwrap(await c.from('vehicles').insert(ins).select().single());
  },
  async deleteVehicle(id) { const c = await sb(); unwrap(await c.from('vehicles').delete().eq('id', id)); },

  async listPayments(filter = {}) {
    const c = await sb(); let q = c.from('payments').select('*').order('due_date');
    if (filter.client_id) q = q.eq('client_id', filter.client_id);
    return unwrap(await q);
  },
  async savePayment(data) {
    const c = await sb();
    if (data.id) return unwrap(await c.from('payments').update(data).eq('id', data.id).select().single());
    const { id, ...ins } = data; return unwrap(await c.from('payments').insert(ins).select().single());
  },
  async deletePayment(id) { const c = await sb(); unwrap(await c.from('payments').delete().eq('id', id)); },
  async createWeeklyPlan({ client_id, vehicle_id, amount, method, first_due, weeks }) {
    const c = await sb();
    const rows = weeklyDates(first_due, weeks).map((due, i) => ({ client_id, vehicle_id, amount: Number(amount), due_date: due, status: 'pendente', method, week_ref: i + 1 }));
    return unwrap(await c.from('payments').insert(rows).select());
  },
  async submitReceipt(payment, file) {
    const c = await sb();
    const { data: { session } } = await c.auth.getSession();
    let path = null, name = null;
    if (file) { path = `${session.user.id}/${Date.now()}-${file.name}`; unwrap(await c.storage.from('receipts').upload(path, file)); name = file.name; }
    unwrap(await c.rpc('submit_payment_receipt', { p_id: payment.id, p_path: path, p_name: name }));
  },
  async receiptUrl(payment) {
    if (!payment.receipt_path) return null;
    const c = await sb();
    const { data } = await c.storage.from('receipts').createSignedUrl(payment.receipt_path, 3600);
    return data?.signedUrl || null;
  },

  async listMaintenances(filter = {}) {
    const c = await sb(); let q = c.from('maintenances').select('*').order('scheduled_date', { ascending: false });
    if (filter.vehicle_id) q = q.eq('vehicle_id', filter.vehicle_id);
    return unwrap(await q);
  },
  async saveMaintenance(data) {
    const c = await sb();
    if (data.id) return unwrap(await c.from('maintenances').update(data).eq('id', data.id).select().single());
    const { id, ...ins } = data; return unwrap(await c.from('maintenances').insert(ins).select().single());
  },
  async deleteMaintenance(id) { const c = await sb(); unwrap(await c.from('maintenances').delete().eq('id', id)); },
  async requestMaintenance({ vehicle_id, km, file, file2, category, wear_type, description }) {
    const c = await sb();
    const { data: { session } } = await c.auth.getSession();
    const upload = async (fl, tag) => {
      if (!fl) return null;
      const p = `${session.user.id}/${Date.now()}-${tag}-${fl.name}`;
      unwrap(await c.storage.from('maintenance').upload(p, fl));
      return p;
    };
    const path = await upload(file, 'a');
    const path2 = await upload(file2, 'b');
    const rec = unwrap(await c.rpc('request_maintenance', { p_vehicle: vehicle_id, p_km: Number(km), p_photo: path, p_category: category, p_wear: wear_type || null, p_desc: description || '' }));
    // 2ª foto (revisão completa): grava photo_path2 — requer a coluna do migration_v10.sql
    if (path2 && rec?.id) { try { await c.from('maintenances').update({ photo_path2: path2 }).eq('id', rec.id); rec.photo_path2 = path2; } catch (e) { /* coluna ausente — ignore */ } }
    return rec;
  },
  async maintenancePhotoUrl(record, which = 'photo_path') {
    const p = record[which]; if (!p) return null;
    const c = await sb();
    const { data } = await c.storage.from('maintenance').createSignedUrl(p, 3600);
    return data?.signedUrl || null;
  },

  async listContracts(filter = {}) {
    const c = await sb(); let q = c.from('contracts').select('*').order('signed_date', { ascending: false });
    if (filter.client_id) q = q.eq('client_id', filter.client_id);
    return unwrap(await q);
  },
  async uploadContract({ file, ...meta }) {
    const c = await sb(); let file_path = null;
    if (file) { file_path = `${meta.client_id || 'geral'}/${Date.now()}-${file.name}`; unwrap(await c.storage.from('contracts').upload(file_path, file)); meta.file_name = file.name; }
    return unwrap(await c.from('contracts').insert({ ...meta, file_path }).select().single());
  },
  async deleteContract(id) { const c = await sb(); unwrap(await c.from('contracts').delete().eq('id', id)); },
  async requestRenewal(contract_id) { const c = await sb(); unwrap(await c.rpc('request_contract_renewal', { p_contract: contract_id })); },
  async setContractStatus(id, status) { const c = await sb(); unwrap(await c.from('contracts').update({ status }).eq('id', id)); },
  async updateContract(id, data) { const c = await sb(); return unwrap(await c.from('contracts').update(data).eq('id', id).select().single()); },

  async listDocuments(filter = {}) {
    const c = await sb(); let q = c.from('documents').select('*').order('created_at', { ascending: false });
    if (filter.client_id) q = q.eq('client_id', filter.client_id);
    if (filter.vehicle_id) q = q.eq('vehicle_id', filter.vehicle_id);
    return unwrap(await q);
  },
  async uploadDocument({ file, ...meta }) {
    const c = await sb(); let file_path = null;
    if (file) { file_path = `${meta.vehicle_id || 'geral'}/${Date.now()}-${file.name}`; unwrap(await c.storage.from('documents').upload(file_path, file)); meta.file_name = file.name; }
    return unwrap(await c.from('documents').insert({ ...meta, file_path }).select().single());
  },
  async deleteDocument(id) { const c = await sb(); unwrap(await c.from('documents').delete().eq('id', id)); },

  async fileUrl(record) {
    if (!record.file_path) return null;
    const c = await sb();
    const bucket = record.title && record.type ? 'documents' : (record.signed_date ? 'contracts' : 'documents');
    const { data } = await c.storage.from(bucket).createSignedUrl(record.file_path, 3600);
    return data?.signedUrl || null;
  },

  async listRequests(filter = {}) {
    const c = await sb(); let q = c.from('contact_requests').select('*').order('created_at', { ascending: false });
    if (filter.client_id) q = q.eq('client_id', filter.client_id);
    return unwrap(await q);
  },
  async createRequest(data) { const c = await sb(); return unwrap(await c.from('contact_requests').insert({ ...data, status: 'aberto' }).select().single()); },
  async updateRequest(id, status) { const c = await sb(); unwrap(await c.from('contact_requests').update({ status }).eq('id', id)); },

  async getPaymentSettings() {
    const c = await sb(); const p = CONFIG.EMPRESA.pix || {}; let s = {};
    try { const { data } = await c.from('app_settings').select('*').eq('id', 'payment').maybeSingle(); s = data || {}; } catch (e) { s = {}; }
    // methods/late_fees ficam em colunas jsonb (migration_v11). Faz parse tolerante.
    const parse = (v) => { if (!v) return null; if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } } return v; };
    return normalizePaymentSettings({ ...s, methods: parse(s.methods), late_fees: parse(s.late_fees) }, p);
  },
  async savePaymentSettings(data) {
    const c = await sb();
    const methods = (data.methods || []).map((m) => ({ id: m.id, label: (m.label || '').trim(), pix_key: (m.pix_key || '').trim(), pix_name: (m.pix_name || '').trim(), pix_city: (m.pix_city || '').trim() }));
    const late_fees = (data.late_fees || []).filter((x) => x && x.brand).map((x) => ({ brand: String(x.brand).trim(), value: Number(x.value || 0) }));
    const first = methods[0] || {};
    const row = {
      id: 'payment', updated_at: new Date().toISOString(), late_fee_per_day: Number(data.late_fee_per_day || 0),
      pix_key: first.pix_key || '', pix_name: first.pix_name || '', pix_city: first.pix_city || '', // 1º método (compat)
      methods, late_fees,
    };
    try { return normalizePaymentSettings(unwrap(await c.from('app_settings').upsert(row).select().single()), CONFIG.EMPRESA.pix || {}); }
    catch (e) {
      // colunas methods/late_fees ausentes — grava só o formato antigo
      const { methods: _m, late_fees: _l, ...legacy } = row;
      return normalizePaymentSettings(unwrap(await c.from('app_settings').upsert(legacy).select().single()), CONFIG.EMPRESA.pix || {});
    }
  },
  async getMyPaymentMethod() {
    const cfg = await this.getPaymentSettings();
    const c = await sb();
    try {
      const { data: { user } } = await c.auth.getUser();
      const { data } = await c.from('profiles').select('payment_method_id').eq('id', user.id).maybeSingle();
      return methodForDriver(cfg, data?.payment_method_id);
    } catch { return methodForDriver(cfg, null); }
  },

  async listPartners() { const c = await sb(); return unwrap(await c.from('partners').select('*').order('name')); },
  async savePartner(data) {
    const c = await sb();
    if (data.id) return unwrap(await c.from('partners').update(data).eq('id', data.id).select().single());
    const { id, ...ins } = data; return unwrap(await c.from('partners').insert(ins).select().single());
  },
  async deletePartner(id) { const c = await sb(); unwrap(await c.from('partners').delete().eq('id', id)); },
};

/* ════════════════════════════════════════════════════════════ */
export const api = IS_DEMO ? DemoBackend : SupabaseBackend;
