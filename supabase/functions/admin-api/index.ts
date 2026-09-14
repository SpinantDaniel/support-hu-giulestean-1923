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
    const caller = userData?.user;
    if (userError || !caller) return json({ error: "Sesiunea a expirat." }, 401);
    const fullAdmin = caller.app_metadata?.role === "admin";
    if (!fullAdmin) return json({ error: "Acces rezervat administratorului." }, 403);

    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || "dashboard");

    if (action === "dashboard") {
      const [usersRes, profilesRes, flagsRes, listingsRes, reportsRes] = await Promise.all([
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from("profiles").select("id,display_name,avatar_path,location,created_at"),
        admin.from("user_flags").select("user_id,suspended,verified,suspended_until,suspension_reason,updated_at"),
        admin.from("listings").select("id,seller_id,title,state,created_at").order("created_at", { ascending: false }),
        admin.from("reports").select("id,reporter_id,listing_id,reason,details,status,created_at").order("created_at", { ascending: false }),
      ]);
      if (usersRes.error) throw usersRes.error;
      const users = usersRes.data.users || [];
      const profiles = profilesRes.data || [];
      const flags = flagsRes.data || [];
      const listings = listingsRes.data || [];
      const reports = reportsRes.data || [];
      const profileMap = new Map(profiles.map((x:any) => [x.id, x]));
      const flagMap = new Map(flags.map((x:any) => [x.user_id, x]));
      const userMap = new Map(users.map((u:any) => [u.id, u]));
      const listingMap = new Map(listings.map((l:any) => [l.id, l]));
      const reportCount = new Map<string, number>();
      const listingReportCount = new Map<string, number>();
      for (const r of reports) {
        const l:any = listingMap.get(r.listing_id);
        if (l?.seller_id) reportCount.set(l.seller_id, (reportCount.get(l.seller_id) || 0) + 1);
        listingReportCount.set(r.listing_id, (listingReportCount.get(r.listing_id) || 0) + 1);
      }
      const listingCount = new Map<string, number>();
      for (const l of listings) listingCount.set(l.seller_id, (listingCount.get(l.seller_id) || 0) + 1);
      const normalizedUsers = users.map((u:any) => {
        const p:any = profileMap.get(u.id) || {};
        const f:any = flagMap.get(u.id) || {};
        const activeSuspension = !!f.suspended && (!f.suspended_until || new Date(f.suspended_until).getTime() > Date.now());
        return {
          id: u.id,
          email: u.email,
          display_name: p.display_name || u.email?.split("@")[0] || "Membru",
          location: p.location || null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          role: u.app_metadata?.role || "user",
          verified: !!f.verified,
          suspended: activeSuspension,
          suspended_until: f.suspended_until || null,
          suspension_reason: f.suspension_reason || null,
          reports_count: reportCount.get(u.id) || 0,
          listings_count: listingCount.get(u.id) || 0,
        };
      });
      const normalizedListings = listings.map((l:any) => {
        const u:any = userMap.get(l.seller_id);
        const p:any = profileMap.get(l.seller_id) || {};
        return {
          ...l,
          seller_email: u?.email || null,
          seller_name: p.display_name || u?.email?.split("@")[0] || "Membru",
          reports_count: listingReportCount.get(l.id) || 0,
        };
      });
      const normalizedReports = reports.map((r:any) => {
        const l:any = listingMap.get(r.listing_id);
        const seller:any = l ? userMap.get(l.seller_id) : null;
        const sellerProfile:any = l ? profileMap.get(l.seller_id) : null;
        return {
          ...r,
          listing_title: l?.title || "Anunț eliminat",
          seller_id: l?.seller_id || null,
          seller_email: seller?.email || null,
          seller_name: sellerProfile?.display_name || seller?.email?.split("@")[0] || "Membru",
        };
      });
      return json({
        ok: true,
        users: normalizedUsers,
        reported_users: normalizedUsers.filter((u:any) => u.reports_count > 0).sort((a:any,b:any) => b.reports_count-a.reports_count),
        listings: normalizedListings,
        reports: normalizedReports,
      });
    }

    if (action === "suspend_user") {
      const userId = String(payload?.user_id || "");
      const hours = Number(payload?.hours || 0);
      const reason = String(payload?.reason || "Încălcare reguli").trim().slice(0, 500);
      if (!userId || !Number.isFinite(hours) || hours < 1 || hours > 2160) return json({ error: "Durată invalidă." }, 400);
      const targetRes = await admin.auth.admin.getUserById(userId);
      const target = targetRes.data?.user;
      if (!target) return json({ error: "Utilizator inexistent." }, 404);
      if (target.app_metadata?.role === "admin") return json({ error: "Un administrator nu poate fi suspendat din acest panou." }, 400);
      const until = new Date(Date.now() + hours * 3600000).toISOString();
      const { error } = await admin.from("user_flags").upsert({
        user_id: userId,
        suspended: true,
        suspended_until: until,
        suspension_reason: reason || "Încălcare reguli",
        suspended_by: caller.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      return json({ ok: true, suspended_until: until });
    }

    if (action === "unsuspend_user") {
      const userId = String(payload?.user_id || "");
      if (!userId) return json({ error: "Utilizator invalid." }, 400);
      const { error } = await admin.from("user_flags").upsert({
        user_id: userId,
        suspended: false,
        suspended_until: null,
        suspension_reason: null,
        suspended_by: caller.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "set_verified") {
      const userId = String(payload?.user_id || "");
      const verified = !!payload?.verified;
      if (!userId) return json({ error: "Utilizator invalid." }, 400);
      const { error } = await admin.from("user_flags").upsert({
        user_id: userId,
        verified,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete_listing") {
      const listingId = String(payload?.listing_id || "");
      if (!listingId) return json({ error: "Anunț invalid." }, 400);
      const { data: images } = await admin.from("listing_images").select("storage_path").eq("listing_id", listingId);
      const paths = (images || []).map((x:any) => x.storage_path).filter(Boolean);
      if (paths.length) {
        const rm = await admin.storage.from("listing-images").remove(paths);
        if (rm.error) console.warn("listing cleanup", rm.error.message);
      }
      const { data, error } = await admin.from("listings").delete().eq("id", listingId).select("id");
      if (error) throw error;
      if (!data?.length) return json({ error: "Anunțul nu mai există." }, 404);
      return json({ ok: true });
    }

    if (action === "resolve_report") {
      const reportId = String(payload?.report_id || "");
      if (!reportId) return json({ error: "Raport invalid." }, 400);
      const { error } = await admin.from("reports").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", reportId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Acțiune necunoscută." }, 400);
  } catch (error) {
    console.error("admin-api", error);
    return json({ error: error instanceof Error ? error.message : "Eroare server." }, 500);
  }
});
