import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ role: "none" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return json({ role: "none" }, 401);
  if (user.app_metadata?.role === "admin") return json({ role: "admin", email: user.email });
  const [{ data: editor }, { data: flag }] = await Promise.all([
    admin.from("newsletter_editors").select("email").eq("email", String(user.email || "").toLowerCase()).maybeSingle(),
    admin.from("user_flags").select("suspended,suspended_until,suspension_reason").eq("user_id", user.id).maybeSingle(),
  ]);
  const suspended = !!flag?.suspended && (!flag?.suspended_until || new Date(flag.suspended_until).getTime() > Date.now());
  if (editor && !suspended) return json({ role: "editor", email: user.email });
  return json({ role: "none", email: user.email, suspended, suspended_until: flag?.suspended_until || null, suspension_reason: flag?.suspension_reason || null });
});
