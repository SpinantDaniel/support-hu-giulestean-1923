(()=>{
  'use strict';

  const CATEGORY_ICON_MAP={
    'Rapid & Colecții':{src:'/assets/category-icons/rapid-colectii.webp',cls:'cat-anim-scarf'},
    'Auto & Moto':{src:'/assets/category-icons/auto-moto.webp',cls:'cat-anim-car'},
    'Electronice':{src:'/assets/category-icons/electronice.webp',cls:'cat-anim-tech'},
    'Telefoane':{src:'/assets/category-icons/telefoane.webp',cls:'cat-anim-phone'},
    'Haine & Încălțăminte':{src:'/assets/category-icons/haine-incaltaminte.webp',cls:'cat-anim-fashion'},
    'Casă & Grădină':{src:'/assets/category-icons/casa-gradina.webp',cls:'cat-anim-home'},
    'Servicii':{src:'/assets/category-icons/servicii.webp',cls:'cat-anim-tools'},
    'Bilete & Deplasări':{src:'/assets/category-icons/bilete-deplasari.webp',cls:'cat-anim-travel'},
    'Imobiliare':{src:'/assets/category-icons/imobiliare.webp',cls:'cat-anim-realestate'},
    'Joburi':{src:'/assets/category-icons/joburi.webp',cls:'cat-anim-jobs'},
    'Donez / Caut':{src:'/assets/category-icons/donez-caut.webp',cls:'cat-anim-heart'},
    'Diverse':{src:'/assets/category-icons/diverse.webp',cls:'cat-anim-misc'}
  };

  function applyCategoryIcons(){
    document.querySelectorAll('#categoryGrid .category').forEach(card=>{
      const name=card.querySelector('b')?.textContent?.trim();
      const config=CATEGORY_ICON_MAP[name];
      if(!config)return;

      const current=card.querySelector('.icon');
      if(!current||current.classList.contains('category-modern-icon'))return;

      const shell=document.createElement('span');
      shell.className='icon category-modern-icon';
      shell.setAttribute('aria-hidden','true');

      const img=document.createElement('img');
      img.src=config.src;
      img.alt='';
      img.decoding='async';
      img.loading='lazy';
      img.className=config.cls;

      shell.appendChild(img);
      current.replaceWith(shell);
    });
  }

  function init(){
    applyCategoryIcons();
    const grid=document.getElementById('categoryGrid');
    if(!grid)return;
    const observer=new MutationObserver(applyCategoryIcons);
    observer.observe(grid,{childList:true,subtree:true});
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();
