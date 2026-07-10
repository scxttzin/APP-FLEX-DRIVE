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

// O motorista tem carro elétrico? (muda respostas de recarga, manutenção e seguro)
const isEletrico = (ctx) => /byd|eletric|dolphin/.test(norm((ctx?.veiculo?.modelo || '')));

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
    kw: ['quanto devo', 'quanto pago', 'quanto vou pagar', 'quanto e a parcela', 'vencimento', 'vence', 'proximo pagamento', 'próxima parcela', 'pagar quando', 'quando vence', 'valor da parcela', 'quando é o pagamento'],
    resp: (ctx) => {
      if (ctx.proximoPagamento) {
        const p = ctx.proximoPagamento;
        const atras = p.situacao === 'atrasado';
        return {
          text: `É ${p.valor}, dia ${p.vencimento}${atras ? ' — e tá atrasadinho, tenta acertar quando puder 🙏' : '.'} Você paga na aba "Pagamentos".`,
          chips: ['Como pago?', 'Enviar comprovante'],
        };
      }
      return { text: 'Tá tudo em dia, nada pendente por aqui! ✅' };
    },
  },
  {
    id: 'como_pagar',
    kw: ['como pago', 'como pagar', 'pagar', 'forma de pagamento', 'pix', 'qr code', 'qr', 'copia e cola', 'chave pix', 'boleto', 'quando pago', 'dia do pagamento', 'que dia', 'sexta', 'sexta-feira', 'semanal', 'toda semana'],
    resp: () => ({
      text: 'É rapidinho: na aba "Pagamentos" tem o Pix (copia-e-cola ou QR). Você paga e anexa o comprovante ali mesmo. 💳',
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
    kw: ['atraso', 'atrasado', 'atrasei', 'posso atrasar', 'atrasar', 'juros', 'negociar', 'parcelar', 'divida', 'dívida', 'mora', 'multa de atraso', 'correcao', 'correção'],
    resp: (ctx) => ({
      text: `${ctx.pagamentosAtrasados ? 'Vi que tem um pagamento atrasado aí. ' : ''}Acontece! O ideal é acertar o quanto antes pela aba "Pagamentos" — o atraso vai gerando um acréscimo por dia. Se precisar de um prazo, me fala que eu chamo alguém do time. 🙏`,
      chips: ['Meu próximo pagamento', 'Falar com atendente'],
    }),
  },
  {
    id: 'contrato',
    kw: ['contrato', 'assinado', 'vigencia', 'vigência', 'renovar', 'renovacao', 'renovação', 'validade', 'prazo do contrato', 'quanto tempo', 'duracao', 'duração'],
    resp: (ctx) => ({
      text: `Seu contrato fica na aba "Seu contrato" — dá pra abrir e baixar por lá.${ctx.contrato ? ` Ele está ${ctx.contrato.situacao}${ctx.contrato.vigencia ? ` (${ctx.contrato.vigencia})` : ''}.` : ''} Precisa renovar? Também é por ali. 📄`,
    }),
  },
  {
    id: 'uso_permitido',
    kw: ['posso usar', 'uso do carro', 'para que posso usar', 'uso particular', 'uso pessoal', 'viajar', 'viagem', 'sair de brasilia', 'sair do df', 'fora do df', 'fora de brasilia', 'entorno', 'outro estado', 'outra cidade', 'goias', 'uber', '99', 'aplicativo', 'passageiros', 'levar familia', 'uso proprio'],
    resp: () => ({
      text: 'O carro é pra você trabalhar nos apps (Uber, 99 e afins), aqui no DF e entorno. Emprestar pra outra pessoa ou viajar pra fora não rola sem combinar antes. Se precisar de uma exceção, me fala que eu vejo com o time. 🚗',
      chips: ['Falar com atendente'],
    }),
  },
  {
    id: 'manutencao_local',
    kw: ['lugar de minha preferencia', 'lugar de minha preferência', 'local de minha preferencia', 'minha oficina', 'oficina propria', 'oficina própria', 'oficina de confianca', 'oficina de confiança', 'mecanico de confianca', 'onde eu quiser', 'outro lugar', 'outro local', 'levar em outro', 'local proprio', 'consertar por conta', 'posso escolher a oficina', 'qualquer oficina', 'levar em qualquer', 'qualquer lugar', 'qualquer mecanico'],
    resp: (ctx) => ({
      text: isEletrico(ctx)
        ? 'Melhor não. Como é um BYD elétrico, a manutenção precisa ser na autorizada BYD pra não perder a garantia. É só pedir pela aba "Manutenção" que a gente agenda. 🔧'
        : 'Melhor não levar por conta própria — a manutenção a gente faz numa oficina combinada. Pede pela aba "Manutenção" que resolvemos rapidinho. 🔧',
    }),
  },
  {
    id: 'compartilhar',
    kw: ['compartilhar', 'compartilho', 'compartilhamento', 'emprestar', 'emprestar o carro', 'outra pessoa dirigir', 'alguem dirigir', 'alguém dirigir', 'dividir o carro', 'sublocar', 'repassar o carro', 'outro motorista dirigir'],
    resp: () => ({
      text: 'O carro é sua responsabilidade, então não dá pra emprestar ou passar pra outra pessoa sem combinar antes com a gente. Se você precisa disso, me fala que eu vejo o que dá pra fazer. 🙂',
    }),
  },
  {
    id: 'manutencao',
    kw: ['manutencao', 'manutenção', 'revisao', 'revisão', 'quebrou', 'quebrado', 'defeito', 'problema', 'nao liga', 'não liga', 'nao pega', 'não pega', 'motor', 'barulho', 'pneu', 'freio', 'farol', 'luz do painel', 'vazamento', 'superaquec', 'oleo', 'óleo', 'consertar', 'conserto', 'quem paga a manutencao', 'de quem e a manutencao', 'troca de oleo', 'quantos km', 'a cada quantos'],
    resp: (ctx) => ({
      text: isEletrico(ctx)
        ? 'É só pedir pela aba "Manutenção" que a empresa agenda numa autorizada BYD. Se o carro parou, me avisa que já chamo o time. 🔧'
        : 'É só pedir pela aba "Manutenção" que a gente cuida do agendamento. Se for urgente (carro parado), me avisa que passo pra equipe na hora. 🔧',
      chips: ['É urgente', 'Como solicito?'],
    }),
  },
  {
    id: 'veiculo',
    kw: ['veiculo', 'veículo', 'carro', 'placa', 'modelo', 'documento do carro', 'crlv', 'licenciamento', 'dados do carro'],
    resp: (ctx) => ({
      text: `Os dados do seu veículo e os documentos (como o CRLV) ficam na aba "Veículo".${ctx.veiculo ? ` Seu carro: ${ctx.veiculo.modelo}${ctx.veiculo.placa ? `, placa ${ctx.veiculo.placa}` : ''}.` : ''} 🚗`,
    }),
  },
  {
    id: 'troca_veiculo',
    kw: ['trocar carro', 'troca de veiculo', 'troca de veículo', 'trocar veiculo', 'trocar de veiculo', 'outro carro', 'mudar de carro', 'solicitar troca'],
    resp: () => ({
      text: 'Para trocar de veículo, você precisa entrar em contato com o nosso time para verificar a disponibilidade. Havendo disponibilidade, possivelmente sim! Quer que eu te encaminhe para verificar?',
      escalate: true,
    }),
  },
  {
    id: 'documentos',
    kw: ['documento', 'documentos', 'segunda via', 'papel', 'anexo'],
    resp: () => ({
      text: 'Os documentos do seu carro ficam na aba "Veículo" e o contrato na aba "Seu contrato". Se precisar de algum documento que não está lá, me diga qual que eu verifico com a equipe. 📎',
    }),
  },
  {
    id: 'empresa',
    kw: ['flex drive', 'sobre a empresa', 'a empresa', 'vale a pena', 'como aluga', 'quero alugar', 'alugar', 'ser motorista', 'trabalhar com voces', 'locacao', 'locação', 'como comeco', 'como começo', 'como funciona a flex'],
    resp: () => ({
      text: 'A Flex Drive é uma locadora de veículos para motoristas: você aluga o carro e paga a locação por semana, usando o veículo para trabalhar no dia a dia. Tudo é acompanhado por aqui no app — pagamentos, contrato, veículo e manutenção. Quer saber de algum ponto específico? 🚗',
      chips: ['Como funcionam os pagamentos?', 'E o contrato?'],
    }),
  },
  {
    id: 'seguro',
    kw: ['seguro', 'sinistro', 'cobertura', 'franquia', 'segurado', 'proteção', 'protecao', 'assistencia 24h', 'assistência', 'roubaram o carro', 'furtaram'],
    resp: (ctx) => ({
      text: 'O carro tem seguro, mas enquanto ele está com você, você responde pelos danos, furto ou roubo. Se aconteceu alguma coisa, o melhor é me avisar agora que eu já te coloco em contato com o time pra resolver. 🙏',
      chips: ['Tive um acidente', 'Falar com atendente'],
    }),
  },
  {
    id: 'multa',
    kw: ['multa de transito', 'multa', 'infracao', 'infração', 'radar', 'multado', 'ponto na cnh', 'notificacao de transito', 'notificação', 'ipva', 'licenciamento', 'seguro obrigatorio', 'dpvat', 'quem paga a multa', 'condutor'],
    resp: () => ({
      text: 'As multas de trânsito ficam com quem estava dirigindo (você). Já IPVA e licenciamento são com a empresa. Recebeu uma notificação? Me manda que eu encaminho pro time cuidar da indicação do condutor. 📄',
      escalate: true,
    }),
  },
  {
    id: 'combustivel',
    kw: ['gasolina', 'combustivel', 'combustível', 'tanque', 'abastec', 'etanol', 'alcool', 'álcool', 'recarga', 'recarregar', 'recarrego', 'carregar', 'eletrico', 'elétrico', 'autonomia', 'ponto de recarga', 'eletroposto', 'estacao de recarga', 'onde carrego', 'onde recarrego', 'bateria', 'carregar o carro'],
    resp: (ctx) => ({
      text: isEletrico(ctx)
        ? 'A recarga fica por sua conta e você pode carregar onde preferir. Quando o Eletroposto Flex Drive estiver rolando, você ainda tem desconto. 🔌'
        : 'O abastecimento fica por sua conta, você abastece normalmente no dia a dia. ⛽',
    }),
  },
  {
    id: 'recarga_wallbox',
    kw: ['wallbox', 'wall box', 'carregador', 'carregador residencial', 'carregador em casa', 'instalar carregador', 'estacao em casa', 'comodato', 'carregador de parede'],
    resp: () => ({
      text: 'O Wallbox é aquele carregador que a gente empresta pra você carregar em casa, sem custo pela cessão. A instalação (com um eletricista) fica por sua conta, e ele fica sob sua responsabilidade enquanto estiver com você. Qualquer dúvida de instalação, me fala que eu chamo o time. 🔌🏠',
      chips: ['Falar com atendente'],
    }),
  },
  {
    id: 'multimidia',
    kw: ['multimidia', 'multimídia', 'central multimidia', 'tela do carro', 'na tela', 'tela multimidia', 'desbloquear', 'firmware', 'root', 'modificar o sistema', 'instalar aplicativo', 'instalar um app', 'instalar app', 'app na tela', 'software do carro', 'sistema do carro', 'atualizar o carro'],
    resp: () => ({
      text: 'Melhor não mexer no sistema da multimídia (desbloquear, instalar coisas, mudar firmware) — isso faz o carro perder a garantia. Se precisar de algo na central, pede pela aba "Manutenção" que a gente ajuda. 🙂',
    }),
  },
  {
    id: 'danos',
    kw: ['bati', 'bater', 'batida', 'danifiquei', 'risquei', 'risco no carro', 'amassei', 'amassado', 'estraguei', 'estragou', 'perda total', 'avaria', 'avariei', 'danos no carro', 'quem paga o conserto', 'quem paga o reparo', 'colidi', 'colisao', 'raspei', 'se eu bater'],
    resp: (ctx) => ({
      text: 'Enquanto o carro está com você, os danos ficam sob sua responsabilidade. Se bateu ou aconteceu algo, o melhor é me avisar agora que eu já te coloco em contato com o time pra resolver o conserto. 🙏',
      chips: ['Tive um acidente', 'Falar com atendente'],
    }),
  },
  {
    id: 'caucao',
    kw: ['caucao', 'caução', 'a caucao', 'de caucao', 'minha caucao', 'calcao', 'deposito', 'depósito', 'garantia em caucao', 'valor de garantia', 'valor de entrada', 'devolve o deposito', 'recebo a caucao de volta'],
    resp: () => ({
      text: 'A caução é uma garantia que fica com a gente no começo e volta pra você quando devolve o carro certinho, descontado o que houver. Quer que eu confirme o seu valor com o time? 💰',
    }),
  },
  {
    id: 'devolucao',
    kw: ['devolver o carro', 'devolucao', 'devolução', 'entregar o carro', 'fim do contrato', 'termino do contrato', 'atraso na devolucao', 'devolver atrasado', 'devolver depois', 'atrasar a devolucao', 'devolver', 'estado do carro', 'como devolvo', 'onde devolvo'],
    resp: (ctx) => ({
      text: 'Na hora de devolver, é só entregar o carro no mesmo estado que recebeu. Combina a data com a gente pra não ter atraso (que gera cobrança por dia). Quer que eu te ajude a agendar? 🚗',
      chips: ['Falar com atendente'],
    }),
  },
  {
    id: 'vistoria',
    kw: ['vistoria', 'video chamada', 'videochamada', 'chamada de video', 'verificacao semanal', 'inspecao', 'inspeção', 'mostrar o carro', 'apresentar o carro', 'checagem do carro'],
    resp: () => ({
      text: 'Toda semana a gente faz uma chamada de vídeo rapidinha só pra ver como o carro tá — nada demais. Só é importante não deixar de participar quando a gente combinar. 📹',
    }),
  },
  {
    id: 'rescisao',
    kw: ['rescisao', 'rescisão', 'rescindir', 'cancelar contrato', 'cancelar o contrato', 'cancelar meu contrato', 'como cancelo', 'cancelo meu contrato', 'encerrar', 'encerrar o contrato', 'encerrar contrato', 'sair do contrato', 'quero cancelar', 'desistir', 'terminar o contrato', 'quero devolver e sair', 'parar de alugar'],
    resp: () => ({
      text: 'Sem problema, dá pra encerrar sim — normalmente com um aviso de alguns dias e devolvendo o carro como recebeu. Você pode começar pelo botão "Encerrar Contrato" na aba "Seu contrato". Quer que eu chame o time pra combinar os detalhes?',
      escalate: true,
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
    const seen = new Set();
    const s = it.kw.reduce((acc, k) => {
      const nk = norm(k);
      if (seen.has(nk) || !t.includes(nk)) return acc;   // não conta variantes acentuadas/duplicadas duas vezes
      seen.add(nk); return acc + nk.length;
    }, 0);
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
