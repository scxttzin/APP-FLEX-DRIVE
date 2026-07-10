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
          text: `Seu próximo pagamento é de ${p.valor}, com vencimento em ${p.vencimento}${atras ? ' — e está em atraso ⚠️. Recomendo regularizar o quanto antes.' : '.'} Você paga direto pela aba "Pagamentos".`,
          chips: ['Como pago?', 'Enviar comprovante'],
        };
      }
      return { text: 'Você não tem pagamentos pendentes no momento. ✅ Tudo em dia por aqui!' };
    },
  },
  {
    id: 'como_pagar',
    kw: ['como pago', 'como pagar', 'pagar', 'forma de pagamento', 'pix', 'qr code', 'qr', 'copia e cola', 'chave pix', 'boleto', 'quando pago', 'dia do pagamento', 'que dia', 'sexta', 'sexta-feira', 'semanal', 'toda semana'],
    resp: () => ({
      text: 'O pagamento é semanal, feito por Pix — pelo contrato, o vencimento é toda sexta-feira. Vá na aba "Pagamentos": lá tem o Pix copia-e-cola e o QR Code para pagar em segundos. Depois é só enviar o comprovante. 💳',
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
      text: `${ctx.pagamentosAtrasados ? 'Vi que há pagamento em atraso. ' : ''}O ideal é manter tudo em dia (aba "Pagamentos"). Pelo contrato, o atraso no pagamento semanal gera multa de mora e juros de 1% ao mês${isEletrico(ctx) ? ' (no contrato do elétrico, a multa é de 10%)' : ' (multa de mora conforme seu contrato)'}, além de correção — e o Pix gerado no app já vem com o valor de atraso embutido. Acúmulo de pendências pode levar à revisão/rescisão do contrato. Para negociar prazo ou valores, posso te encaminhar para a equipe.`,
      chips: ['Meu próximo pagamento', 'Falar com atendente'],
    }),
  },
  {
    id: 'contrato',
    kw: ['contrato', 'assinado', 'vigencia', 'vigência', 'renovar', 'renovacao', 'renovação', 'validade', 'prazo do contrato', 'quanto tempo', 'duracao', 'duração'],
    resp: (ctx) => ({
      text: `Seu contrato assinado fica na aba "Seu contrato" — dá para abrir e baixar por lá.${ctx.contrato ? ` Situação atual: ${ctx.contrato.situacao}${ctx.contrato.vigencia ? ` (${ctx.contrato.vigencia})` : ''}.` : ''} A locação é por prazo determinado e pode ser renovada por acordo entre as partes (a renovação também é solicitada nessa aba). Ao final, o veículo deve ser devolvido no mesmo estado em que foi recebido. 📄`,
    }),
  },
  {
    id: 'uso_permitido',
    kw: ['posso usar', 'uso do carro', 'para que posso usar', 'uso particular', 'uso pessoal', 'viajar', 'viagem', 'sair de brasilia', 'sair do df', 'fora do df', 'fora de brasilia', 'entorno', 'outro estado', 'outra cidade', 'goias', 'uber', '99', 'aplicativo', 'passageiros', 'levar familia', 'uso proprio'],
    resp: () => ({
      text: 'O veículo é para uso profissional em transporte de passageiros por aplicativos (Uber, 99 e similares). Pelo contrato, é proibido usar para outra finalidade, permitir que terceiros não autorizados dirijam, e circular além do Distrito Federal e entorno — o descumprimento gera multa e pode levar à rescisão do contrato. Se precisar de uma exceção (ex.: uma viagem), fale com a equipe antes. 🚗',
      chips: ['Falar com atendente'],
    }),
  },
  {
    id: 'manutencao_local',
    kw: ['lugar de minha preferencia', 'lugar de minha preferência', 'local de minha preferencia', 'minha oficina', 'oficina propria', 'oficina própria', 'oficina de confianca', 'oficina de confiança', 'mecanico de confianca', 'onde eu quiser', 'outro lugar', 'outro local', 'levar em outro', 'local proprio', 'consertar por conta', 'posso escolher a oficina', 'qualquer oficina', 'levar em qualquer', 'qualquer lugar', 'qualquer mecanico'],
    resp: (ctx) => ({
      text: isEletrico(ctx)
        ? 'Não. Por ser um veículo elétrico BYD, a manutenção precisa ser feita obrigatoriamente em concessionária ou oficina autorizada BYD, para preservar a garantia de fábrica. Não leve a qualquer outro local por conta própria — solicite pela aba "Manutenção" que a empresa agenda. 🔧⚡'
        : 'Não. Reparos e manutenções são feitos apenas em local aprovado pela empresa (oficina de confiança do locador). Levar o veículo para outro lugar por conta própria pode gerar multa e rescisão. Quando precisar, solicite pela aba "Manutenção" que a empresa indica o local. 🔧',
    }),
  },
  {
    id: 'compartilhar',
    kw: ['compartilhar', 'compartilho', 'compartilhamento', 'emprestar', 'emprestar o carro', 'outra pessoa dirigir', 'alguem dirigir', 'alguém dirigir', 'dividir o carro', 'sublocar', 'repassar o carro', 'outro motorista dirigir'],
    resp: () => ({
      text: 'Se não foi previamente acordado em contrato com a empresa, é totalmente proibido compartilhar o veículo. O carro é de sua responsabilidade — repassar a terceiros pode gerar multa e rescisão contratual. Se precisar dessa possibilidade, fale com a equipe para avaliar. 🚫',
    }),
  },
  {
    id: 'manutencao',
    kw: ['manutencao', 'manutenção', 'revisao', 'revisão', 'quebrou', 'quebrado', 'defeito', 'problema', 'nao liga', 'não liga', 'nao pega', 'não pega', 'motor', 'barulho', 'pneu', 'freio', 'farol', 'luz do painel', 'vazamento', 'superaquec', 'oleo', 'óleo', 'consertar', 'conserto', 'quem paga a manutencao', 'de quem e a manutencao', 'troca de oleo', 'quantos km', 'a cada quantos'],
    resp: (ctx) => ({
      text: isEletrico(ctx)
        ? 'Para manutenção, use a aba "Manutenção" do app — você solicita e a empresa agenda. No elétrico BYD, a manutenção preventiva/corretiva é responsabilidade da empresa e feita em concessionária/oficina autorizada BYD. Você deve seguir os intervalos de revisão do fabricante e cuidar da bateria de tração, do sistema de recarga, pneus e da frenagem regenerativa. Se o carro parar, me avise que passo para a equipe. 🔧⚡'
        : 'Para manutenção, use a aba "Manutenção" do app — você solicita e a empresa cuida do agendamento em oficina de confiança do locador. Pelo contrato do carro a combustão, o custo da manutenção preventiva/corretiva é dividido igualmente (50/50) entre você e a empresa, e a revisão é obrigatória a cada 10.000 km. Se for emergência (carro parado), me avise que já te passo para a equipe. 🔧',
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
      text: `O veículo tem seguro total (danos, furto e roubo) mantido pela empresa. Mesmo assim, pelo contrato você é responsável pelo veículo durante toda a locação (da retirada até a devolução). Em caso de sinistro, você pode: (1) pagar a franquia integral para a seguradora consertar${isEletrico(ctx) ? ' em concessionária/oficina autorizada BYD' : ''}; ou (2) arcar com o reparo em oficina aprovada pela empresa. Também há os lucros cessantes pelo tempo que o carro ficar parado. Se acabou de acontecer algo, me avise que passo para a equipe agora.`,
      chips: ['Tive um acidente', 'Falar com atendente'],
    }),
  },
  {
    id: 'multa',
    kw: ['multa de transito', 'multa', 'infracao', 'infração', 'radar', 'multado', 'ponto na cnh', 'notificacao de transito', 'notificação', 'ipva', 'licenciamento', 'seguro obrigatorio', 'dpvat', 'quem paga a multa', 'condutor'],
    resp: () => ({
      text: 'Multas de trânsito e encargos ligados ao uso são de responsabilidade do motorista (quem estava dirigindo). Já IPVA, seguro obrigatório e licenciamento anual ficam com a empresa. Atenção: acumular 3 multas de trânsito vencidas sem pagamento pode rescindir o contrato automaticamente. Recebeu uma notificação? Me avise que encaminho para a equipe tratar a indicação do condutor. 📄',
      escalate: true,
    }),
  },
  {
    id: 'combustivel',
    kw: ['gasolina', 'combustivel', 'combustível', 'tanque', 'abastec', 'etanol', 'alcool', 'álcool', 'recarga', 'recarregar', 'recarrego', 'carregar', 'eletrico', 'elétrico', 'autonomia', 'ponto de recarga', 'eletroposto', 'estacao de recarga', 'onde carrego', 'onde recarrego', 'bateria', 'carregar o carro'],
    resp: (ctx) => ({
      text: isEletrico(ctx)
        ? 'A recarga fica por sua conta no dia a dia. Você tem liberdade para recarregar em qualquer ponto público ou privado — não é obrigatório usar o Eletroposto Flex Drive, mas, quando ele estiver disponível, locatários têm desconto especial na recarga. Importante: evite carregadores não certificados / fora das especificações da BYD. 🔌'
        : 'O abastecimento fica por conta do motorista durante o uso do carro — você abastece no dia a dia normalmente. ⛽',
    }),
  },
  {
    id: 'recarga_wallbox',
    kw: ['wallbox', 'wall box', 'carregador', 'carregador residencial', 'carregador em casa', 'instalar carregador', 'estacao em casa', 'comodato', 'carregador de parede'],
    resp: () => ({
      text: 'O carregador Wallbox é cedido em comodato (empréstimo gratuito) só para recarregar o seu elétrico. A cessão é gratuita, mas a instalação e os custos elétricos são por sua conta — precisa de eletricista habilitado, seguindo as normas (NBR 5410). Você é responsável pela guarda e conservação; em caso de dano, furto ou perda, há ressarcimento. Na devolução (com atraso há multa por dia), você desinstala por sua conta; ao final do prazo, também é possível comprar o equipamento por R$2.500. Dúvidas de instalação, fale com a equipe. 🔌🏠',
      chips: ['Falar com atendente'],
    }),
  },
  {
    id: 'multimidia',
    kw: ['multimidia', 'multimídia', 'central multimidia', 'tela do carro', 'na tela', 'tela multimidia', 'desbloquear', 'firmware', 'root', 'modificar o sistema', 'instalar aplicativo', 'instalar um app', 'instalar app', 'app na tela', 'software do carro', 'sistema do carro', 'atualizar o carro'],
    resp: () => ({
      text: 'No elétrico BYD é proibido descaracterizar, desbloquear, modificar, alterar o firmware ou instalar softwares não homologados no sistema multimídia — isso faz o carro perder a garantia de fábrica. O descumprimento pode rescindir o contrato de imediato, com multa de R$2.000,00 e ressarcimento dos prejuízos. Precisa de algo na central? Solicite pela aba "Manutenção". ⚠️',
    }),
  },
  {
    id: 'danos',
    kw: ['bati', 'bater', 'batida', 'danifiquei', 'risquei', 'risco no carro', 'amassei', 'amassado', 'estraguei', 'estragou', 'perda total', 'avaria', 'avariei', 'danos no carro', 'quem paga o conserto', 'quem paga o reparo', 'colidi', 'colisao', 'raspei', 'se eu bater'],
    resp: (ctx) => ({
      text: `Pelo contrato, você assume a responsabilidade por danos, avarias, furto ou roubo do veículo durante toda a locação — inclusive por caso fortuito ou força maior. Em caso de dano, você arca com o reparo (ou, em perda total, com o valor de mercado/FIPE do carro) e ainda com os lucros cessantes pelo tempo que o carro ficar parado. Havendo seguro, você paga a franquia para o conserto${isEletrico(ctx) ? ' — e no elétrico isso inclui danos à bateria de tração e ao sistema elétrico de alta tensão' : ''}. Se acabou de acontecer, me avise que já passo para a equipe.`,
      chips: ['Tive um acidente', 'Falar com atendente'],
    }),
  },
  {
    id: 'caucao',
    kw: ['caucao', 'caução', 'a caucao', 'de caucao', 'minha caucao', 'calcao', 'deposito', 'depósito', 'garantia em caucao', 'valor de garantia', 'valor de entrada', 'devolve o deposito', 'recebo a caucao de volta'],
    resp: () => ({
      text: 'No início da locação é dada uma caução (garantia) — o valor está no seu contrato (por exemplo, R$1.600 no plano a combustão e R$2.200 no elétrico). Ela serve de garantia e é restituída quando você devolve o veículo nas condições contratadas; o saldo (descontado o que houver) é apurado em até 40 dias. 💰',
    }),
  },
  {
    id: 'devolucao',
    kw: ['devolver o carro', 'devolucao', 'devolução', 'entregar o carro', 'fim do contrato', 'termino do contrato', 'atraso na devolucao', 'devolver atrasado', 'devolver depois', 'atrasar a devolucao', 'devolver', 'estado do carro', 'como devolvo', 'onde devolvo'],
    resp: (ctx) => ({
      text: `Na devolução, o veículo deve ser entregue no mesmo estado em que foi recebido (conforme o laudo de vistoria da entrega). Atenção ao prazo: devolver depois da data combinada gera multa por dia de atraso — ${isEletrico(ctx) ? 'no elétrico, cerca de R$250 por dia' : 'no carro a combustão, cerca de R$150 por dia'}, conforme o seu contrato. Para combinar data e local da devolução, fale com a equipe. 🚗`,
      chips: ['Falar com atendente'],
    }),
  },
  {
    id: 'vistoria',
    kw: ['vistoria', 'video chamada', 'videochamada', 'chamada de video', 'verificacao semanal', 'inspecao', 'inspeção', 'mostrar o carro', 'apresentar o carro', 'checagem do carro'],
    resp: () => ({
      text: 'Uma vez por semana é feita uma chamada de vídeo entre você e a empresa para verificar a integridade e a conservação do carro, em dia e horário combinados. Além disso, você deve apresentar o veículo para vistoria sempre que solicitado. Recusar essa verificação é considerado descumprimento do contrato e pode levar à rescisão. 📹',
    }),
  },
  {
    id: 'rescisao',
    kw: ['rescisao', 'rescisão', 'rescindir', 'cancelar contrato', 'cancelar o contrato', 'cancelar meu contrato', 'como cancelo', 'cancelo meu contrato', 'encerrar', 'encerrar o contrato', 'encerrar contrato', 'sair do contrato', 'quero cancelar', 'desistir', 'terminar o contrato', 'quero devolver e sair', 'parar de alugar'],
    resp: () => ({
      text: 'O contrato pode ser encerrado por qualquer das partes com aviso prévio de 15 dias, devolvendo o carro no estado em que foi recebido. O descumprimento de cláusulas pode gerar rescisão imediata e multa. Você pode iniciar pelo botão "Encerrar Contrato" na aba "Seu contrato" — quer que eu te encaminhe para a equipe combinar os detalhes?',
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
