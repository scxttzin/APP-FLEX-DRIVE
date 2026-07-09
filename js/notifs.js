/* ============================================================
   ESTADO DE LEITURA DAS NOTIFICAÇÕES (sino)
   ------------------------------------------------------------
   • Guarda no navegador quais notificações já foram vistas e quando.
   • Uma notificação vista fica "cinza"; 36h depois de vista, some da lista.
   • Vale para EMPRESA e MOTORISTA (chave separada por usuário).
   ============================================================ */

const EXPIRE_MS = 36 * 60 * 60 * 1000;        // 36h → notificação vista some da lista
const PURGE_MS = 30 * 24 * 60 * 60 * 1000;    // 30 dias → limpeza do armazenamento
const key = (userId) => `flexdrive_notif_read_${userId || 'anon'}`;

function loadMap(userId) {
  try { return JSON.parse(localStorage.getItem(key(userId)) || '{}'); } catch { return {}; }
}
function saveMap(userId, map) {
  try { localStorage.setItem(key(userId), JSON.stringify(map)); } catch (e) { /* quota — ignora */ }
}

/* marca uma notificação como vista (guarda o instante) */
export function markNotifRead(userId, id) {
  if (!id) return;
  const map = loadMap(userId);
  if (!map[id]) { map[id] = Date.now(); saveMap(userId, map); }
}

/* limpeza de armazenamento: só descarta leituras MUITO antigas (30 dias).
   NÃO usa o limite de 36h — senão o item some da lista e reaparece como novo. */
function prune(userId, map) {
  const now = Date.now(); let changed = false;
  for (const k of Object.keys(map)) { if (now - map[k] > PURGE_MS) { delete map[k]; changed = true; } }
  if (changed) saveMap(userId, map);
  return map;
}

/* Recebe a lista completa de itens (cada um com `id`) e devolve:
   • visible     → itens a exibir (some 36h após vistos)
   • unreadCount → quantos ainda não foram vistos
   Cada item ganha `read:true/false`. */
export function applyReadState(userId, items) {
  const map = prune(userId, loadMap(userId));
  const now = Date.now();
  const visible = [];
  for (const it of items) {
    const readAt = map[it.id];
    if (readAt && now - readAt > EXPIRE_MS) continue; // já expirou (some)
    visible.push({ ...it, read: !!readAt });
  }
  const unreadCount = visible.filter((i) => !i.read).length;
  return { visible, unreadCount };
}
