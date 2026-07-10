/* ============================================================
   SERVICE WORKER — Flex Drive
   ------------------------------------------------------------
   Estratégia NETWORK-FIRST para arquivos do próprio app:
   • Online  → sempre baixa a versão mais nova (sem cache do navegador).
   • Offline → usa a última versão salva no cache como reserva.
   Assim o app se mantém sempre atualizado, sem precisar limpar cache
   nem versionar arquivo por arquivo. Requisições de outros domínios
   (ex.: Supabase, Google Fonts) NÃO são interceptadas.
   ============================================================ */
const CACHE = 'flexdrive-runtime-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // só GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // não mexe em Supabase/fonts/etc.

  e.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: 'no-store' }); // sempre da rede
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());                     // guarda p/ uso offline
      }
      return fresh;
    } catch (_err) {
      const cached = await caches.match(req);              // sem internet → reserva
      if (cached) return cached;
      throw _err;
    }
  })());
});
