# APP FLEX DRIVE

Aplicativo de comunicação entre a **Flex Drive (empresa/locador)** e os **clientes (locatários)**.
Construído no mesmo visual do *WEBSITE FLEX DRIVE* — azul/branco/cinza, tema tecnologia, *liquid glass* e fonte Inter.

## O que ele faz

**🏢 Empresa — Dashboard interativo**
- Recebimentos de pagamentos dos clientes (lançar, marcar como recebido, status pago/pendente/atrasado).
- Manutenções dos veículos (agendar, concluir, custo acumulado).
- Veículos cadastrados, filtrados por **locados / disponíveis / em manutenção** (CRUD completo).
- Documentação: **upload rápido de contratos assinados** (arrastar e soltar) + documentos dos carros.

**👤 Cliente — Área do cliente**
- **Próximo pagamento da semana** em destaque + **calendário** com vencimentos/pagos/atrasados.
- Acesso rápido ao **contrato assinado** (abrir/baixar).
- **Dados do veículo** e documentação disponibilizada do carro.
- **Assistente virtual (chatbot)** na aba *Falar com a empresa*: o motorista tira dúvidas conversando (pagamento, contrato, veículo, manutenção, documentos) e só é transferido para o **WhatsApp comercial** quando o assistente não resolve. Usa **IA (Claude)** quando configurado; caso contrário, um assistente local baseado em conhecimento (funciona no Modo Demo, offline e sem custo).
- Também é possível **abrir um chamado** formal (formulário) + WhatsApp + e-mail.

## Tecnologia
- Frontend: HTML + CSS + JavaScript (módulos ES), **sem build**.
- Backend: **Supabase** (Auth + PostgreSQL + Storage). Funciona também em **Modo Demo** (dados no navegador) enquanto o Supabase não está configurado.

## Como rodar / configurar / hospedar
👉 Veja o **[SETUP.md](SETUP.md)** — passo a passo em português (incl. como hospedar junto ao site).

### Contas de teste (Modo Demo)
- 🏢 Empresa: `empresa@flexdrive.com` / `flex123`
- 👤 Cliente: `joao@cliente.com` / `cliente123`
