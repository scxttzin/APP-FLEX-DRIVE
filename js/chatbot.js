/* ============================================================
   ASSISTENTE (chatbot) — Falar com a empresa
   ------------------------------------------------------------
   Dois modos, transparentes para a interface:
   • IA real (Claude) via Edge Function `chat-assistant`, quando o
     Supabase está configurado e CONFIG.CHATBOT.usarIA = true.
   • Assistente local baseado em conhecimento (Modo Demo, offline,
     sem custo) — também serve de fallback se a IA falhar.

   Em ambos os casos, quando a dúvida não é resolvida, o assistente
   sinaliza `escalate: true` para transferir ao WhatsApp comercial.
   ============================================================ */
import { CONFIG, IS_DEMO } from './config.js';
import { getSupabase } from './supabaseClient.js';
import { fmt, paymentStatus, vigencia } from './ui.js';

/* Monta o contexto do motorista a partir dos dados já carregados. */
export function buildDriverContext({ user, vehicle, payments, contract }) {
  const pend = (payments || [])
    .filter((p) => paymentStatus(p) !== 'pago')
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const np = pend[0] || null;
  const atrasados = (payments || []).filter((p) => paymentStatus(p) === 'atrasado').length;

  const ctx = {
    nome: user?.full_name || user?.name || '',
    pagamentosAtrasados: atrasados,
  };
  if (np) {
    const st = paymentStatus(np);
    ctx.proximoPagamento = {
      valor: fmt.money(np.amount),
      vencimento: fmt.date(np.due_date),
      situacao: st === 'atrasado' ? 'atrasado' : 'em aberto',
    };
  }
  if (vehicle) {
    ctx.veiculo = {
      modelo: [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || vehicle.model || '',
      placa: vehicle.plate || '',
      km: vehicle.km ? fmt.km(vehicle.km) : '',
    };
    if (vehicle.weekly_value) ctx.valorSemanal = fmt.money(vehicle.weekly_value);
  }
  if (contract) {
    const v = vigencia(contract.end_date);
    ctx.contrato = { situacao: v.vencido ? 'vencido' : 'vigente', vigencia: v.texto };
  }
  return ctx;
}

/* ────────────────────────────────────────────────────────────
   ASSISTENTE LOCAL (base de conhecimento) — Modo Demo / fallback
   ──────────────────────────────────────────────────────────── */
const norm = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');   // remove acentos

// Cada intenção: gatilhos (palavras) + resposta(ctx). `chips` = respostas rápidas sugeridas.
const INTENCOES = [
  {
    id: 'saudacao',
    kw: ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'eai', 'e ai', 'tudo bem'],
    resp: () => ({
      text: 'Olá! 😊 Posso ajudar com pagamento, contrato, veículo, manutenção ou documentos. Qual é a sua dúvida?',
    }),
  },
  {
    id: 'proximo_pagamento',
    kw: ['quanto', 'devo', 'vencimento', 'vence', 'proximo pagamento', 'próxima', 'valor', 'pagar quando', 'data'],
    resp: (ctx) => {
      if (ctx.proximoPagamento) {
        const p = ctx.proximoPagamento;
        const atras = p.situacao === 'atrasado';
        return {
          text: `Seu próximo pagamento é de ${p.valor}, com vencimento em ${p.vencimento}${atras ? ' — e está em atraso ⚠️. Recomendo regularizar o quanto antes.' : '.'} Você paga direto pela aba "Pagamentos".`,
          chips: ['Como pago?', 'Enviar comprovante'],
        };
      }
      return { text: 'Você não tem pagamentos pendentes no momento. ✅ Tudo em dia por aqui!' };
    },
  },
  {
    id: 'como_pagar',
    kw: ['como pago', 'como pagar', 'pagar', 'forma de pagamento', 'pix', 'qr code', 'qr', 'copia e cola', 'chave pix', 'boleto'],
    resp: () => ({
      text: 'O pagamento é por Pix. Vá na aba "Pagamentos": lá tem o Pix copia-e-cola e o QR Code para pagar em segundos. Depois é só enviar o comprovante. 💳',
      chips: ['Enviar comprovante', 'Qual meu próximo pagamento?'],
    }),
  },
  {
    id: 'comprovante',
    kw: ['comprovante', 'ja paguei', 'já paguei', 'paguei', 'avisar pagamento', 'confirmar pagamento'],
    resp: () => ({
      text: 'Perfeito! Depois de pagar, na aba "Pagamentos" você marca como pago e pode avisar a empresa pelo WhatsApp com o comprovante. Assim confirmamos rapidinho. 👍',
    }),
  },
  {
    id: 'atraso',
    kw: ['atraso', 'atrasado', 'atrasei', 'juros', 'negociar', 'parcelar', 'divida', 'dívida'],
    resp: (ctx) => ({
      text: `${ctx.pagamentosAtrasados ? 'Vi que há pagamento em atraso. ' : ''}Para regularizar, use a aba "Pagamentos". Para combinar prazo ou negociar valores, vou te encaminhar para nossa equipe, tudo bem?`,
      escalate: true,
    }),
  },
  {
    id: 'contrato',
    kw: ['contrato', 'assinado', 'vigencia', 'vigência', 'renovar', 'renovacao', 'renovação', 'validade'],
    resp: (ctx) => ({
      text: `Seu contrato assinado fica na aba "Contrato" — dá para abrir e baixar por lá.${ctx.contrato ? ` Situação atual: ${ctx.contrato.situacao}${ctx.contrato.vigencia ? ` (${ctx.contrato.vigencia})` : ''}.` : ''} A renovação também pode ser solicitada nessa aba. 📄`,
    }),
  },
  {
    id: 'manutencao',
    kw: ['manutencao', 'manutenção', 'oficina', 'revisao', 'revisão', 'quebrou', 'quebrado', 'defeito', 'problema', 'nao liga', 'não liga', 'nao pega', 'não pega', 'motor', 'barulho', 'pneu', 'freio', 'bateria', 'farol', 'luz do painel', 'vazamento', 'superaquec', 'oleo', 'óleo', 'consertar', 'conserto'],
    resp: () => ({
      text: 'Para manutenção, use a aba "Manutenção" do app: você solicita o serviço e a gente cuida do agendamento. Se for uma emergência (carro parado), me avise que já te passo para a equipe. 🔧',
      chips: ['É urgente', 'Como solicito?'],
    }),
  },
  {
    id: 'veiculo',
    kw: ['veiculo', 'veículo', 'carro', 'meu carro', 'placa', 'modelo', 'documento do carro', 'crlv', 'licenciamento', 'dados do carro'],
    resp: (ctx) => ({
      text: `Os dados do seu veículo e os documentos (como o CRLV) ficam na aba "Meu Veículo".${ctx.veiculo ? ` Seu carro: ${ctx.veiculo.modelo}${ctx.veiculo.placa ? `, placa ${ctx.veiculo.placa}` : ''}.` : ''} 🚗`,
    }),
  },
  {
    id: 'troca_veiculo',
    kw: ['trocar carro', 'troca de veiculo', 'trocar veiculo', 'outro carro', 'mudar de carro'],
    resp: () => ({
      text: 'A troca de veículo pode ser avaliada pela nossa equipe. Quer que eu já te encaminhe para tratarmos os detalhes?',
      escalate: true,
    }),
  },
  {
    id: 'documentos',
    kw: ['documento', 'documentos', 'segunda via', 'papel', 'anexo'],
    resp: () => ({
      text: 'Os documentos do seu carro ficam na aba "Meu Veículo" e o contrato na aba "Contrato". Se precisar de algum documento que não está lá, me diga qual que eu verifico com a equipe. 📎',
    }),
  },
  {
    id: 'empresa',
    kw: ['flex drive', 'como funciona', 'o que e', 'o que é', 'sobre a empresa', 'empresa', 'vale a pena', 'como aluga', 'quero alugar', 'alugar', 'ser motorista', 'trabalhar com voces', 'locacao', 'locação', 'como comeco', 'como começo'],
    resp: () => ({
      text: 'A Flex Drive é uma locadora de veículos para motoristas: você aluga o carro e paga a locação por semana, usando o veículo para trabalhar no dia a dia. Tudo é acompanhado por aqui no app — pagamentos, contrato, veículo e manutenção. Quer saber de algum ponto específico? 🚗',
      chips: ['Como funcionam os pagamentos?', 'E o contrato?'],
    }),
  },
  {
    id: 'seguro',
    kw: ['seguro', 'sinistro', 'cobertura', 'franquia', 'segurado', 'proteção', 'protecao', 'assistencia 24h', 'assistência'],
    resp: () => ({
      text: 'Coberturas, seguro e assistência dependem do que está no seu contrato. Posso te dar a orientação geral, mas para confirmar os detalhes e valores da sua proteção o melhor é falar com a equipe. Quer que eu te encaminhe?',
      escalate: true,
    }),
  },
  {
    id: 'multa',
    kw: ['multa', 'infracao', 'infração', 'radar', 'multado', 'ponto na cnh', 'notificacao de transito', 'notificação'],
    resp: () => ({
      text: 'Multas de trânsito são de responsabilidade de quem estava dirigindo. Se você recebeu uma notificação ligada ao veículo, me avise que encaminho para a equipe tratar a indicação do condutor e os próximos passos. 📄',
      escalate: true,
    }),
  },
  {
    id: 'combustivel',
    kw: ['gasolina', 'combustivel', 'combustível', 'tanque', 'abastec', 'etanol', 'alcool', 'álcool', 'recarga', 'carregar', 'eletrico', 'elétrico', 'bateria do carro', 'autonomia'],
    resp: () => ({
      text: 'O abastecimento/recarga fica por conta do motorista durante o uso do carro. Se o seu veículo for elétrico, a recarga é como abastecer: você faz no dia a dia. Dúvidas específicas do seu modelo eu confirmo com a equipe. ⛽🔌',
    }),
  },
  {
    id: 'acesso',
    kw: ['senha', 'login', 'entrar', 'acesso', 'esqueci a senha', 'trocar senha', 'primeiro acesso', 'nao consigo entrar', 'não consigo entrar'],
    resp: () => ({
      text: 'No primeiro acesso o app pede para você criar uma senha nova. Se esqueceu a senha ou não consegue entrar, me diga que peço para a equipe redefinir seu acesso. 🔐',
      chips: ['Falar com atendente'],
    }),
  },
  {
    id: 'horario',
    kw: ['horario', 'horário', 'funcionamento', 'que horas', 'aberto', 'atende', 'fim de semana', 'domingo', 'feriado'],
    resp: () => ({
      text: 'O app fica disponível 24h para você ver pagamentos, contrato e veículo. O atendimento humano (WhatsApp e e-mail) responde em horário comercial. Posso adiantar sua dúvida por aqui mesmo — o que você precisa? 🕘',
    }),
  },
  {
    id: 'emergencia',
    kw: ['acidente', 'batida', 'roubo', 'roubado', 'furto', 'guincho', 'pane', 'parado', 'urgente', 'emergencia', 'emergência'],
    resp: () => ({
      text: 'Sinto muito por isso. 🙏 Esse caso precisa de atendimento imediato da nossa equipe — vou te transferir agora para o WhatsApp comercial.',
      escalate: true,
    }),
  },
  {
    id: 'humano',
    kw: ['atendente', 'humano', 'pessoa', 'falar com alguem', 'falar com alguém', 'suporte', 'atendimento', 'gerente', 'reclamacao', 'reclamação', 'whatsapp'],
    resp: () => ({
      text: 'Claro! Vou te encaminhar para um atendente da Flex Drive no WhatsApp comercial. 📱',
      escalate: true,
    }),
  },
  {
    id: 'agradecimento',
    kw: ['obrigado', 'obrigada', 'valeu', 'vlw', 'agradecido', 'perfeito', 'show', 'resolvido'],
    resp: () => ({
      text: 'Disponha! 😄 Se precisar de mais alguma coisa, é só chamar. Boa estrada! 🚗',
    }),
  },
];

// Pontua por especificidade: soma o tamanho dos gatilhos encontrados, de modo
// que palavras específicas (ex.: "seguro") vençam genéricas (ex.: "carro").
function respostaLocal(text, ctx) {
  const t = norm(text);
  let melhor = null; let score = 0;
  for (const it of INTENCOES) {
    const s = it.kw.reduce((acc, k) => { const nk = norm(k); return acc + (t.includes(nk) ? nk.length : 0); }, 0);
    if (s > score) { score = s; melhor = it; }
  }
  if (melhor && score > 0) {
    const r = melhor.resp(ctx);
    return { reply: r.text, escalate: !!r.escalate, chips: r.chips || [] };
  }
  // Sem correspondência clara: resposta aberta e útil (não um beco sem saída).
  return {
    reply: 'Boa pergunta! 🤔 Consigo te ajudar com pagamentos, contrato, seu veículo, manutenção, documentos e como funciona a Flex Drive. Me conta um pouco mais sobre o que você precisa que eu te oriento — ou, se preferir, falo com um atendente pra você.',
    escalate: false,
    chips: ['Meu próximo pagamento', 'Como funciona a Flex Drive?', 'Falar com atendente'],
  };
}

/* ────────────────────────────────────────────────────────────
   API única usada pela interface
   ──────────────────────────────────────────────────────────── */
export function assistantMode() {
  return (!IS_DEMO && CONFIG.CHATBOT?.usarIA) ? 'ia' : 'local';
}

// history: [{ role:'user'|'assistant', content }]  (inclui a última msg do motorista)
export async function askAssistant({ history, context }) {
  const last = [...history].reverse().find((m) => m.role === 'user');
  const localAnswer = () => respostaLocal(last?.content || '', context);

  if (assistantMode() === 'ia') {
    try {
      const sb = await getSupabase();
      const { data, error } = await sb.functions.invoke(CONFIG.CHATBOT.funcao, {
        body: { messages: history, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.reply) return { reply: data.reply, escalate: !!data.escalate, chips: [] };
      throw new Error('resposta vazia');
    } catch (e) {
      // Fallback silencioso para o assistente local (mantém o atendimento funcionando).
      console.warn('[chat] IA indisponível, usando assistente local:', e?.message || e);
      return localAnswer();
    }
  }
  return localAnswer();
}

/* Link de WhatsApp com contexto pré-preenchido para o handoff. */
export function whatsappHandoffUrl(context, lastUserMsg) {
  const nome = context?.nome ? ` Sou ${context.nome}.` : '';
  const assunto = lastUserMsg ? ` Preciso de ajuda com: "${String(lastUserMsg).slice(0, 160)}".` : ' Preciso de ajuda.';
  const msg = `Olá, Flex Drive!${nome}${assunto} (falei antes com o assistente do app)`;
  return `https://wa.me/${CONFIG.EMPRESA.whatsapp}?text=${encodeURIComponent(msg)}`;
}
