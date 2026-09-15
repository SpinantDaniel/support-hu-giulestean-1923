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
    const listingId=String(payload?.listing_id||"").trim();
    if(!listingId)return json({error:"Anunț invalid."},400);

    const {data:listing,error:listingError}=await admin.from("listings")
      .select("id").eq("id",listingId).maybeSingle();
    if(listingError)throw listingError;
    if(!listing)return json({error:"Anunțul nu mai există."},404);

    const {data:images,error:imageError}=await admin.from("listing_images")
      .select("storage_path").eq("listing_id",listingId);
    if(imageError)throw imageError;
    const paths=(images||[]).map((x:any)=>x.storage_path).filter(Boolean);

    await removeRequired(admin,"listing-images",paths);

    const {data:deleted,error:deleteError}=await admin.from("listings")
      .delete().eq("id",listingId).select("id");
    if(deleteError)throw deleteError;
    if(!deleted?.length)return json({error:"Anunțul nu a putut fi șters."},409);

    return json({ok:true});
  }catch(error){
    console.error("admin-delete-listing-v2",error);
    const message=error instanceof Error?error.message:"Eroare server.";
    if(message.startsWith("STORAGE_CLEANUP_FAILED:")){
      return json({error:"Fotografiile nu au putut fi curățate. Anunțul nu a fost șters; încearcă din nou."},503);
    }
    return json({error:"Anunțul nu a putut fi șters momentan."},500);
  }
});
