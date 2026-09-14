import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const displayName = String(body?.display_name ?? "").trim();
    const acceptTerms = body?.accept_terms === true;
    const acknowledgePrivacy = body?.acknowledge_privacy === true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Adresa de email nu este validă." }, 400);
    if (password.length < 8) return json({ error: "Parola trebuie să aibă minimum 8 caractere." }, 400);
    if (displayName.length < 2 || displayName.length > 60) return json({ error: "Numele afișat trebuie să aibă între 2 și 60 de caractere." }, 400);
    if (!acceptTerms || !acknowledgePrivacy) {
      return json({ error: "Pentru a crea contul trebuie să accepți Termenii de utilizare și să confirmi că ai citit Politica de confidențialitate." }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) return json({ error: "Configurare server incompletă." }, 500);

    const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (error) {
      const code = String((error as { code?: string }).code ?? "").toLowerCase();
      const m = error.message.toLowerCase();
      if (code === "email_exists" || m.includes("already") || m.includes("registered") || m.includes("exists")) {
        return json({ error: "Acest email este deja asociat unui cont. Folosește «Intră în cont» sau «Ai uitat parola?»." }, 409);
      }
      console.error("register-user", error);
      return json({ error: "Contul nu a putut fi creat momentan." }, 400);
    }

    const user = data.user;
    if (!user) return json({ error: "Contul nu a putut fi creat momentan." }, 500);

    const acceptedAt = new Date().toISOString();
    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      display_name: displayName,
      terms_accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
      privacy_acknowledged_at: acceptedAt,
      privacy_version: PRIVACY_VERSION,
      updated_at: acceptedAt,
    }, { onConflict: "id" });

    if (profileError) {
      console.error("register-user profile consent", profileError);
      await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      return json({ error: "Contul nu a putut fi creat momentan." }, 500);
    }

    return json({ ok: true, user_id: user.id }, 201);
  } catch (error) {
    console.error("register-user", error);
    return json({ error: "Cerere invalidă." }, 400);
  }
});
