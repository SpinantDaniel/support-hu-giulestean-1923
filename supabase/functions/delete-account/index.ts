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

  const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "Sesiunea a expirat. Intră din nou în cont." }, 401);

    const { data: profile } = await admin.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle();
    const { data: listings } = await admin.from("listings").select("id").eq("seller_id", user.id);
    const listingIds = (listings ?? []).map((x: { id: string }) => x.id);

    let imagePaths: string[] = [];
    if (listingIds.length) {
      const { data: images } = await admin.from("listing_images").select("storage_path").in("listing_id", listingIds);
      imagePaths = (images ?? []).map((x: { storage_path: string | null }) => x.storage_path).filter(Boolean) as string[];
    }

    if (imagePaths.length) {
      const { error } = await admin.storage.from("listing-images").remove(imagePaths);
      if (error) console.warn("listing image cleanup", error.message);
    }
    if (profile?.avatar_path) {
      const { error } = await admin.storage.from("profile-avatars").remove([profile.avatar_path]);
      if (error) console.warn("avatar cleanup", error.message);
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      console.error("auth delete", authDeleteError);
      return json({ error: "Contul nu a putut fi șters momentan." }, 500);
    }

    const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", user.id);
    if (profileDeleteError) {
      console.error("profile cleanup", profileDeleteError);
      return json({ ok: true, cleanup_warning: true }, 200);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error("delete-account", error);
    return json({ error: "Contul nu a putut fi șters momentan." }, 500);
  }
});
