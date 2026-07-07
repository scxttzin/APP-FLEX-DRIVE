/* ============================================================
   CONFIGURAÇÃO — FLEX DRIVE APP
   ------------------------------------------------------------
   Para ligar o BACKEND REAL (Supabase):
   1. Crie um projeto gratuito em https://supabase.com
   2. Em "Project Settings → API", copie a URL e a chave "anon public"
   3. Cole abaixo nos campos SUPABASE_URL e SUPABASE_ANON_KEY
   4. Rode o SQL de /supabase/schema.sql no SQL Editor do Supabase
   (passo a passo completo no arquivo SETUP.md)

   Enquanto os campos estiverem vazios, o app roda em MODO DEMO
   (dados de exemplo salvos no próprio navegador) para você testar.
   ============================================================ */

export const CONFIG = {
  SUPABASE_URL: 'https://uzyuzrkexdanwtnuiqzu.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_NafMjNO7XhcxLr1DUM7owg_CFliVvn1',

  // Contato exibido na Área do Cliente (botão "Falar com a empresa")
  EMPRESA: {
    nome: 'Flex Drive',
    whatsapp: '5561999999999',      // só números, com DDI 55
    email: 'contato@flexdrive.com.br',
    instagram: 'https://www.instagram.com/flexdrive/',  // ajuste para o @ real da Flex Drive
    site: 'https://scxttzin.github.io/WEBSITE-FLEX-DRIVE/',

    // PIX — usado na tela de pagamento do cliente (copia e cola + QR)
    pix: {
      chave: 'bc0eefe6-3c00-458b-8a61-423940ae9806',  // chave Pix aleatória da Flex Drive
      nome: 'Flex Drive Locadora',  // nome do recebedor (sem acentos, máx 25)
      cidade: 'Brasilia',           // cidade do recebedor (sem acentos, máx 15)
    },
  },

  // ASSISTENTE (chatbot) da aba "Falar com a empresa"
  CHATBOT: {
    nome: 'Flex App',
    papel: 'Assistente virtual',
    saudacao: 'Oi! 👋 Eu sou o Flex App, o assistente virtual da Flex Drive. Pode me perguntar o que quiser sobre pagamentos, contrato, seu veículo, manutenção, documentos ou a empresa — respondo aqui mesmo. Como posso ajudar?',

    // usarIA=false → o chat roda 100% no assistente LOCAL (dentro do navegador,
    // sem custo, sem servidor). É o modo recomendado para não pagar pela IA.
    // Se um dia quiser respostas livres com IA (Claude), basta pôr usarIA=true
    // e publicar a Edge Function abaixo (passo a passo no SETUP.md, Passo 6).
    usarIA: false,
    funcao: 'chat-assistant',   // nome da Edge Function do Supabase
  },
};

// MODO DEMO ativo automaticamente quando o Supabase não está configurado.
export const IS_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
