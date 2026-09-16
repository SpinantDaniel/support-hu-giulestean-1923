(()=>{
  'use strict';

  const qs=(s,root=document)=>root.querySelector(s);

  function youtubeId(value=''){
    const raw=String(value||'').trim();
    if(!raw)return null;
    try{
      const url=new URL(raw);
      const host=url.hostname.toLowerCase().replace(/^www\./,'');
      let id='';
      if(host==='youtu.be'){
        id=url.pathname.split('/').filter(Boolean)[0]||'';
      }else if(host==='youtube.com'||host==='m.youtube.com'||host==='music.youtube.com'||host==='youtube-nocookie.com'){
        const parts=url.pathname.split('/').filter(Boolean);
        if(url.pathname==='/watch')id=url.searchParams.get('v')||'';
        else if(['embed','shorts','live'].includes(parts[0]))id=parts[1]||'';
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
    }catch{
      return null;
    }
  }

  function renderPublicMedia(url){
    const card=qs('#featuredMediaCard');
    if(!card)return;
    const id=youtubeId(url);
    if(!id){
      card.innerHTML='<div class="featured-media-fallback" id="featuredMediaFallback"><img src="/brand-logo-auth.webp" alt="Support Hub Giuleștean 1923"></div>';
      return;
    }
    const iframe=document.createElement('iframe');
    iframe.className='featured-media-frame';
    iframe.src=`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
    iframe.title='Video Support Hub Giuleștean 1923';
    iframe.loading='lazy';
    iframe.referrerPolicy='strict-origin-when-cross-origin';
    iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen=true;
    card.replaceChildren(iframe);
  }

  async function loadPublicMedia(){
    const card=qs('#featuredMediaCard');
    if(!card||typeof db==='undefined')return;
    try{
      const {data,error}=await db.from('marketplace_settings')
        .select('featured_youtube_url')
        .eq('id',true)
        .maybeSingle();
      if(error)throw error;
      renderPublicMedia(data?.featured_youtube_url||'');
    }catch(error){
      console.warn('featured media load',error);
      renderPublicMedia('');
    }
  }

  function setAdminStatus(text,type=''){
    const el=qs('#featuredMediaAdminStatus');
    if(!el)return;
    el.textContent=text;
    el.className='media-settings-status'+(type?' '+type:'');
  }

  async function loadAdminSetting(){
    const form=qs('#featuredMediaSettingsForm');
    if(!form||typeof db==='undefined')return;
    try{
      const {data,error}=await db.from('marketplace_settings')
        .select('featured_youtube_url')
        .eq('id',true)
        .maybeSingle();
      if(error)throw error;
      form.elements.youtube_url.value=data?.featured_youtube_url||'';
      setAdminStatus(data?.featured_youtube_url?'Video YouTube activ.':'Fallback-ul cu logo este activ.');
    }catch(error){
      console.error('featured media admin load',error);
      setAdminStatus('Setarea media nu a putut fi încărcată.','error');
    }
  }

  async function saveAdminSetting(value,button){
    const url=String(value||'').trim();
    if(url&&!youtubeId(url)){
      setAdminStatus('URL YouTube invalid. Folosește un link video YouTube, Shorts sau youtu.be.','error');
      return false;
    }
    const original=button?.textContent;
    if(button){button.disabled=true;button.textContent='Se salvează…';}
    try{
      const {data,error}=await db.from('marketplace_settings')
        .update({
          featured_youtube_url:url||null,
          updated_at:new Date().toISOString()
        })
        .eq('id',true)
        .select('featured_youtube_url')
        .single();
      if(error)throw error;
      const form=qs('#featuredMediaSettingsForm');
      if(form)form.elements.youtube_url.value=data?.featured_youtube_url||'';
      setAdminStatus(url?'Video salvat. Va apărea pe Homepage după reîncărcare.':'Video eliminat. Fallback-ul cu logo este activ.','success');
      return true;
    }catch(error){
      console.error('featured media admin save',error);
      setAdminStatus(error?.message||'Setarea media nu a putut fi salvată.','error');
      return false;
    }finally{
      if(button){button.disabled=false;button.textContent=original||'Salvează video';}
    }
  }

  function bindAdminMedia(){
    const form=qs('#featuredMediaSettingsForm');
    if(!form)return;
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      await saveAdminSetting(form.elements.youtube_url.value,qs('#saveFeaturedMedia'));
    });
    qs('#clearFeaturedMedia')?.addEventListener('click',async()=>{
      form.elements.youtube_url.value='';
      await saveAdminSetting('',qs('#clearFeaturedMedia'));
    });
    loadAdminSetting();
  }

  function init(){
    if(qs('#featuredMediaCard'))loadPublicMedia();
    if(qs('#featuredMediaSettingsForm'))bindAdminMedia();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
