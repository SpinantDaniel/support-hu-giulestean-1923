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

  const NICKNAME_MIN=3;
  const NICKNAME_MAX=14;
  const LISTING_LIMIT=15;

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

  function normalizedNickname(value=''){
    return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
  }

  function nicknameValidation(value,{allowReserved=false,legacyValue=''}={}){
    const clean=String(value||'').trim();
    const legacy=String(legacyValue||'').trim();
    if(legacy&&clean===legacy)return {ok:true,value:clean,legacy:true};
    if(clean.length<NICKNAME_MIN||clean.length>NICKNAME_MAX){
      return {ok:false,message:`Nickname-ul trebuie să aibă între ${NICKNAME_MIN} și ${NICKNAME_MAX} caractere.`};
    }
    if(normalizedNickname(clean).includes('admin')&&!allowReserved){
      return {ok:false,message:'Termenul „admin” este rezervat și nu poate fi folosit în nickname.'};
    }
    return {ok:true,value:clean};
  }

  function showNicknameError(message){
    if(typeof toast==='function')toast(message,'error');
    else alert(message);
  }

  function ensureNicknameHelp(input,text){
    if(!input||input.parentElement?.querySelector('.nickname-policy-help'))return;
    const help=document.createElement('small');
    help.className='nickname-policy-help';
    help.textContent=text;
    input.insertAdjacentElement('afterend',help);
  }

  function configureSignupNickname(){
    const form=document.getElementById('authForm');
    const input=form?.elements?.display_name;
    if(!form||!input)return;
    input.minLength=NICKNAME_MIN;
    input.maxLength=NICKNAME_MAX;
    ensureNicknameHelp(input,'3–14 caractere. „admin” este rezervat.');

    form.addEventListener('submit',event=>{
      const signupActive=document.getElementById('displayNameField')?.hidden===false;
      if(!signupActive)return;
      const result=nicknameValidation(input.value,{allowReserved:false});
      if(result.ok)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      input.focus();
      showNicknameError(result.message);
    },true);
  }

  function configureProfileNickname(){
    const form=document.getElementById('profileForm');
    const input=form?.elements?.display_name;
    if(!form||!input)return;
    ensureNicknameHelp(input,'La următoarea schimbare: 3–14 caractere. „admin” este rezervat.');

    document.getElementById('editProfileBtn')?.addEventListener('click',()=>{
      setTimeout(()=>{
        const current=String(input.value||'').trim();
        input.dataset.nicknameInitial=current;
        input.minLength=NICKNAME_MIN;
        input.maxLength=Math.max(NICKNAME_MAX,current.length);
      },0);
    });

    input.addEventListener('input',()=>{
      const initial=String(input.dataset.nicknameInitial||'').trim();
      const current=String(input.value||'').trim();
      if(current!==initial&&input.maxLength!==NICKNAME_MAX)input.maxLength=NICKNAME_MAX;
    });

    form.addEventListener('submit',event=>{
      const initial=String(input.dataset.nicknameInitial||'').trim();
      const result=nicknameValidation(input.value,{allowReserved:typeof isAdmin==='function'&&isAdmin(),legacyValue:initial});
      if(result.ok)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      input.focus();
      showNicknameError(result.message);
    },true);
  }

  function syncAccountNames(){
    const login=document.getElementById('loginBtn');
    const mobile=document.getElementById('mobileAccount');
    if(!login||!mobile)return;
    const loginName=[...login.querySelectorAll('span')].find(el=>!el.classList.contains('nav-avatar'));
    const mobileName=mobile.querySelector('.mobile-account-name');
    if(loginName){
      const full=loginName.textContent.trim();
      login.title=full;
      if(mobileName&&full){
        mobileName.textContent=full;
        mobileName.title=full;
      }
    }
  }

  function bindAccountNameSync(){
    const login=document.getElementById('loginBtn');
    const mobile=document.getElementById('mobileAccount');
    if(!login||!mobile)return;
    syncAccountNames();
    const observer=new MutationObserver(syncAccountNames);
    observer.observe(login,{childList:true,subtree:true,characterData:true});
  }

  function configureListingLimit(){
    const modal=document.getElementById('listingLimitModal');
    const desc=modal?.querySelector('.detail-desc');
    if(desc)desc.textContent=`Poți avea maximum ${LISTING_LIMIT} anunțuri active în același timp. Pentru a publica unul nou, șterge mai întâi un anunț pe care nu îl mai folosești din „Anunțurile mele”.`;

    if(typeof globalThis.openSell==='function'){
      globalThis.openSell=async function(){
        if(!requireActive())return;
        try{
          const count=await activeListingCount();
          if(count>=LISTING_LIMIT){openListingLimitModal();return;}
        }catch(error){
          console.warn('active listing limit precheck',error);
        }
        state.editingListingId=null;
        state.editReturnToAccount=false;
        prepareSellForm('new');
        $('#sellModal').showModal();
      };
    }
  }

  function init(){
    applyCategoryIcons();
    configureSignupNickname();
    configureProfileNickname();
    bindAccountNameSync();
    configureListingLimit();

    const grid=document.getElementById('categoryGrid');
    if(grid){
      const observer=new MutationObserver(applyCategoryIcons);
      observer.observe(grid,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();
