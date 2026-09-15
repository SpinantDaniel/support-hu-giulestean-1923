import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const HTML = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#6f1530"><title>FanSupportHubGiuleștean1923</title><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#18171a}.boot{min-height:100dvh;display:grid;place-items:center;padding:32px;text-align:center}.boot b{display:block;font-size:20px;margin-bottom:8px}.boot small{color:#6f6b71}</style><script src="https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"></script></head><body><div class="boot" id="boot"><div><b>Se încarcă FanSupportHubGiuleștean1923…</b><small>Release stabil v7</small></div></div><script>(async()=>{try{if(!window.pako)throw new Error('pako unavailable');const K='sb_publishable_U2IRhs6K85S43ZRqKK5U8Q_HSknWMNY';const U='https://bhqpixyiojthpfqnyhsh.supabase.co/rest/v1/site_release_chunks?select=seq,data&release_id=eq.rebrand_v2&apikey='+encodeURIComponent(K);const r=await fetch(U,{cache:'no-store'});if(!r.ok)throw new Error('release http '+r.status);const a=await r.json();a.sort((x,y)=>x.seq-y.seq);const b=a.map(x=>x.data).join('');if(a.length!==7)throw new Error('release chunks '+a.length);if(b.length!==22384)throw new Error('release length '+b.length);const raw=Uint8Array.from(atob(b),c=>c.charCodeAt(0));const html=window.pako.ungzip(raw,{to:'string'});if(!html.includes('FanSupportHub'))throw new Error('marker missing');document.open();document.write(html);document.close();}catch(e){console.error(e);document.getElementById('boot').innerHTML='<div><b>FanSupportHubGiuleștean1923 nu s-a încărcat.</b><small>Cod: '+String(e.message||e)+'</small><p>Reîncarcă pagina.</p></div>';}})();</script></body></html>`;

Deno.serve((req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type"
  };
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  if (req.method !== "GET") return new Response("Method not allowed", {status:405, headers:cors});
  return new Response(HTML, {status:200, headers:{...cors,"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store, max-age=0","X-FSH-Release":"v7-correct-hash"}});
});