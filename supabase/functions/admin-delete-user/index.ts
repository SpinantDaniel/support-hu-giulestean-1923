import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Sesiune invalidă." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Configurare server incompletă." }, 500);

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    const caller = callerData?.user;
    if (callerError || !caller) return json({ error: "Sesiunea a expirat." }, 401);
    if (caller.app_metadata?.role !== "admin") return json({ error: "Acces rezervat administratorului." }, 403);

    const payload = await req.json().catch(() => ({}));
    const userId = String(payload?.user_id || "").trim();
    if (!userId) return json({ error: "Utilizator invalid." }, 400);
    if (userId === caller.id) return json({ error: "Nu îți poți șterge propriul cont din panoul de administrare." }, 400);

    const targetRes = await admin.auth.admin.getUserById(userId);
    const target = targetRes.data?.user;
    if (targetRes.error || !target) return json({ error: "Utilizatorul nu mai există." }, 404);
    if (target.app_metadata?.role === "admin") return json({ error: "Un administrator nu poate fi șters din acest panou." }, 400);

    const [{ data: profile }, { data: listings }] = await Promise.all([
      admin.from("profiles").select("avatar_path").eq("id", userId).maybeSingle(),
      admin.from("listings").select("id").eq("seller_id", userId),
    ]);

    const listingIds = (listings ?? []).map((x: { id: string }) => x.id);
    let imagePaths: string[] = [];
    if (listingIds.length) {
      const { data: images } = await admin
        .from("listing_images")
        .select("storage_path")
        .in("listing_id", listingIds);
      imagePaths = (images ?? [])
        .map((x: { storage_path: string | null }) => x.storage_path)
        .filter(Boolean) as string[];
    }

    if (imagePaths.length) {
      const rm = await admin.storage.from("listing-images").remove(imagePaths);
      if (rm.error) console.warn("listing image cleanup", rm.error.message);
    }

    if (profile?.avatar_path) {
      const rm = await admin.storage.from("profile-avatars").remove([profile.avatar_path]);
      if (rm.error) console.warn("avatar cleanup", rm.error.message);
    }

    if (target.email) {
      const { error: editorCleanupError } = await admin
        .from("newsletter_editors")
        .delete()
        .eq("email", target.email.toLowerCase());
      if (editorCleanupError) console.warn("newsletter editor cleanup", editorCleanupError.message);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("admin user delete", deleteError);
      return json({ error: "Utilizatorul nu a putut fi șters momentan." }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("admin-delete-user", error);
    return json({ error: error instanceof Error ? error.message : "Eroare server." }, 500);
  }
});
