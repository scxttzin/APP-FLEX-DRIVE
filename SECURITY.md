# Segurança — Flex Drive App

Resumo do que protege o app hoje e o que a ofuscação faz (e não faz).

## 1. O que realmente protege os dados: RLS do Supabase

O app é **estático** (roda todo no navegador). Por isso, **nada no código do
cliente protege dado nenhum** — quem protege é o **RLS (Row Level Security)** do
Supabase, que roda no servidor e decide o que cada usuário pode ler/gravar.

**Status verificado:** requisições **sem login** a todas as tabelas retornam
**0 registros** (`profiles`, `payments`, `vehicles`, `contracts`,
`maintenances`, `contact_requests`, `documents`, `partners`, `app_settings`).
Ou seja, o RLS está ativo e não vaza dados para anônimos.

> **Regra de ouro:** qualquer tabela nova precisa de `enable row level security`
> + policies. Sem policy, ou vaza tudo, ou nada funciona.

### Chaves
- A chave que está no `js/config.js` é a **publishable/anon** — ela é **feita
  para ser pública**. Ela não dá acesso a nada além do que o RLS permitir.
- **Nunca** colocar no cliente: `service_role`, Personal Access Token (`sbp_…`)
  ou `ANTHROPIC_API_KEY`. A chave da IA fica só nas **Secrets da Edge Function**.

## 2. Content Security Policy (CSP)

`index.html` declara uma CSP que restringe as origens permitidas:

- `script-src`: só o próprio site + `esm.sh` (SDK do Supabase e o gerador de QR).
- `style-src`: próprio site + Google Fonts. `font-src`: `fonts.gstatic.com`.
- `img-src`: próprio site, `data:`, `blob:` e `*.supabase.co` (fotos/comprovantes).
- `connect-src`: próprio site, `esm.sh` e `*.supabase.co` (+ `wss:`).
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'` (anti-clickjacking), `upgrade-insecure-requests`.

Isso reduz o estrago de uma eventual injeção: mesmo que algo malicioso entre,
não consegue carregar script de fora nem mandar dados para outro domínio.

> `'unsafe-inline'` continua em `script-src` porque o app usa handlers inline
> (`onerror` nas fotos) e o script inline que registra o service worker.
> Para remover, seria preciso refatorar esses pontos.

## 3. Ofuscação — o que é e o que **não** é

Existe um build **opcional** que empacota tudo num arquivo só e ofusca:

```bash
npm install
npm run build      # gera dist/ com app.min.js ofuscado (js/ não é publicado)
```

Ou pelo GitHub: **Actions → "Publicar versão ofuscada" → Run workflow**
(antes, em **Settings → Pages → Source**, escolher **GitHub Actions**).

O que ele faz: nomes viram hexadecimal, textos são codificados em base64, o
fluxo é embaralhado, código morto é injetado, `console` é desabilitado e o
código se auto-defende contra reformatação.

### Seja realista sobre o limite disto

- **Não impede cópia.** O código roda no navegador do usuário; qualquer pessoa
  (ou IA) pode baixar, executar, ver as chamadas de rede e reconstruir o
  comportamento. Ofuscadores como este são **conhecidos e reversíveis** — existem
  desofuscadores prontos.
- **O que ele entrega de fato:** aumenta bastante o custo/atrito de ler e reusar
  o código casualmente. É um **dissuasor**, não uma proteção.
- **Custo:** deixa o JS maior e mais lento, dificulta depurar erros em produção
  e pode quebrar o app se alguma opção agressiva conflitar. Por isso o build é
  **manual/opt-in** e o deploy atual (código legível) continua funcionando.
- **Não protege dados.** Segredo nenhum fica seguro no cliente. Se algo precisa
  ser secreto, tem que viver no servidor (Edge Function + Secrets) e ser
  protegido por RLS.

## 4. Boas práticas já aplicadas no código

- Saída de dados do usuário passa por `escapeHtml()` antes de ir para `innerHTML`.
- Links externos vindos de dados passam por `safeUrl()` e usam
  `rel="noopener"`.
- Não há `eval()` nem `new Function()`.
- Service worker é **network-first** e só intercepta o próprio domínio (não toca
  em Supabase/fonts).

## 5. Checklist se for crescer

- [ ] Toda tabela nova com RLS + policies (e testar com a anon key, como no item 1).
- [ ] Buckets do Storage: privados por padrão; usar URL assinada (já é o caso de
      comprovantes/contratos/manutenção). O bucket `vehicles` é público de propósito.
- [ ] Domínio próprio + HTTPS (GitHub Pages já força HTTPS).
- [ ] Não versionar `.env`, tokens ou chaves de serviço.
