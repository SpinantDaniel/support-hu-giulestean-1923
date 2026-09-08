(()=>{
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if(!isStandalone || !('ontouchstart' in window)) return;

  const THRESHOLD = 78;
  const CANCEL_X = 20;
  let startY = 0;
  let startX = 0;
  let pulling = false;
  let armed = false;
  let refreshing = false;

  const indicator = document.createElement('div');
  indicator.className = 'pwa-pull-refresh';
  indicator.setAttribute('aria-hidden','true');
  indicator.innerHTML = `
    <span class="pwa-pull-refresh-icon" aria-hidden="true">↓</span>
    <span class="pwa-pull-refresh-label">Trage pentru actualizare</span>
  `;
  document.body.appendChild(indicator);

  const icon = indicator.querySelector('.pwa-pull-refresh-icon');
  const label = indicator.querySelector('.pwa-pull-refresh-label');

  const blockedSelector = [
    'input','textarea','select','button','a','[contenteditable="true"]',
    '.home-news-carousel',
    '.listing-image-editor-grid',
    '.seller-listings-scroller',
    '.photo-lightbox-stage'
  ].join(',');

  function scrollTop(){
    return Math.max(
      window.scrollY || 0,
      document.documentElement?.scrollTop || 0,
      document.body?.scrollTop || 0
    );
  }

  function atTop(){
    return scrollTop() <= 1;
  }

  function resetIndicator(){
    indicator.classList.remove('visible','armed','refreshing','offline');
    indicator.style.setProperty('--pull-progress','0');
    icon.textContent='↓';
    label.textContent='Trage pentru actualizare';
    armed=false;
  }

  function cancelPull(){
    pulling=false;
    resetIndicator();
  }

  document.addEventListener('touchstart', e=>{
    if(refreshing || e.touches.length!==1 || !atTop()) return;
    if(document.querySelector('dialog[open]')) return;
    if(e.target.closest?.(blockedSelector)) return;

    const t=e.touches[0];
    startY=t.clientY;
    startX=t.clientX;
    pulling=true;
    armed=false;
  },{passive:true});

  document.addEventListener('touchmove',e=>{
    if(!pulling || refreshing || e.touches.length!==1) return;

    const t=e.touches[0];
    const dy=t.clientY-startY;
    const dx=t.clientX-startX;

    if(Math.abs(dx)>CANCEL_X && Math.abs(dx)>Math.abs(dy)*0.7){
      cancelPull();
      return;
    }

    if(dy<=0 || !atTop()){
      if(dy<-8) cancelPull();
      return;
    }

    // Standalone iOS has no dependable native pull-to-refresh.
    // Prevent rubber-band scrolling while our gesture owns the downward pull.
    e.preventDefault();

    const progress=Math.min(1.35,dy/THRESHOLD);
    indicator.style.setProperty('--pull-progress',String(progress));
    indicator.classList.add('visible');

    const nextArmed=dy>=THRESHOLD;
    if(nextArmed!==armed){
      armed=nextArmed;
      indicator.classList.toggle('armed',armed);
      icon.textContent=armed?'↻':'↓';
      label.textContent=armed?'Eliberează pentru actualizare':'Trage pentru actualizare';
    }
  },{passive:false});

  function finishPull(){
    if(!pulling || refreshing) return;
    pulling=false;

    if(!armed){
      resetIndicator();
      return;
    }

    if(navigator.onLine===false){
      indicator.classList.remove('armed');
      indicator.classList.add('visible','offline');
      icon.textContent='!';
      label.textContent='Fără conexiune';
      setTimeout(resetIndicator,1400);
      return;
    }

    refreshing=true;
    indicator.classList.remove('armed');
    indicator.classList.add('visible','refreshing');
    icon.textContent='↻';
    label.textContent='Se actualizează…';

    // Give the release animation a moment to become visible before reload.
    setTimeout(()=>window.location.reload(),220);
  }

  document.addEventListener('touchend',finishPull,{passive:true});
  document.addEventListener('touchcancel',cancelPull,{passive:true});

  window.addEventListener('pageshow',()=>{
    refreshing=false;
    pulling=false;
    resetIndicator();
  });
})();