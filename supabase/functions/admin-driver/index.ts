// ============================================================
// Edge Function: admin-driver
// Operações de administrador sobre motoristas (criar / excluir),
// usando a service_role (injetada automaticamente pelo Supabase).
// Só a EMPRESA autenticada pode chamar.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function genPass(): string {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = ""; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    const admin = createClient(url, service);
    const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (prof?.role !== "empresa") return json({ error: "Apenas a empresa pode gerenciar motoristas." }, 403);

    const body = await req.json();

    if (body.action === "create") {
      const { full_name, cpf, email, phone, city, second_name, second_cpf, second_phone, vehicle_id, weekly_value, payments } = body;
      const password = genPass();
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name, must_change_password: true },
      });
      if (error) return json({ error: /registered|exists/i.test(error.message) ? "Já existe uma conta com este e-mail." : error.message }, 400);
      const id = created.user.id;
      await admin.from("profiles").update({
        full_name, cpf, phone, city, second_name, second_cpf, second_phone, role: "cliente", must_change_password: true,
      }).eq("id", id);
      if (vehicle_id) {
        const upd: Record<string, unknown> = { client_id: id, status: "locado" };
        if (weekly_value != null) upd.weekly_value = weekly_value;
        await admin.from("vehicles").update(upd).eq("id", vehicle_id);
      }
      if (Array.isArray(payments) && payments.length) {
        await admin.from("payments").insert(payments.map((p: Record<string, unknown>) => ({ ...p, client_id: id, vehicle_id })));
      }
      return json({ ok: true, email, password });
    }

    if (body.action === "delete") {
      // libera o(s) veículo(s) do motorista antes de excluir
      await admin.from("vehicles").update({ status: "disponivel", client_id: null }).eq("client_id", body.user_id);
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
