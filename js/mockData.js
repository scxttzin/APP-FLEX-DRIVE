/* ============================================================
   DADOS DE EXEMPLO (MODO DEMO)
   Semente carregada no navegador na primeira execução.
   ============================================================ */

// helpers de data relativos a hoje
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

export const SEED = {
  // contas de acesso (MODO DEMO) — no backend real isso vira o Supabase Auth
  users: [
    { id: 'u-empresa', email: 'empresa@flexdrive.com', password: 'flex123', role: 'empresa', full_name: 'Administração Flex Drive', phone: '5561999990000' },
    { id: 'u-joao',    email: 'joao@cliente.com',      password: 'cliente123', role: 'cliente', full_name: 'João da Silva',      phone: '5561988887777' },
  ],

  // clientes (papel cliente) — usados na visão da empresa
  clients: [
    { id: 'u-joao',  full_name: 'João da Silva',     email: 'joao@cliente.com',   phone: '5561988887777', cpf: '123.456.789-00', city: 'Brasília/DF', since: addDays(-120) },
    { id: 'u-maria', full_name: 'Maria Oliveira',    email: 'maria@cliente.com',  phone: '5561977776666', cpf: '987.654.321-00', city: 'Brasília/DF', since: addDays(-64) },
    { id: 'u-carlos',full_name: 'Carlos Mendes',     email: 'carlos@cliente.com', phone: '5561966665555', cpf: '456.789.123-00', city: 'Taguatinga/DF', since: addDays(-30) },
  ],

  vehicles: [
    { id: 'v-1', plate: 'RDF1A23', brand: 'BYD',        model: 'Dolphin Mini', year: 2024, color: 'Branco', renavam: '01234567890', km: 12450, status: 'locado',     client_id: 'u-joao',  weekly_value: 650, next_revision: addDays(22) },
    { id: 'v-2', plate: 'PQR2B34', brand: 'BYD',        model: 'Dolphin Plus', year: 2024, color: 'Cinza',  renavam: '11234567891', km: 8900,  status: 'locado',     client_id: 'u-maria', weekly_value: 720, next_revision: addDays(40) },
    { id: 'v-3', plate: 'STU3C45', brand: 'Volkswagen', model: 'Polo Track',   year: 2023, color: 'Prata',  renavam: '21234567892', km: 31200, status: 'locado',     client_id: 'u-carlos',weekly_value: 580, next_revision: addDays(8)  },
    { id: 'v-4', plate: 'VWX4D56', brand: 'BYD',        model: 'Dolphin Mini', year: 2024, color: 'Azul',   renavam: '31234567893', km: 4100,  status: 'disponivel', client_id: null,      weekly_value: 650, next_revision: addDays(55) },
    { id: 'v-5', plate: 'YZA5E67', brand: 'GWM',        model: 'Ora 03',       year: 2024, color: 'Branco', renavam: '41234567894', km: 15600, status: 'manutencao', client_id: null,      weekly_value: 700, next_revision: addDays(2)  },
    { id: 'v-6', plate: 'BCD6F78', brand: 'Volkswagen', model: 'Polo Track',   year: 2023, color: 'Preto',  renavam: '51234567895', km: 22000, status: 'disponivel', client_id: null,      weekly_value: 580, next_revision: addDays(60) },
  ],

  payments: [
    // João (v-1) — semanais
    { id: 'p-1', client_id: 'u-joao',  vehicle_id: 'v-1', amount: 650, due_date: addDays(-14), paid_date: addDays(-14), status: 'pago',     method: 'Pix' },
    { id: 'p-2', client_id: 'u-joao',  vehicle_id: 'v-1', amount: 650, due_date: addDays(-7),  paid_date: addDays(-6),  status: 'pago',     method: 'Pix' },
    { id: 'p-3', client_id: 'u-joao',  vehicle_id: 'v-1', amount: 650, due_date: addDays(2),   paid_date: null,         status: 'pendente', method: 'Pix' },
    { id: 'p-4', client_id: 'u-joao',  vehicle_id: 'v-1', amount: 650, due_date: addDays(9),   paid_date: null,         status: 'pendente', method: 'Pix' },
    // Maria (v-2)
    { id: 'p-5', client_id: 'u-maria', vehicle_id: 'v-2', amount: 720, due_date: addDays(-3),  paid_date: null,         status: 'atrasado', method: 'Cartão' },
    { id: 'p-6', client_id: 'u-maria', vehicle_id: 'v-2', amount: 720, due_date: addDays(4),   paid_date: null,         status: 'pendente', method: 'Cartão' },
    // Carlos (v-3)
    { id: 'p-7', client_id: 'u-carlos',vehicle_id: 'v-3', amount: 580, due_date: addDays(-1),  paid_date: addDays(-1),  status: 'pago',     method: 'Pix' },
    { id: 'p-8', client_id: 'u-carlos',vehicle_id: 'v-3', amount: 580, due_date: addDays(6),   paid_date: null,         status: 'pendente', method: 'Pix' },
  ],

  maintenances: [
    { id: 'm-1', vehicle_id: 'v-5', type: 'Revisão',       description: 'Revisão dos 15.000 km + alinhamento', cost: 480, scheduled_date: addDays(2),  done_date: null,        status: 'agendada' },
    { id: 'm-2', vehicle_id: 'v-3', type: 'Pneus',         description: 'Troca dos 2 pneus dianteiros',        cost: 1200,scheduled_date: addDays(8),  done_date: null,        status: 'agendada' },
    { id: 'm-3', vehicle_id: 'v-1', type: 'Higienização',  description: 'Limpeza interna completa',            cost: 150, scheduled_date: addDays(-10),done_date: addDays(-10),status: 'concluida' },
    { id: 'm-4', vehicle_id: 'v-2', type: 'Bateria',       description: 'Diagnóstico do sistema de carga',     cost: 0,   scheduled_date: addDays(-4), done_date: addDays(-3), status: 'concluida' },
    { id: 'm-5', vehicle_id: 'v-3', type: 'Pneus', category: 'desgaste', wear_type: 'pneus', requested_by: 'u-carlos', km: 31500, photo_path: null, description: 'Pneu dianteiro direito careca', cost: 0, scheduled_date: addDays(0), done_date: null, status: 'solicitada' },
  ],

  contracts: [
    { id: 'c-1', client_id: 'u-joao',  vehicle_id: 'v-1', title: 'Contrato de Locação — João da Silva',  signed_date: addDays(-120), start_date: addDays(-120), end_date: addDays(-4),  status: 'vigente', file_name: 'contrato-joao-silva.pdf',  file_url: null },
    { id: 'c-2', client_id: 'u-maria', vehicle_id: 'v-2', title: 'Contrato de Locação — Maria Oliveira', signed_date: addDays(-64),  start_date: addDays(-64),  end_date: addDays(116), status: 'vigente', file_name: 'contrato-maria-oliveira.pdf',file_url: null },
    { id: 'c-3', client_id: 'u-carlos',vehicle_id: 'v-3', title: 'Contrato de Locação — Carlos Mendes',  signed_date: addDays(-30),  start_date: addDays(-30),  end_date: addDays(150), status: 'vigente', file_name: 'contrato-carlos-mendes.pdf', file_url: null },
  ],

  documents: [
    { id: 'd-1', vehicle_id: 'v-1', client_id: 'u-joao',  type: 'CRLV',   title: 'CRLV 2025 — RDF1A23', file_name: 'crlv-rdf1a23.pdf', file_url: null },
    { id: 'd-2', vehicle_id: 'v-1', client_id: 'u-joao',  type: 'Seguro', title: 'Apólice de Seguro — RDF1A23', file_name: 'seguro-rdf1a23.pdf', file_url: null },
    { id: 'd-3', vehicle_id: 'v-2', client_id: 'u-maria', type: 'CRLV',   title: 'CRLV 2025 — PQR2B34', file_name: 'crlv-pqr2b34.pdf', file_url: null },
    { id: 'd-4', vehicle_id: 'v-3', client_id: 'u-carlos',type: 'CRLV',   title: 'CRLV 2025 — STU3C45', file_name: 'crlv-stu3c45.pdf', file_url: null },
  ],

  contact_requests: [
    { id: 'r-1', client_id: 'u-maria', subject: 'Dúvida sobre pagamento', message: 'Posso adiar o pagamento desta semana para sexta?', status: 'aberto', created_at: addDays(-1) },
  ],

  partners: [
    { id: 'pt-1', name: 'BYD Brasília', role: 'Concessionária', location: 'SIA Trecho 3, Brasília/DF', created_at: addDays(-60) },
    { id: 'pt-2', name: 'Auto Center do Zé', role: 'Mecânico', location: 'QNM 34, Taguatinga/DF', created_at: addDays(-45) },
    { id: 'pt-3', name: 'Pneus & Cia', role: 'Pneus e alinhamento', location: 'SOF Norte, Brasília/DF', created_at: addDays(-20) },
  ],
};
