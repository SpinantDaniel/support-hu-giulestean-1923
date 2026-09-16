(()=>{
  'use strict';

  const qs=(s,root=document)=>root.querySelector(s);
  const qsa=(s,root=document)=>[...root.querySelectorAll(s)];

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

  function normalizeUrls(values){
    return (Array.isArray(values)?values:[])
      .map(v=>String(v||'').trim())
      .filter(Boolean)
      .slice(0,5);
  }

  function posterMarkup(id,index){
    return `<button class="featured-media-poster" type="button" data-video-id="${id}" aria-label="Redă video ${index+1}">
      <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer">
      <span class="featured-media-play-icon" aria-hidden="true">▶</span>
      <span class="featured-media-number">Video ${index+1}</span>
    </button>`;
  }

  function fallbackMarkup(){
    return '<article class="featured-media-video-card featured-media-fallback-card is-single"><div class="featured-media-fallback"><img src="/brand-logo-auth.webp" alt="Support Hub Giuleștean 1923"></div></article>';
  }

  function renderPublicMedia(urls){
    const root=qs('#featuredMediaCarousel');
    if(!root)return;
    const valid=normalizeUrls(urls)
      .map(url=>({url,id:youtubeId(url)}))
      .filter(x=>x.id);

    if(!valid.length){
      root.innerHTML=fallbackMarkup();
      root.scrollTo({left:0,behavior:'auto'});
      updateControls();
      return;
    }

    root.innerHTML=valid.map((item,index)=>
      `<article class="featured-media-video-card" data-media-index="${index}" data-video-id="${item.id}">
        ${posterMarkup(item.id,index)}
      </article>`
    ).join('');
    root.scrollTo({left:0,behavior:'auto'});
    bindVideoCards();
    updateControls();
  }

  function resetPlayingCard(card){
    if(!card?.classList.contains('is-playing'))return;
    const id=card.dataset.videoId;
    const index=Number(card.dataset.mediaIndex||0);
    card.classList.remove('is-playing');
    card.innerHTML=posterMarkup(id,index);
    card.querySelector('.featured-media-poster')?.addEventListener('click',()=>activateVideo(card));
  }

  function activateVideo(card){
    if(!card)return;
    qsa('.featured-media-video-card.is-playing',qs('#featuredMediaCarousel')).forEach(other=>{
      if(other!==card)resetPlayingCard(other);
    });
    const id=card.dataset.videoId;
    if(!id)return;
    const iframe=document.createElement('iframe');
    iframe.className='featured-media-frame';
    iframe.src=`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=1`;
    iframe.title='Video Hub Media Giulestean';
    iframe.referrerPolicy='strict-origin-when-cross-origin';
    iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen=true;
    card.classList.add('is-playing');
    card.replaceChildren(iframe);
  }

  function bindVideoCards(){
    const root=qs('#featuredMediaCarousel');
    if(!root)return;
    qsa('.featured-media-poster',root).forEach(button=>{
      button.addEventListener('click',()=>activateVideo(button.closest('.featured-media-video-card')));
    });
  }

  function stepSize(){
    const root=qs('#featuredMediaCarousel');
    const card=root?.querySelector('.featured-media-video-card');
    if(!root||!card)return 0;
    const styles=getComputedStyle(root);
    const gap=parseFloat(styles.columnGap||styles.gap||'0')||0;
    return card.getBoundingClientRect().width+gap;
  }

  function canScroll(){
    const root=qs('#featuredMediaCarousel');
    return !!root&&root.scrollWidth>root.clientWidth+4;
  }

  function updateControls(){
    const can=canScroll();
    const prev=qs('#featuredMediaPrev'),next=qs('#featuredMediaNext');
    if(prev)prev.disabled=!can;
    if(next)next.disabled=!can;
  }

  function step(direction=1){
    const root=qs('#featuredMediaCarousel');
    if(!root||!canScroll())return;
    const amount=stepSize();
    const max=Math.max(0,root.scrollWidth-root.clientWidth);
    if(direction>0&&root.scrollLeft>=max-amount*.45)root.scrollTo({left:0,behavior:'smooth'});
    else if(direction<0&&root.scrollLeft<=amount*.45)root.scrollTo({left:max,behavior:'smooth'});
    else root.scrollBy({left:direction*amount,behavior:'smooth'});
  }

  function bindCarouselControls(){
    const root=qs('#featuredMediaCarousel');
    if(!root)return;
    qs('#featuredMediaPrev')?.addEventListener('click',()=>step(-1));
    qs('#featuredMediaNext')?.addEventListener('click',()=>step(1));
    root.addEventListener('scroll',updateControls,{passive:true});
    window.addEventListener('resize',updateControls,{passive:true});
  }

  async function loadPublicMedia(){
    const root=qs('#featuredMediaCarousel');
    if(!root||typeof db==='undefined')return;
    try{
      const {data,error}=await db.from('marketplace_settings')
        .select('featured_youtube_urls,featured_youtube_url')
        .eq('id',true)
        .maybeSingle();
      if(error)throw error;
      const urls=normalizeUrls(data?.featured_youtube_urls);
      renderPublicMedia(urls.length?urls:(data?.featured_youtube_url?[data.featured_youtube_url]:[]));
    }catch(error){
      console.warn('featured media load',error);
      renderPublicMedia([]);
    }
  }

  function setAdminStatus(text,type=''){
    const el=qs('#featuredMediaAdminStatus');
    if(!el)return;
    el.textContent=text;
    el.className='media-settings-status'+(type?' '+type:'');
  }

  function formUrls(form){
    return [1,2,3,4,5].map(i=>String(form.elements[`youtube_url_${i}`]?.value||'').trim());
  }

  function populateForm(form,urls){
    const list=normalizeUrls(urls);
    for(let i=1;i<=5;i++)form.elements[`youtube_url_${i}`].value=list[i-1]||'';
  }

  async function loadAdminSetting(){
    const form=qs('#featuredMediaSettingsForm');
    if(!form||typeof db==='undefined')return;
    try{
      const {data,error}=await db.from('marketplace_settings')
        .select('featured_youtube_urls,featured_youtube_url')
        .eq('id',true)
        .maybeSingle();
      if(error)throw error;
      const urls=normalizeUrls(data?.featured_youtube_urls);
      const finalUrls=urls.length?urls:(data?.featured_youtube_url?[data.featured_youtube_url]:[]);
      populateForm(form,finalUrls);
      setAdminStatus(finalUrls.length?`${finalUrls.length}/5 videoclipuri active în carousel.`:'Carouselul folosește fallback-ul cu logo.');
    }catch(error){
      console.error('featured media admin load',error);
      setAdminStatus('Setarea media nu a putut fi încărcată.','error');
    }
  }

  async function saveAdminSetting(values,button){
    const raw=values.map(v=>String(v||'').trim());
    for(let i=0;i<raw.length;i++){
      if(raw[i]&&!youtubeId(raw[i])){
        setAdminStatus(`URL YouTube invalid la Video ${i+1}.`,'error');
        return false;
      }
    }
    const urls=raw.filter(Boolean).slice(0,5);
    const original=button?.textContent;
    if(button){button.disabled=true;button.textContent='Se salvează…';}
    try{
      const {data,error}=await db.from('marketplace_settings')
        .update({
          featured_youtube_urls:urls,
          featured_youtube_url:urls[0]||null,
          updated_at:new Date().toISOString()
        })
        .eq('id',true)
        .select('featured_youtube_urls')
        .single();
      if(error)throw error;
      const form=qs('#featuredMediaSettingsForm');
      if(form)populateForm(form,data?.featured_youtube_urls||urls);
      setAdminStatus(urls.length?`${urls.length}/5 videoclipuri salvate. Ordinea este cea afișată mai sus.`:'Toate videoclipurile au fost eliminate. Fallback-ul cu logo este activ.','success');
      return true;
    }catch(error){
      console.error('featured media admin save',error);
      setAdminStatus(error?.message||'Carouselul media nu a putut fi salvat.','error');
      return false;
    }finally{
      if(button){button.disabled=false;button.textContent=original||'Salvează carouselul';}
    }
  }

  function bindAdminMedia(){
    const form=qs('#featuredMediaSettingsForm');
    if(!form)return;
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      await saveAdminSetting(formUrls(form),qs('#saveFeaturedMedia'));
    });
    qs('#clearFeaturedMedia')?.addEventListener('click',async()=>{
      populateForm(form,[]);
      await saveAdminSetting([],qs('#clearFeaturedMedia'));
    });
    loadAdminSetting();
  }

  function init(){
    if(qs('#featuredMediaCarousel')){
      bindCarouselControls();
      loadPublicMedia();
    }
    if(qs('#featuredMediaSettingsForm'))bindAdminMedia();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
