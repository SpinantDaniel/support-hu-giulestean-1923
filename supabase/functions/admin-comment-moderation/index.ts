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

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Sesiune invalidă." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Configurare server incompletă." }, 500);

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (userError || !caller) return json({ error: "Sesiunea a expirat." }, 401);
    if (caller.app_metadata?.role !== "admin") {
      return json({ error: "Acces rezervat administratorului." }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || "dashboard");

    if (action === "dashboard") {
      const [reportsRes, commentsRes, postsRes, profilesRes, usersRes] = await Promise.all([
        admin.from("blog_comment_reports")
          .select("id,reporter_id,comment_id,reason,details,status,created_at,updated_at")
          .order("created_at", { ascending: false }),
        admin.from("blog_comments")
          .select("id,user_id,post_id,body,created_at"),
        admin.from("blog_posts")
          .select("id,title,slug"),
        admin.from("profiles")
          .select("id,display_name"),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);

      if (reportsRes.error) throw reportsRes.error;
      if (commentsRes.error) throw commentsRes.error;
      if (postsRes.error) throw postsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (usersRes.error) throw usersRes.error;

      const comments = commentsRes.data || [];
      const posts = postsRes.data || [];
      const profiles = profilesRes.data || [];
      const users = usersRes.data.users || [];

      const commentMap = new Map(comments.map((x:any) => [x.id, x]));
      const postMap = new Map(posts.map((x:any) => [x.id, x]));
      const profileMap = new Map(profiles.map((x:any) => [x.id, x]));
      const userMap = new Map(users.map((x:any) => [x.id, x]));

      const normalized = (reportsRes.data || []).map((r:any) => {
        const comment:any = commentMap.get(r.comment_id);
        const authorId = comment?.user_id || null;
        const author:any = authorId ? userMap.get(authorId) : null;
        const profile:any = authorId ? profileMap.get(authorId) : null;
        const post:any = comment?.post_id ? postMap.get(comment.post_id) : null;

        return {
          ...r,
          comment_body: comment?.body || "Comentariu indisponibil",
          comment_created_at: comment?.created_at || null,
          reported_user_id: authorId,
          reported_user_name: profile?.display_name || author?.email?.split("@")[0] || "Membru",
          reported_user_email: author?.email || null,
          post_id: comment?.post_id || null,
          post_title: post?.title || "Articol",
          post_slug: post?.slug || null,
        };
      });

      return json({ ok: true, comment_reports: normalized });
    }

    if (action === "resolve_comment_report") {
      const reportId = String(payload?.report_id || "");
      if (!reportId) return json({ error: "Raport invalid." }, 400);
      const { data, error } = await admin.from("blog_comment_reports")
        .update({ status: "resolved", updated_at: new Date().toISOString() })
        .eq("id", reportId)
        .select("id");
      if (error) throw error;
      if (!data?.length) return json({ error: "Raportarea nu mai există." }, 404);
      return json({ ok: true });
    }

    if (action === "delete_reported_comment") {
      const reportId = String(payload?.report_id || "");
      if (!reportId) return json({ error: "Raport invalid." }, 400);

      const { data: report, error: reportError } = await admin.from("blog_comment_reports")
        .select("id,comment_id,status")
        .eq("id", reportId)
        .maybeSingle();
      if (reportError) throw reportError;
      if (!report) return json({ error: "Raportarea nu mai există." }, 404);
      if (report.status !== "open") return json({ error: "Raportarea este deja închisă." }, 409);

      const { data: deleted, error: deleteError } = await admin.from("blog_comments")
        .delete()
        .eq("id", report.comment_id)
        .select("id");
      if (deleteError) throw deleteError;
      if (!deleted?.length) return json({ error: "Comentariul nu mai există." }, 404);

      return json({ ok: true });
    }

    if (action === "send_admin_message") {
      const userId = String(payload?.user_id || "");
      const body = String(payload?.body || "").trim().slice(0, 2000);
      const context = String(payload?.context || "").trim().slice(0, 240) || null;
      if (!userId || !body) return json({ error: "Destinatarul și mesajul sunt obligatorii." }, 400);

      const targetRes = await admin.auth.admin.getUserById(userId);
      if (targetRes.error || !targetRes.data?.user) return json({ error: "Utilizator inexistent." }, 404);

      const { error } = await admin.from("admin_messages").insert({
        recipient_id: userId,
        admin_id: caller.id,
        body,
        context,
      });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Acțiune necunoscută." }, 400);
  } catch (error) {
    console.error("admin-comment-moderation", error);
    return json({ error: error instanceof Error ? error.message : "Eroare server." }, 500);
  }
});
