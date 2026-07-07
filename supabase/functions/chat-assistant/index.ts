// ============================================================
// Edge Function: chat-assistant
// Assistente de IA (Claude) da aba "Falar com a empresa".
// Recebe o histórico da conversa + o contexto do motorista e
// responde de forma resolutiva. Se não conseguir resolver, sinaliza
// escalonamento para o WhatsApp comercial ([[ESCALAR]]).
//
// Segredos necessários (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY   → sua chave da API da Claude (console.anthropic.com)
// SUPABASE_URL / SUPABASE_ANON_KEY são injetados automaticamente.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MODEL = "claude-opus-4-8";
const ESCALATE_TAG = "[[ESCALAR]]";

// Monta a "persona" + base de conhecimento + contexto do motorista.
function buildSystem(ctx: Record<string, unknown> = {}): string {
  const c = ctx as Record<string, any>;
  const linhas: string[] = [];
  linhas.push(`Nome do motorista: ${c.nome || "não informado"}.`);
  if (c.proximoPagamento) {
    const p = c.proximoPagamento;
    linhas.push(`Próximo pagamento: ${p.valor} com vencimento em ${p.vencimento} (situação: ${p.situacao}).`);
  } else {
    linhas.push("Não há pagamentos pendentes no momento.");
  }
  if (typeof c.pagamentosAtrasados === "number" && c.pagamentosAtrasados > 0) {
    linhas.push(`Pagamentos em atraso: ${c.pagamentosAtrasados}.`);
  }
  if (c.veiculo) {
    linhas.push(`Veículo locado: ${c.veiculo.modelo || "—"}, placa ${c.veiculo.placa || "—"}${c.veiculo.km ? `, ${c.veiculo.km}` : ""}.`);
  } else {
    linhas.push("Nenhum veículo vinculado no momento.");
  }
  if (c.contrato) {
    linhas.push(`Contrato: ${c.contrato.situacao}${c.contrato.vigencia ? ` (${c.contrato.vigencia})` : ""}.`);
  }
  if (c.valorSemanal) linhas.push(`Valor semanal da locação: ${c.valorSemanal}.`);

  return `Você é o "Flex App", o assistente virtual de atendimento da Flex Drive, uma locadora de veículos para motoristas (locatários) — geralmente motoristas de aplicativo que alugam o carro por semana.

Seu papel é conversar de forma natural e RESPONDER QUALQUER dúvida do motorista: sobre pagamentos, contrato, veículo, manutenção, documentos, a empresa Flex Drive e temas relacionados à locação e ao dia a dia de dirigir. Não se limite a respostas prontas — interprete a pergunta e responda de verdade, como um atendente experiente e prestativo faria. Se a pergunta for genérica (ex.: "como funciona?", "vale a pena?", "e se eu viajar?"), explique com clareza.

ESTILO: português do Brasil, cordial e direto. Respostas curtas (2 a 5 frases). No máximo 1 emoji ocasional. Responda apenas com a resposta final ao motorista — não descreva seu raciocínio.

CONHECIMENTO SOBRE A FLEX DRIVE:
- Modelo de negócio: a Flex Drive aluga carros para motoristas. O motorista paga a locação SEMANALMENTE e usa o carro para trabalhar (apps, particular, etc.).
- Pagamentos: os vencimentos e valores aparecem na aba "Pagamentos" do app. O pagamento é por Pix — na aba "Pagamentos" há o Pix copia-e-cola e o QR Code. Depois de pagar, o motorista marca como pago e pode enviar o comprovante / avisar pelo WhatsApp.
- Atraso: oriente a regularizar o quanto antes pela aba "Pagamentos". Negociar prazo, parcelar ou rever valores é com a equipe humana (escalar).
- Contrato: o contrato assinado fica na aba "Contrato" (abrir/baixar). A renovação é solicitada por lá. Rescisão, alteração de cláusulas ou casos específicos são tratados com a equipe.
- Veículo: dados do carro e documentos (ex.: CRLV/licenciamento) ficam na aba "Meu Veículo".
- Manutenção: solicitada pela aba "Manutenção". Emergências (carro parado, pane, acidente) precisam de atendimento humano imediato (escalar).
- Troca de veículo: pode ser solicitada; a equipe avalia.
- Canais humanos: WhatsApp comercial, e-mail comercial e Instagram da Flex Drive.

CONTEXTO ATUAL DESTE MOTORISTA:
${linhas.map((l) => "- " + l).join("\n")}

REGRAS:
- Responda com base no conhecimento acima e no contexto do motorista. Cite números concretos quando fizer sentido (valor e data do próximo pagamento, modelo/placa do carro, situação do contrato).
- Para dúvidas gerais fora desses tópicos, responda com bom senso e de forma útil, sempre no contexto de ser o assistente da Flex Drive.
- NÃO invente valores, datas, políticas, multas, coberturas de seguro ou regras específicas que você não tem certeza. Nesses casos, dê a orientação geral que puder e ofereça encaminhar para a equipe confirmar.
- Escale para um atendente humano (WhatsApp comercial) quando: o motorista pedir explicitamente falar com uma pessoa; houver reclamação, disputa ou emergência (acidente, roubo, pane); negociação de dívida/valores; mudança/rescisão de contrato; alteração de dados cadastrais; ou algo que exija ação da empresa que você não pode executar.
- Ao escalar, escreva uma resposta curta avisando que vai encaminhar para a equipe e TERMINE a mensagem com o marcador exato ${ESCALATE_TAG} (em uma linha separada). Nunca mostre esse marcador em outras situações.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY não configurada nas Secrets da Edge Function." }, 500);

    // Exige um usuário autenticado (evita uso do endpoint como proxy aberto).
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    const body = await req.json();
    const context = body.context ?? {};
    const incoming = Array.isArray(body.messages) ? body.messages : [];

    // Sanitiza o histórico: só user/assistant, texto, últimas 20 mensagens.
    const messages = incoming
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim())
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    if (!messages.length || messages[0].role !== "user") {
      return json({ error: "Mensagem inválida." }, 400);
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: buildSystem(context),
        messages,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: "Falha ao consultar a IA.", detail: detail.slice(0, 500) }, 502);
    }

    const data = await resp.json();
    let text = Array.isArray(data.content)
      ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim()
      : "";

    let escalate = false;
    if (text.includes(ESCALATE_TAG)) {
      escalate = true;
      text = text.replaceAll(ESCALATE_TAG, "").trim();
    }
    if (!text) text = "Desculpe, tive um probleminha aqui. Pode tentar reformular?";

    return json({ reply: text, escalate });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
