(()=>{
  'use strict';

  const MB=1024*1024;
  const KB=1024;
  const MAX_INPUT_BYTES=25*MB;
  const PENDING_KEY='shg:image-cleanup:v1';
  const WEBP_QUALITIES=[0.82,0.75,0.68];
  const SCALE_STEPS=[1,0.90,0.82];

  // Variant-oriented configuration: a thumbnail variant can be added later without
  // changing callers or the storage-provider contract.
  const PRESETS={
    listing:{
      full:{maxWidth:1600,maxHeight:1600,targetBytes:240*KB,hardBytes:500*KB,qualities:WEBP_QUALITIES}
    },
    blog:{
      full:{maxWidth:1920,maxHeight:1920,targetBytes:340*KB,hardBytes:750*KB,qualities:WEBP_QUALITIES}
    },
    avatar:{
      full:{maxWidth:512,maxHeight:512,targetBytes:110*KB,hardBytes:250*KB,qualities:WEBP_QUALITIES}
    }
  };

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const yieldToMain=()=>new Promise(resolve=>{
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>resolve());
    else setTimeout(resolve,0);
  });

  function extOf(file){
    const name=String(file?.name||'').toLowerCase();
    const m=name.match(/\.([a-z0-9]+)$/i);
    return m?m[1]:'';
  }

  function supportedInput(file){
    if(!file)return false;
    const type=String(file.type||'').toLowerCase();
    const ext=extOf(file);
    return type.startsWith('image/')||['jpg','jpeg','png','webp','heic','heif'].includes(ext);
  }

  function validateInput(file){
    if(!file)throw new Error('Nu a fost selectată nicio imagine.');
    if(!supportedInput(file))throw new Error(`Fișierul „${file.name||'selectat'}” nu este o imagine acceptată.`);
    if(file.size>MAX_INPUT_BYTES)throw new Error(`Imaginea „${file.name||'selectată'}” este prea mare pentru procesare în browser. Alege o fotografie sub 25 MB.`);
  }

  function preset(kind,variant='full'){
    const cfg=PRESETS[kind]?.[variant];
    if(!cfg)throw new Error(`Profil de optimizare necunoscut: ${kind}/${variant}.`);
    return cfg;
  }

  async function decodeImage(file){
    validateInput(file);
    let bitmap=null;
    if(typeof createImageBitmap==='function'){
      try{
        // Modern Chromium/Safari/Firefox apply EXIF orientation here.
        bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
        if(bitmap?.width&&bitmap?.height){
          return {source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};
        }
      }catch(_){
        try{bitmap?.close?.();}catch(__){}
      }
    }

    const url=URL.createObjectURL(file);
    try{
      const img=new Image();
      img.decoding='async';
      await new Promise((resolve,reject)=>{
        img.onload=resolve;
        img.onerror=()=>reject(new Error('Browserul nu poate decoda această imagine.'));
        img.src=url;
      });
      if(!img.naturalWidth||!img.naturalHeight)throw new Error('Imaginea nu are dimensiuni valide.');
      // Modern browser image decoders honor EXIF orientation when rasterizing to canvas.
      return {source:img,width:img.naturalWidth,height:img.naturalHeight,close:()=>URL.revokeObjectURL(url)};
    }catch(error){
      URL.revokeObjectURL(url);
      const ext=extOf(file);
      if(ext==='heic'||ext==='heif'||/heic|heif/i.test(file.type||'')){
        throw new Error('Formatul HEIC/HEIF nu poate fi procesat de acest browser. Convertește fotografia în JPG sau încearcă de pe un dispozitiv/browser compatibil.');
      }
      throw new Error('Imaginea nu a putut fi decodată. Încearcă o altă fotografie.');
    }
  }

  function fitSize(width,height,maxWidth,maxHeight,scale=1){
    const fit=Math.min(1,maxWidth/width,maxHeight/height)*scale;
    return {
      width:Math.max(1,Math.round(width*fit)),
      height:Math.max(1,Math.round(height*fit))
    };
  }

  function makeCanvas(decoded,cfg,scale=1){
    const dims=fitSize(decoded.width,decoded.height,cfg.maxWidth,cfg.maxHeight,scale);
    const canvas=document.createElement('canvas');
    canvas.width=dims.width;
    canvas.height=dims.height;
    const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
    if(!ctx)throw new Error('Browserul nu poate procesa imaginea selectată.');
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(decoded.source,0,0,dims.width,dims.height);
    return {canvas,...dims};
  }

  function toBlob(canvas,type,quality){
    return new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Compresia imaginii a eșuat.')),type,quality);
    });
  }

  async function canvasHasAlpha(canvas){
    try{
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx)return false;
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      // Scan every pixel only in the rare non-WebP fallback path.
      for(let i=3;i<data.length;i+=4){if(data[i]<255)return true;}
    }catch(_){}
    return false;
  }

  async function encodeAtQuality(canvas,type,quality){
    const blob=await toBlob(canvas,type,quality);
    // Some old browsers silently fall back to PNG when WebP is unsupported.
    if(type==='image/webp'&&blob.type!=='image/webp')return null;
    return blob;
  }

  async function encodeCanvas(canvas,file,cfg){
    let best=null;
    let bestMeta=null;

    const tryType=async(type,qualities,scaleIndex)=>{
      for(const quality of qualities){
        const blob=await encodeAtQuality(canvas,type,quality);
        if(!blob)return {unsupported:true};
        if(!best||blob.size<best.size){
          best=blob;
          bestMeta={quality,type,scaleIndex};
        }
        if(blob.size<=cfg.targetBytes)return {blob,quality,type,scaleIndex,target:true};
      }
      return {blob:best,quality:bestMeta?.quality,type:bestMeta?.type,scaleIndex,target:false};
    };

    const webp=await tryType('image/webp',cfg.qualities,0);
    if(!webp.unsupported)return webp;

    const sourceType=String(file.type||'').toLowerCase();
    const transparent=(sourceType==='image/png'||sourceType==='image/webp')&&await canvasHasAlpha(canvas);
    if(transparent){
      const png=await toBlob(canvas,'image/png');
      return {blob:png,quality:null,type:'image/png',scaleIndex:0,target:png.size<=cfg.targetBytes};
    }

    best=null;bestMeta=null;
    return tryType('image/jpeg',cfg.qualities,0);
  }

  async function optimize(file,kind,variant='full'){
    validateInput(file);
    const cfg=preset(kind,variant);
    const decoded=await decodeImage(file);
    let globalBest=null;
    let globalMeta=null;

    try{
      for(let scaleIndex=0;scaleIndex<SCALE_STEPS.length;scaleIndex++){
        const scale=SCALE_STEPS[scaleIndex];
        const rendered=makeCanvas(decoded,cfg,scale);
        const encoded=await encodeCanvas(rendered.canvas,file,cfg);
        const blob=encoded.blob;
        if(blob&&(!globalBest||blob.size<globalBest.size)){
          globalBest=blob;
          globalMeta={...encoded,width:rendered.width,height:rendered.height,scale};
        }
        rendered.canvas.width=1;rendered.canvas.height=1;

        if(blob&&blob.size<=cfg.targetBytes){
          const type=blob.type||encoded.type||'image/webp';
          return result(blob,type,rendered.width,rendered.height,encoded.quality,file,kind,variant);
        }
        await yieldToMain();
      }

      if(globalBest&&globalBest.size<=cfg.hardBytes){
        return result(globalBest,globalBest.type||globalMeta.type,globalMeta.width,globalMeta.height,globalMeta.quality,file,kind,variant);
      }

      throw new Error('Imaginea este prea mare și nu a putut fi optimizată. Încearcă o altă fotografie.');
    }finally{
      try{decoded.close?.();}catch(_){}
    }
  }

  function result(blob,mime,width,height,quality,file,kind,variant){
    const extension=mime==='image/webp'?'webp':mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'bin';
    return {
      blob,mime,extension,width,height,quality,
      sizeBytes:blob.size,
      originalSizeBytes:file.size,
      originalName:file.name||'',
      kind,variant
    };
  }

  function recommendedConcurrency(){
    const cores=Number(navigator.hardwareConcurrency||2);
    return cores<=4?1:2;
  }

  async function optimizeMany(files,kind,{variant='full',concurrency=recommendedConcurrency(),onProgress}={}){
    const list=[...(files||[])];
    if(!list.length)return [];
    const limit=Math.max(1,Math.min(2,Number(concurrency)||1,list.length));
    const output=new Array(list.length);
    let cursor=0,completed=0;

    const worker=async()=>{
      while(true){
        const index=cursor++;
        if(index>=list.length)return;
        const file=list[index];
        try{
          output[index]=await optimize(file,kind,variant);
        }catch(error){
          const message=error instanceof Error?error.message:'Imaginea nu a putut fi optimizată.';
          throw new Error(file?.name?`„${file.name}” — ${message}`:message);
        }
        completed++;
        onProgress?.({completed,total:list.length,index,file,result:output[index]});
        await yieldToMain();
      }
    };

    await Promise.all(Array.from({length:limit},()=>worker()));
    return output;
  }

  function uuid(){
    return crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function uniquePath({userId,scopeId,prefix},processed){
    if(!userId)throw new Error('Utilizator invalid pentru upload.');
    const ext=processed?.extension||'webp';
    if(scopeId)return `${userId}/${scopeId}/${uuid()}.${ext}`;
    return `${userId}/${prefix||'image'}-${uuid()}.${ext}`;
  }

  function readPending(){
    try{
      const rows=JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');
      return Array.isArray(rows)?rows:[];
    }catch(_){return [];}
  }

  function writePending(rows){
    try{
      if(rows.length)localStorage.setItem(PENDING_KEY,JSON.stringify(rows.slice(-100)));
      else localStorage.removeItem(PENDING_KEY);
    }catch(_){}
  }

  function rememberPending(bucket,paths,ownerId){
    const rows=readPending();
    const seen=new Set(rows.map(x=>`${x.bucket}:${x.path}:${x.ownerId||''}`));
    for(const path of paths){
      const key=`${bucket}:${path}:${ownerId||''}`;
      if(!seen.has(key)){rows.push({bucket,path,ownerId:ownerId||null,createdAt:Date.now()});seen.add(key);}
    }
    writePending(rows);
  }

  const providers={
    supabase:{
      async upload(client,{bucket,path,blob,contentType,cacheControl='31536000'}){
        const {data,error}=await client.storage.from(bucket).upload(path,blob,{
          upsert:false,
          contentType:contentType||blob.type,
          cacheControl
        });
        if(error)throw error;
        return {data,path};
      },
      async delete(client,{bucket,paths}){
        const {data,error}=await client.storage.from(bucket).remove(paths);
        if(error)throw error;
        return data;
      },
      getPublicUrl(client,{bucket,path}){
        if(!path)return '';
        const {data}=client.storage.from(bucket).getPublicUrl(path);
        return data?.publicUrl||'';
      }
    }
  };

  let providerName='supabase';
  function provider(){return providers[providerName];}
  function setProvider(name){if(!providers[name])throw new Error(`Storage provider necunoscut: ${name}`);providerName=name;}

  async function upload(client,{bucket,path,processed}){
    if(!processed?.blob)throw new Error('Imagine optimizată invalidă.');
    return provider().upload(client,{bucket,path,blob:processed.blob,contentType:processed.mime,cacheControl:'31536000'});
  }

  async function remove(client,bucket,paths,{ownerId=null,remember=true,retries=2}={}){
    const unique=[...new Set((paths||[]).filter(Boolean))];
    if(!unique.length)return {ok:true};
    let lastError=null;
    for(let attempt=0;attempt<=retries;attempt++){
      try{
        await provider().delete(client,{bucket,paths:unique});
        return {ok:true};
      }catch(error){
        lastError=error;
        if(attempt<retries)await sleep(180*(attempt+1));
      }
    }
    if(remember)rememberPending(bucket,unique,ownerId);
    return {ok:false,error:lastError};
  }

  async function flushPendingDeletes(client,currentUserId){
    if(!currentUserId)return {processed:0,remaining:readPending().length};
    const rows=readPending();
    const mine=rows.filter(x=>!x.ownerId||x.ownerId===currentUserId);
    const untouched=rows.filter(x=>x.ownerId&&x.ownerId!==currentUserId);
    const groups=new Map();
    for(const row of mine){
      const arr=groups.get(row.bucket)||[];arr.push(row.path);groups.set(row.bucket,arr);
    }
    let processed=0;
    const failed=[];
    for(const [bucket,paths] of groups){
      const res=await remove(client,bucket,paths,{ownerId:currentUserId,remember:false,retries:1});
      if(res.ok)processed+=paths.length;
      else paths.forEach(path=>failed.push({bucket,path,ownerId:currentUserId,createdAt:Date.now()}));
    }
    writePending([...untouched,...failed]);
    return {processed,remaining:untouched.length+failed.length};
  }

  function getPublicUrl(client,bucket,path){return provider().getPublicUrl(client,{bucket,path});}
  function formatBytes(bytes){
    const n=Number(bytes||0);
    if(n<KB)return `${n} B`;
    if(n<MB)return `${Math.round(n/KB)} KB`;
    return `${(n/MB).toFixed(1)} MB`;
  }

  window.imageService={
    optimize,optimizeMany,upload,delete:remove,getPublicUrl,uniquePath,
    flushPendingDeletes,setProvider,formatBytes,validateInput,
    presets:PRESETS,maxInputBytes:MAX_INPUT_BYTES
  };
})();
