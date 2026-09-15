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

const sleep = (ms:number) => new Promise(resolve => setTimeout(resolve, ms));

async function removeRequired(admin:any,bucket:string,paths:string[]) {
  const unique=[...new Set((paths||[]).filter(Boolean))];
  if(!unique.length) return;
  let last:any=null;
  for(let attempt=0;attempt<3;attempt++){
    const rm=await admin.storage.from(bucket).remove(unique);
    if(!rm.error)return;
    last=rm.error;
    console.warn("storage cleanup",bucket,attempt+1,rm.error.message);
    if(attempt<2)await sleep(200*(attempt+1));
  }
  throw new Error(`STORAGE_CLEANUP_FAILED:${bucket}:${last?.message||"unknown"}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return json({error:"Sesiune invalidă."},401);

  const url=Deno.env.get("SUPABASE_URL");
  const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!serviceRole)return json({error:"Configurare server incompletă."},500);
  const admin=createClient(url,serviceRole,{auth:{autoRefreshToken:false,persistSession:false}});

  try{
    const {data:callerData,error:callerError}=await admin.auth.getUser(token);
    const caller=callerData?.user;
    if(callerError||!caller)return json({error:"Sesiunea a expirat."},401);
    if(caller.app_metadata?.role!=="admin")return json({error:"Acces rezervat administratorului."},403);

    const payload=await req.json().catch(()=>({}));
    const userId=String(payload?.user_id||"").trim();
    if(!userId)return json({error:"Utilizator invalid."},400);
    if(userId===caller.id)return json({error:"Nu îți poți șterge propriul cont din panoul de administrare."},400);

    const targetRes=await admin.auth.admin.getUserById(userId);
    const target=targetRes.data?.user;
    if(targetRes.error||!target)return json({error:"Utilizatorul nu mai există."},404);
    if(target.app_metadata?.role==="admin")return json({error:"Un administrator nu poate fi șters din acest panou."},400);

    const [{data:profile,error:profileError},{data:listings,error:listingsError}]=await Promise.all([
      admin.from("profiles").select("avatar_path").eq("id",userId).maybeSingle(),
      admin.from("listings").select("id").eq("seller_id",userId)
    ]);
    if(profileError)throw profileError;
    if(listingsError)throw listingsError;

    const listingIds=(listings||[]).map((x:any)=>x.id);
    let imagePaths:string[]=[];
    if(listingIds.length){
      const {data:images,error:imageError}=await admin.from("listing_images")
        .select("storage_path").in("listing_id",listingIds);
      if(imageError)throw imageError;
      imagePaths=(images||[]).map((x:any)=>x.storage_path).filter(Boolean);
    }

    await removeRequired(admin,"listing-images",imagePaths);
    if(profile?.avatar_path)await removeRequired(admin,"profile-avatars",[profile.avatar_path]);

    let editorBackup:any=null;
    if(target.email){
      const editor=await admin.from("newsletter_editors")
        .select("email,added_by,created_at").eq("email",target.email.toLowerCase()).maybeSingle();
      if(editor.error)throw editor.error;
      editorBackup=editor.data||null;
      if(editorBackup){
        const delEditor=await admin.from("newsletter_editors").delete().eq("email",editorBackup.email);
        if(delEditor.error)throw delEditor.error;
      }
    }

    const {error:deleteError}=await admin.auth.admin.deleteUser(userId);
    if(deleteError){
      if(editorBackup){
        await admin.from("newsletter_editors").upsert(editorBackup,{onConflict:"email"}).catch(()=>undefined);
      }
      throw deleteError;
    }

    return json({ok:true});
  }catch(error){
    console.error("admin-delete-user-v2",error);
    const message=error instanceof Error?error.message:"Eroare server.";
    if(message.startsWith("STORAGE_CLEANUP_FAILED:")){
      return json({error:"Fișierele utilizatorului nu au putut fi curățate complet. Utilizatorul NU a fost șters."},503);
    }
    return json({error:"Utilizatorul nu a putut fi șters momentan."},500);
  }
});
