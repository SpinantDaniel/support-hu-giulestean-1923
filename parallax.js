(()=>{
  const root=document.documentElement;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let ticking=false;

  function update(){
    ticking=false;
    if(reduced?.matches){
      root.style.setProperty('--paper-parallax-y','0px');
      return;
    }
    const mobile=window.innerWidth<=650;
    const factor=mobile?0.055:0.085;
    const offset=-(window.scrollY||window.pageYOffset||0)*factor;
    root.style.setProperty('--paper-parallax-y',`${offset.toFixed(2)}px`);
  }

  function requestUpdate(){
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(update);
  }

  update();
  addEventListener('scroll',requestUpdate,{passive:true});
  addEventListener('resize',requestUpdate,{passive:true});
  reduced?.addEventListener?.('change',requestUpdate);
})();