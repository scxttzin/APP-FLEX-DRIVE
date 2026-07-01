# 🚗 APP FLEX DRIVE — Guia de Configuração

App de comunicação entre a **Flex Drive (empresa)** e os **clientes (locatários)**.
Mesmo visual do site (azul/branco/cinza, tema tecnologia, *liquid glass*).

- **Empresa** → Dashboard interativo: recebimentos, manutenções, veículos, documentação.
- **Cliente** → Área do cliente: próximo pagamento, calendário, veículo, contrato e contato.

---

## ▶️ 1. Testar agora (Modo Demo)

O app já funciona **sem instalar nada**, com dados de exemplo salvos no navegador.

1. Abra a pasta `APP FLEX DRIVE`.
2. Como o app usa módulos, ele precisa de um servidorzinho local. Escolha **uma** opção:
   - **VS Code:** instale a extensão *Live Server* → clique direito em `index.html` → *Open with Live Server*.
   - **Terminal (Node):** dentro da pasta rode `npx serve` e abra o endereço mostrado.
   - **Terminal (Python):** rode `python -m http.server 4321` e abra `http://localhost:4321`.
3. Entre com uma das contas de teste:

| Perfil  | E-mail                  | Senha       |
|---------|-------------------------|-------------|
| 🏢 Empresa | `empresa@flexdrive.com` | `flex123`     |
| 👤 Cliente | `joao@cliente.com`      | `cliente123`  |

> No Modo Demo os dados ficam só no seu navegador. Para multiusuário real e permanente, siga a parte 2.

---

## 🔌 2. Ligar o Backend Real (Supabase) — grátis

O Supabase dá **login de verdade + banco de dados + armazenamento de PDFs**, tudo no plano gratuito.

### Passo 1 — Criar o projeto
1. Acesse **https://supabase.com** e crie uma conta (pode usar o Google).
2. **New project** → dê um nome (ex.: `flexdrive`), escolha uma senha do banco e a região **South America (São Paulo)**.
3. Aguarde ~2 min até o projeto ficar pronto.

### Passo 2 — Criar as tabelas e a segurança
1. No menu lateral: **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/schema.sql` (desta pasta), copie **todo** o conteúdo e cole no editor.
3. Clique **Run**. Deve aparecer *Success*. Isso cria tabelas, regras de acesso e os buckets de arquivos.

### Passo 3 — Pegar as chaves de conexão
1. Menu lateral: **Project Settings** (engrenagem) → **API**.
2. Copie dois valores:
   - **Project URL** (ex.: `https://abcd1234.supabase.co`)
   - **anon public** (uma chave longa começando com `eyJ...`)
3. Abra o arquivo `js/config.js` e cole nos campos:
   ```js
   SUPABASE_URL: 'https://abcd1234.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...sua-chave...',
   ```
   > Assim que esses campos forem preenchidos, o app **sai do Modo Demo** sozinho e passa a usar o Supabase.
4. Ainda no `config.js`, ajuste o WhatsApp e e-mail reais da empresa (campo `EMPRESA`).

### Passo 4 — Criar os usuários (empresa e clientes)
1. Menu lateral: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Crie o usuário da **empresa**: e-mail e senha à sua escolha.
   - Em **User Metadata** (ou *Raw user meta data*) coloque:
     ```json
     { "role": "empresa", "full_name": "Administração Flex Drive" }
     ```
3. Crie cada **cliente** da mesma forma, usando `"role": "cliente"` e o nome do cliente.
   > O perfil é criado automaticamente no banco (há um gatilho no schema). Se preferir, dá pra cadastrar/editar clientes depois pela própria tela da Empresa.
4. Pronto! Faça login no app com esses e-mails/senhas.

### Passo 5 (opcional) — Dados de exemplo
Quer começar com veículos de exemplo? Abra `supabase/seed.sql`, siga o comentário no topo
(troque os IDs pelos dos seus clientes) e rode no **SQL Editor**. Ou simplesmente cadastre tudo pela tela da Empresa.

---

## 🌐 3. Publicar no GitHub (repositório novo e separado)

A decisão é manter o app em um **repositório próprio** (separado do repo do site), com seu próprio GitHub Pages.

1. No GitHub, crie um repositório novo, ex.: **`APP-FLEX-DRIVE`** (público).
2. Dentro da pasta `APP FLEX DRIVE`, suba os arquivos:
   ```bash
   git init
   git add .
   git commit -m "App Flex Drive"
   git branch -M main
   git remote add origin https://github.com/scxttzin/APP-FLEX-DRIVE.git
   git push -u origin main
   ```
3. No repositório: **Settings → Pages → Branch: `main` / root → Save**.
4. Em ~1 min o app fica disponível em:
   **`https://scxttzin.github.io/APP-FLEX-DRIVE/`**
5. No site (WEBSITE FLEX DRIVE), crie um botão **"Acessar o App / Login"** apontando para esse endereço.

> Alternativas igualmente fáceis: **Netlify** ou **Vercel** (arraste a pasta e pronto), ou um subdomínio
> como `app.flexdrive.com.br`. Em qualquer uma, basta servir os arquivos estáticos — não há build.

---

## 🔒 Observações de segurança
- A chave **anon** pode ficar no código do app (ela é pública por design). Quem protege os dados são as
  regras de **RLS** já incluídas no `schema.sql` — cada cliente só enxerga o que é dele.
- **Nunca** use a chave `service_role` no app/navegador.
- Os arquivos (contratos/documentos) ficam em buckets **privados**; o app gera links temporários (1h) para abrir.

---

## 🗂️ Estrutura do projeto
```
APP FLEX DRIVE/
├─ index.html            ← abre aqui
├─ css/app.css           ← design herdado do site
├─ js/
│  ├─ config.js          ← COLE AQUI as chaves do Supabase
│  ├─ app.js             ← entrada (login → empresa/cliente)
│  ├─ api.js             ← camada de dados (demo ↔ Supabase)
│  ├─ ui.js              ← ícones, formatação BR, modais, toasts
│  ├─ mockData.js        ← dados de exemplo do Modo Demo
│  └─ views/             ← telas (login, empresa, cliente, shell)
├─ assets/               ← logo e imagens
└─ supabase/
   ├─ schema.sql         ← rode no Supabase (tabelas + segurança)
   └─ seed.sql           ← dados de exemplo (opcional)
```

Dúvidas ou próximos passos (notificações, app instalável/PWA, relatórios em PDF)? É só pedir. 🚀
