
const SUPABASE_URL = 'https://bhqpixyiojthpfqnyhsh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_U2IRhs6K85S43ZRqKK5U8Q_HSknWMNY';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const state = { session:null, user:null, profile:null, userFlag:null, adminRole:'none', categories:[], listings:[], favorites:new Set(), homeNews:[], selectedListing:null, authMode:'login', accountTab:'listings', editingListingId:null, editReturnToAccount:false, marketPage:1, marketPageSize:150 };
const icons = { 'rapid-colectii':'⚑','auto-moto':'◉','electronice':'▣','telefoane':'▯','haine-incaltaminte':'♢','casa-gradina':'⌂','servicii':'✦','bilete':'▥','imobiliare':'▤','joburi':'▰','donez-caut':'♡','diverse':'•••' };
const conditionLabels = {new:'Nou',like_new:'Ca nou',used:'Utilizat',damaged:'Cu defecte',service:'Serviciu',not_applicable:'N/A'};

const listingImageEditor={items:[],originalPaths:[],dragKey:null,dragPointerId:null,dragBound:false};

function resetListingImageEditor(){
  listingImageEditor.items.forEach(item=>{if(item.kind==='new'&&item.url)URL.revokeObjectURL(item.url);});
  listingImageEditor.items=[];
  listingImageEditor.originalPaths=[];
  listingImageEditor.dragKey=null;
  listingImageEditor.dragPointerId=null;
  const root=$('#listingImageEditor');
  if(root)root.hidden=true;
  const grid=$('#listingImageEditorGrid');
  if(grid)grid.innerHTML='';
  const input=$('#sellForm [name=images]');
  if(input)input.value='';
}

function listingImageEditorHelp(){
  const n=listingImageEditor.items.length;
  const editing=!!state.editingListingId;
  const help=$('#imageHelp');
  if(help){
    help.textContent=editing
      ?`${n} din 8 fotografii în anunț. Poți adăuga încă maximum ${Math.max(0,8-n)}.`
      :(n?`${n} din 8 fotografii selectate.`:'JPG, PNG sau WEBP. Recomandat sub 5 MB / imagine.');
  }
  const count=$('#listingImageEditorCount');
  if(count)count.textContent=n?` · ${n}/8`:'';
  const add=$('#addMoreImagesBtn');
  if(add)add.hidden=n>=8;
}

async function initializeExistingListingImages(listing){
  resetListingImageEditor();

  let rows=[];
  const {data,error}=await db.from('listing_images')
    .select('storage_path,sort_order')
    .eq('listing_id',listing.id)
    .order('sort_order',{ascending:true});

  if(error){
    console.warn('listing image editor load',error);
    const paths=listing?.image_paths||[];
    rows=paths.map((storage_path,sort_order)=>({storage_path,sort_order}));
  }else{
    rows=data||[];
  }

  listingImageEditor.originalPaths=rows.map(row=>row.storage_path);
  listingImageEditor.items=rows.map(row=>({
    kind:'existing',
    key:`existing:${row.storage_path}`,
    path:row.storage_path,
    url:publicStorageUrl('listing-images',row.storage_path)
  }));

  renderListingImageEditor();
}
function addListingImageFiles(files){
  const incoming=(files||[]).filter(Boolean);
  if(!incoming.length)return;
  const room=8-listingImageEditor.items.length;
  if(room<=0){toast('Poți avea maximum 8 fotografii.','error');return;}
  const accepted=incoming.slice(0,room);
  for(const file of accepted){
    if(file.size>6*1024*1024){toast(`Imaginea ${file.name} depășește 6 MB.`,'error');continue;}
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){toast(`Formatul imaginii ${file.name} nu este acceptat.`,'error');continue;}
    listingImageEditor.items.push({
      kind:'new',
      key:`new:${crypto.randomUUID()}`,
      file,
      url:URL.createObjectURL(file)
    });
  }
  if(incoming.length>room)toast(`Au fost adăugate doar ${room} fotografii. Limita este 8.`,'error');
  renderListingImageEditor();
}

function removeListingImageEditorItem(key){
  const index=listingImageEditor.items.findIndex(item=>item.key===key);
  if(index<0)return;
  const [item]=listingImageEditor.items.splice(index,1);
  if(item.kind==='new'&&item.url)URL.revokeObjectURL(item.url);
  renderListingImageEditor();
}

function syncListingImageEditorOrderFromDom(){
  const grid=$('#listingImageEditorGrid');
  if(!grid)return;
  const order=$$('[data-image-editor-key]',grid).map(el=>el.dataset.imageEditorKey);
  const byKey=new Map(listingImageEditor.items.map(item=>[item.key,item]));
  listingImageEditor.items=order.map(key=>byKey.get(key)).filter(Boolean);
}

function draggedListingImageCard(){
  const grid=$('#listingImageEditorGrid');
  if(!grid||!listingImageEditor.dragKey)return null;
  return $$('.listing-image-edit-card',grid).find(card=>card.dataset.imageEditorKey===listingImageEditor.dragKey)||null;
}

function endListingImageDrag(){
  const card=draggedListingImageCard();
  if(card)card.classList.remove('dragging');
  const grid=$('#listingImageEditorGrid');
  if(grid)grid.classList.remove('is-dragging');
  listingImageEditor.dragKey=null;
  listingImageEditor.dragPointerId=null;
  syncListingImageEditorOrderFromDom();
  renderListingImageEditor();
}

function moveListingImageCardAtPointer(clientX){
  const grid=$('#listingImageEditorGrid');
  const dragged=draggedListingImageCard();
  if(!grid||!dragged)return;

  const gridRect=grid.getBoundingClientRect();

  // Auto-scroll while dragging near either horizontal edge.
  const edge=48;
  if(clientX<gridRect.left+edge)grid.scrollLeft-=16;
  else if(clientX>gridRect.right-edge)grid.scrollLeft+=16;

  const others=$$('.listing-image-edit-card',grid).filter(card=>card!==dragged);
  let before=null;
  for(const card of others){
    const rect=card.getBoundingClientRect();
    if(clientX<rect.left+rect.width/2){
      before=card;
      break;
    }
  }
  if(before)grid.insertBefore(dragged,before);
  else grid.appendChild(dragged);
}

function bindListingImageEditorDrag(){
  const grid=$('#listingImageEditorGrid');
  if(!grid||listingImageEditor.dragBound)return;
  listingImageEditor.dragBound=true;

  grid.addEventListener('pointerdown',e=>{
    const card=e.target.closest('.listing-image-edit-card');
    if(!card||e.target.closest('.listing-image-remove'))return;
    if(e.pointerType==='mouse'&&e.button!==0)return;

    listingImageEditor.dragKey=card.dataset.imageEditorKey;
    listingImageEditor.dragPointerId=e.pointerId;
    card.classList.add('dragging');
    grid.classList.add('is-dragging');
    e.preventDefault();
  });

  document.addEventListener('pointermove',e=>{
    if(listingImageEditor.dragPointerId==null||e.pointerId!==listingImageEditor.dragPointerId)return;
    e.preventDefault();
    moveListingImageCardAtPointer(e.clientX);
  },{passive:false});

  document.addEventListener('pointerup',e=>{
    if(listingImageEditor.dragPointerId==null||e.pointerId!==listingImageEditor.dragPointerId)return;
    endListingImageDrag();
  });

  document.addEventListener('pointercancel',e=>{
    if(listingImageEditor.dragPointerId==null||e.pointerId!==listingImageEditor.dragPointerId)return;
    endListingImageDrag();
  });
}
function renderListingImageEditor(){
  const root=$('#listingImageEditor'),grid=$('#listingImageEditorGrid');
  if(!root||!grid)return;
  root.hidden=!listingImageEditor.items.length&&!state.editingListingId;
  grid.innerHTML=listingImageEditor.items.map((item,index)=>`<div class="listing-image-edit-card" data-image-editor-key="${esc(item.key)}">
    <img src="${esc(item.url)}" alt="Fotografia ${index+1}" draggable="false">
    ${index===0?'<span class="listing-image-primary">Principală</span>':''}
    ${item.kind==='new'?'<span class="listing-image-new">Nouă</span>':''}
    <button type="button" class="listing-image-remove" data-remove-image="${esc(item.key)}" aria-label="Elimină fotografia">×</button>
    <span class="listing-image-drag-handle" aria-hidden="true">⋮⋮</span>
  </div>`).join('');
  $$('[data-remove-image]',grid).forEach(button=>button.onclick=e=>{
    e.stopPropagation();
    removeListingImageEditorItem(button.dataset.removeImage);
  });
  bindListingImageEditorDrag();
  listingImageEditorHelp();
}

function esc(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
function money(n,c='RON'){return new Intl.NumberFormat('ro-RO',{style:'currency',currency:c,maximumFractionDigits:c==='RON'?0:2}).format(Number(n||0));}
function since(iso){const d=(Date.now()-new Date(iso).getTime())/1000;if(d<60)return 'acum';if(d<3600)return `acum ${Math.floor(d/60)} min`;if(d<86400)return `acum ${Math.floor(d/3600)} h`;if(d<172800)return 'ieri';return new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'short'}).format(new Date(iso));}
function cleanPhone(v=''){return String(v).replace(/[^0-9+]/g,'');}
function whatsappPhone(v=''){let p=cleanPhone(v);if(p.startsWith('0'))p='40'+p.slice(1);if(p.startsWith('+'))p=p.slice(1);return p;}
function isAdmin(){return state.user?.app_metadata?.role === 'admin';}
function toast(text,type='info'){const el=$('#toast');el.textContent=text;el.dataset.type=type;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3200);}
function closeDialog(id){const d=document.getElementById(id);if(d?.open)d.close();}
function requireAuth(next){if(state.user){next?.();return true;}openAuth('login');toast('Ai nevoie de cont pentru această acțiune.');return false;}
function isSuspended(){const f=state.userFlag;if(!f?.suspended)return false;return !f.suspended_until||new Date(f.suspended_until).getTime()>Date.now();}
function suspensionText(){if(!isSuspended())return '';const until=state.userFlag?.suspended_until?new Intl.DateTimeFormat('ro-RO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(state.userFlag.suspended_until)):'o perioadă nedeterminată';return `Cont suspendat până la ${until}${state.userFlag?.suspension_reason?` — ${state.userFlag.suspension_reason}`:''}.`;}
function requireActive(next){if(!requireAuth())return false;if(isSuspended()){toast(suspensionText()||'Contul este suspendat temporar.','error');return false;}next?.();return true;}
async function loadAdminAccessRole(session=state.session){state.adminRole='none';if(!session?.access_token)return;try{const response=await fetch(`${SUPABASE_URL}/functions/v1/admin-access`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`},body:'{}'});const data=await response.json().catch(()=>({}));state.adminRole=response.ok?(data.role||'none'):'none';}catch(err){console.warn('admin access',err);state.adminRole='none';}}
function updateAdminAccessUI(){const zone=$('#adminAccessZone');if(!zone)return;const allowed=state.adminRole==='admin'||state.adminRole==='editor';zone.hidden=!allowed;if(!allowed)return;$('#adminAccessTitle').textContent=state.adminRole==='admin'?'Panou administrator':'Newsletter / Blog';$('#adminAccessText').textContent=state.adminRole==='admin'?'Moderare utilizatori și anunțuri, raportări, newsletter și editori autorizați.':'Ai acces doar la publicarea și administrarea propriilor articole.';}
function updateSuspensionUI(){const box=$('#accountSuspension');if(!box)return;box.hidden=!isSuspended();box.textContent=isSuspended()?suspensionText():'';}
function setBusy(button,busy,label){if(!button)return; if(busy){button.dataset.label=button.textContent;button.disabled=true;button.textContent=label||'Se procesează…';}else{button.disabled=false;button.textContent=button.dataset.label||button.textContent;}}

function publicStorageUrl(bucket,path){if(!path)return '';return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}`;}
function initials(name='Membru'){return String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'M';}
function avatarUrl(profile){return profile?.avatar_path?publicStorageUrl('profile-avatars',profile.avatar_path):'';}
function avatarHtml(profile,cls='avatar'){const name=profile?.display_name||'Membru',url=avatarUrl(profile);return url?`<span class="${cls} has-image"><img src="${esc(url)}" alt="${esc(name)}"></span>`:`<span class="${cls}">${esc(initials(name))}</span>`;}

async function shareContent(title,text,url){
  if(navigator.share){try{await navigator.share({title,text,url});return;}catch(e){if(e?.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(url);toast('Link copiat.');}catch(e){prompt('Copiază linkul:',url);}
}
function listingShareUrl(id){return `${location.origin}/?listing=${encodeURIComponent(id)}`;}
async function shareListing(id){
  const l=state.listings.find(x=>x.id===id);if(!l)return;
  await shareContent(l.title,`${l.title} · ${money(l.price,l.currency)} · Support Hub Giuleștean 1923`,listingShareUrl(id));
}



const photoGalleryState={images:[],index:0,title:'',bound:false,touchStartX:null};

function bindPhotoLightbox(){
  if(photoGalleryState.bound)return;
  const dialog=$('#photoLightbox'),stage=$('#photoLightboxStage');
  if(!dialog||!stage)return;
  photoGalleryState.bound=true;

  $('#photoLightboxClose').onclick=()=>closePhotoGallery();
  $('#photoLightboxPrev').onclick=()=>stepPhotoGallery(-1);
  $('#photoLightboxNext').onclick=()=>stepPhotoGallery(1);

  dialog.addEventListener('click',e=>{
    if(e.target===dialog)closePhotoGallery();
  });

  document.addEventListener('keydown',e=>{
    if(!dialog.open)return;
    if(e.key==='ArrowLeft'){e.preventDefault();stepPhotoGallery(-1);}
    else if(e.key==='ArrowRight'){e.preventDefault();stepPhotoGallery(1);}
    else if(e.key==='Escape'){e.preventDefault();closePhotoGallery();}
  });

  stage.addEventListener('touchstart',e=>{
    photoGalleryState.touchStartX=e.changedTouches?.[0]?.clientX??null;
  },{passive:true});
  stage.addEventListener('touchend',e=>{
    const start=photoGalleryState.touchStartX;
    const end=e.changedTouches?.[0]?.clientX;
    photoGalleryState.touchStartX=null;
    if(start==null||end==null)return;
    const delta=end-start;
    if(Math.abs(delta)>45)stepPhotoGallery(delta<0?1:-1);
  },{passive:true});
}

function openPhotoGallery(images,startIndex=0,title='Fotografie anunț'){
  const clean=(images||[]).filter(Boolean);
  if(!clean.length)return;
  bindPhotoLightbox();
  photoGalleryState.images=clean;
  photoGalleryState.index=Math.max(0,Math.min(Number(startIndex)||0,clean.length-1));
  photoGalleryState.title=title||'Fotografie anunț';
  renderPhotoGallery();
  const dialog=$('#photoLightbox');
  if(dialog&&!dialog.open)dialog.showModal();
}

function renderPhotoGallery(){
  const image=$('#photoLightboxImage');
  const dialog=$('#photoLightbox');
  if(!image||!dialog||!photoGalleryState.images.length)return;
  const url=photoGalleryState.images[photoGalleryState.index];
  image.classList.add('is-loading');
  image.removeAttribute('data-orientation');
  image.onload=()=>{
    image.classList.remove('is-loading');
    image.dataset.orientation=image.naturalHeight>image.naturalWidth?'portrait':(image.naturalWidth>image.naturalHeight?'landscape':'square');
    $('#photoLightboxStage')?.setAttribute('data-orientation',image.dataset.orientation);
  };
  image.src=url;
  image.alt=`${photoGalleryState.title} — fotografia ${photoGalleryState.index+1}`;
  $('#photoLightboxTitle').textContent=photoGalleryState.title;
  $('#photoLightboxCounter').textContent=`${photoGalleryState.index+1} / ${photoGalleryState.images.length}`;
  const multiple=photoGalleryState.images.length>1;
  $('#photoLightboxPrev').hidden=!multiple;
  $('#photoLightboxNext').hidden=!multiple;
}

function stepPhotoGallery(direction){
  const n=photoGalleryState.images.length;
  if(n<2)return;
  photoGalleryState.index=(photoGalleryState.index+direction+n)%n;
  renderPhotoGallery();
}

function closePhotoGallery(){
  const dialog=$('#photoLightbox');
  if(dialog?.open)dialog.close();
}


let homeNewsAutoplayTimer=null;
let homeNewsResumeTimer=null;
let homeNewsRefreshTimer=null;
let homeNewsBound=false;
let homeNewsLoading=false;

function homeNewsImageUrl(path){return path?publicStorageUrl('blog-images',path):'';}
function homeNewsDate(iso){return new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(iso));}
function homeNewsSignature(rows){return rows.map(x=>`${x.id}:${x.updated_at||x.published_at||''}`).join('|');}

async function loadHomeNewsCarousel(silent=false){
  if(homeNewsLoading)return;
  const root=$('#homeNewsCarousel');if(!root)return;
  homeNewsLoading=true;
  try{
    const {data,error}=await db.from('blog_posts')
      .select('id,title,slug,excerpt,image_path,author_name,published_at,updated_at')
      .eq('status','published')
      .order('published_at',{ascending:false})
      .limit(10);
    if(error)throw error;
    const rows=data||[];
    const changed=homeNewsSignature(rows)!==homeNewsSignature(state.homeNews);
    state.homeNews=rows;
    if(changed||!root.querySelector('.home-news-card'))renderHomeNewsCarousel();
  }catch(error){
    console.warn('home news carousel',error);
    if(!silent)root.innerHTML='<div class="home-news-empty">Noutățile nu sunt disponibile momentan.</div>';
  }finally{homeNewsLoading=false;}
}

function renderHomeNewsCarousel(){
  const root=$('#homeNewsCarousel');if(!root)return;
  if(!state.homeNews.length){root.innerHTML='<div class="home-news-empty">Nu există încă articole publicate.</div>';stopHomeNewsAutoplay();return;}
  root.innerHTML=state.homeNews.map(p=>{
    const image=homeNewsImageUrl(p.image_path);
    return `<a class="home-news-card" href="/newsletter.html?post=${encodeURIComponent(p.slug)}" aria-label="${esc(p.title)}">
      <div class="home-news-image">${image?`<img src="${esc(image)}" alt="${esc(p.title)}" loading="lazy">`:'<span>SH</span>'}</div>
      <div class="home-news-body"><div class="home-news-meta">${esc(p.author_name||'Support Hub')} · ${homeNewsDate(p.published_at)}</div><h3>${esc(p.title)}</h3><p>${esc(p.excerpt||'Deschide articolul pentru a citi mai mult.')}</p></div>
    </a>`;
  }).join('');
  root.scrollTo({left:0,behavior:'auto'});
  updateHomeNewsControls();
  bindHomeNewsCarousel();
  startHomeNewsAutoplay();
}

function homeNewsStepSize(){
  const root=$('#homeNewsCarousel');const card=root?.querySelector('.home-news-card');if(!root||!card)return 0;
  const styles=getComputedStyle(root);const gap=parseFloat(styles.columnGap||styles.gap||'0')||0;
  return card.getBoundingClientRect().width+gap;
}
function homeNewsCanScroll(){const root=$('#homeNewsCarousel');return !!root&&root.scrollWidth>root.clientWidth+4;}
function updateHomeNewsControls(){const can=homeNewsCanScroll();const prev=$('#homeNewsPrev'),next=$('#homeNewsNext');if(prev)prev.disabled=!can;if(next)next.disabled=!can;}
function stepHomeNews(direction=1){
  const root=$('#homeNewsCarousel');if(!root||!homeNewsCanScroll())return;
  const step=homeNewsStepSize();const max=Math.max(0,root.scrollWidth-root.clientWidth);
  if(direction>0&&root.scrollLeft>=max-step*.45)root.scrollTo({left:0,behavior:'smooth'});
  else if(direction<0&&root.scrollLeft<=step*.45)root.scrollTo({left:max,behavior:'smooth'});
  else root.scrollBy({left:direction*step,behavior:'smooth'});
}
function stopHomeNewsAutoplay(){clearInterval(homeNewsAutoplayTimer);homeNewsAutoplayTimer=null;}
function startHomeNewsAutoplay(){stopHomeNewsAutoplay();if(!homeNewsCanScroll()||document.hidden)return;homeNewsAutoplayTimer=setInterval(()=>stepHomeNews(1),5000);}
function scheduleHomeNewsAutoplay(delay=5000){stopHomeNewsAutoplay();clearTimeout(homeNewsResumeTimer);homeNewsResumeTimer=setTimeout(startHomeNewsAutoplay,delay);}
function userTouchedHomeNews(){stopHomeNewsAutoplay();clearTimeout(homeNewsResumeTimer);}
function userReleasedHomeNews(){scheduleHomeNewsAutoplay(5000);}
function bindHomeNewsCarousel(){
  if(homeNewsBound)return;homeNewsBound=true;
  const root=$('#homeNewsCarousel'),prev=$('#homeNewsPrev'),next=$('#homeNewsNext');if(!root)return;
  prev?.addEventListener('click',()=>{userTouchedHomeNews();stepHomeNews(-1);userReleasedHomeNews();});
  next?.addEventListener('click',()=>{userTouchedHomeNews();stepHomeNews(1);userReleasedHomeNews();});
  root.addEventListener('pointerdown',userTouchedHomeNews,{passive:true});
  root.addEventListener('pointerup',userReleasedHomeNews,{passive:true});
  root.addEventListener('pointercancel',userReleasedHomeNews,{passive:true});
  root.addEventListener('touchstart',userTouchedHomeNews,{passive:true});
  root.addEventListener('touchend',userReleasedHomeNews,{passive:true});
  root.addEventListener('wheel',()=>{userTouchedHomeNews();userReleasedHomeNews();},{passive:true});
  root.addEventListener('mouseenter',userTouchedHomeNews);
  root.addEventListener('mouseleave',userReleasedHomeNews);
  root.addEventListener('focusin',userTouchedHomeNews);
  root.addEventListener('focusout',userReleasedHomeNews);
  window.addEventListener('resize',()=>{updateHomeNewsControls();scheduleHomeNewsAutoplay(1200);},{passive:true});
  document.addEventListener('visibilitychange',()=>document.hidden?stopHomeNewsAutoplay():scheduleHomeNewsAutoplay(1200));
}
function initHomeNewsRefresh(){clearInterval(homeNewsRefreshTimer);homeNewsRefreshTimer=setInterval(()=>loadHomeNewsCarousel(true),60000);}

async function init(){
  bindStaticEvents();
  showListingSkeletons();
  const {data:{session}}=await db.auth.getSession();
  await applySession(session);
  await Promise.all([loadCategories(), loadListings(), loadHomeNewsCarousel()]);
  if(state.user) await loadFavorites();
  renderAll();
  initHomeNewsRefresh();
  const sharedListingId=new URLSearchParams(location.search).get('listing');
  if(sharedListingId&&state.listings.some(l=>l.id===sharedListingId))setTimeout(()=>openDetail(sharedListingId),80);
  db.auth.onAuthStateChange(async (event, session)=>{await applySession(session);await loadListings();if(state.user)await loadFavorites();else state.favorites.clear();renderAll()});
}

async function applySession(session){
  state.session=session;state.user=session?.user||null;state.profile=null;state.userFlag=null;state.adminRole='none';
  if(state.user){
    const [profileRes,flagRes]=await Promise.all([
      db.from('profiles').select('*').eq('id',state.user.id).maybeSingle(),
      db.from('user_flags').select('suspended,suspended_until,suspension_reason,verified').eq('user_id',state.user.id).maybeSingle()
    ]);
    state.profile=profileRes.data||null;state.userFlag=flagRes.data||null;
    await loadAdminAccessRole(session);
  }
  updateAccountButtons();updateAdminAccessUI();updateSuspensionUI();
}

function updateAccountButtons(){const name=state.profile?.display_name||state.user?.email?.split('@')[0]||'Cont';if(state.user){$('#loginBtn').innerHTML=`${avatarHtml(state.profile,'nav-avatar')}<span>${esc(name)}</span>`;$('#mobileAccount').innerHTML=`${avatarHtml(state.profile,'mobile-avatar')}<span class="mobile-account-name">${esc(name.slice(0,10))}</span>`;}else{$('#loginBtn').textContent='Intră în cont';$('#mobileAccount').innerHTML='<span>○</span>Cont';}}

async function loadCategories(){
  const {data,error}=await db.from('categories').select('id,slug,name,icon,sort_order').order('sort_order');
  if(error){console.error(error);toast('Nu am putut încărca categoriile.','error');return;}
  state.categories=data||[];renderCategories();
}

async function loadListings(){
  const {data,error}=await db.from('listings').select('id,seller_id,category_id,title,description,price,currency,condition,location,negotiable,state,created_at,updated_at');
  if(error){console.error(error);$('#statusBanner').hidden=false;$('#statusBanner').textContent='Conexiunea la marketplace nu este disponibilă momentan.';state.listings=[];return;}
  const list=data||[];
  const ids=list.map(x=>x.id);
  let imageRows=[];
  if(ids.length){const r=await db.from('listing_images').select('listing_id,storage_path,sort_order').in('listing_id',ids).order('sort_order');imageRows=r.data||[];}
  const byListing={}; imageRows.forEach(i=>(byListing[i.listing_id]??=[]).push(i));
  state.listings=list.map(l=>({...l,images:(byListing[l.id]||[]).map(i=>publicStorageUrl('listing-images',i.storage_path)),image_paths:(byListing[l.id]||[]).map(i=>i.storage_path)}));
  $('#statusBanner').hidden=true;
}

async function loadFavorites(){
  if(!state.user)return;
  const {data,error}=await db.from('favorites').select('listing_id').eq('user_id',state.user.id);
  if(error){console.error(error);return;}state.favorites=new Set((data||[]).map(x=>x.listing_id));
}

function syncCategorySelection(){
  const selected=$('#categoryFilter')?.value||'all';
  $$('.category').forEach(button=>{
    const active=button.dataset.cat===selected;
    button.classList.toggle('is-selected',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
}

function resetMarketPage(){state.marketPage=1;}

function renderCategories(){
  const grid=$('#categoryGrid');
  const previous=$('#categoryFilter')?.value||'all';

  grid.innerHTML=state.categories.map(c=>`<button class="category" data-cat="${c.id}" aria-pressed="false"><span class="icon">${icons[c.slug]||c.icon||'◈'}</span><b>${esc(c.name)}</b><small>Vezi anunțurile</small></button>`).join('');

  const opts=state.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#categoryFilter').innerHTML='<option value="all">Toate categoriile</option>'+opts;
  if(previous==='all'||state.categories.some(c=>c.id===previous))$('#categoryFilter').value=previous;
  $('#sellCategory').innerHTML='<option value="">Alege categoria</option>'+opts;

  $$('.category').forEach(b=>b.onclick=()=>{
    $('#categoryFilter').value=b.dataset.cat;
    resetMarketPage();
    syncCategorySelection();
    renderListings();
    $('#anunturi').scrollIntoView({behavior:'smooth'});
  });

  syncCategorySelection();
}

function filteredListings(){
  const q=$('#searchInput').value.trim().toLowerCase();const cat=$('#categoryFilter').value;const sort=$('#sortSelect').value;
  let rows=state.listings.filter(l=>(cat==='all'||l.category_id===cat)&&(!q||`${l.title} ${l.description} ${l.location}`.toLowerCase().includes(q)));
  if(sort==='low')rows.sort((a,b)=>Number(a.price)-Number(b.price));else if(sort==='high')rows.sort((a,b)=>Number(b.price)-Number(a.price));else rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  return rows;
}

function paginationButton(label,target,{disabled=false,current=false,title='' }={}){
  return `<button type="button" class="page-control${current?' current':''}" data-market-page="${target}" ${disabled?'disabled':''} ${current?'aria-current="page"':''} title="${esc(title)}">${label}</button>`;
}

function renderMarketPagination(totalRows){
  const pageSize=state.marketPageSize;
  const totalPages=Math.max(1,Math.ceil(totalRows/pageSize));
  state.marketPage=Math.min(Math.max(1,state.marketPage),totalPages);

  const navs=[$('#marketPaginationTop'),$('#marketPaginationBottom')].filter(Boolean);
  if(totalPages<=1){
    navs.forEach(nav=>{nav.hidden=true;nav.innerHTML='';});
    return;
  }

  const current=state.marketPage;
  const groupStart=Math.floor((current-1)/5)*5+1;
  const groupEnd=Math.min(totalPages,groupStart+4);
  const firstItem=(current-1)*pageSize+1;
  const lastItem=Math.min(totalRows,current*pageSize);

  const pages=[];
  for(let p=groupStart;p<=groupEnd;p++)pages.push(paginationButton(String(p),p,{current:p===current,title:`Pagina ${p}`}));

  const html=`<div class="pagination-summary">${firstItem}–${lastItem} din ${totalRows} anunțuri</div>
    <div class="pagination-controls">
      ${paginationButton('⇤',1,{disabled:current===1,title:'Prima pagină'})}
      ${paginationButton('«',Math.max(1,current-5),{disabled:current===1,title:'Înapoi 5 pagini'})}
      ${paginationButton('←',Math.max(1,current-1),{disabled:current===1,title:'Pagina anterioară'})}
      <span class="pagination-pages">${pages.join('')}</span>
      ${paginationButton('→',Math.min(totalPages,current+1),{disabled:current===totalPages,title:'Pagina următoare'})}
      ${paginationButton('»',Math.min(totalPages,current+5),{disabled:current===totalPages,title:'Înainte 5 pagini'})}
      ${paginationButton('⇥',totalPages,{disabled:current===totalPages,title:'Ultima pagină'})}
    </div>`;

  navs.forEach(nav=>{
    nav.hidden=false;
    nav.innerHTML=html;
    $$('[data-market-page]',nav).forEach(button=>button.onclick=()=>{
      if(button.disabled)return;
      const target=Number(button.dataset.marketPage);
      if(!Number.isFinite(target)||target===state.marketPage)return;
      state.marketPage=target;
      renderListings();
      requestAnimationFrame(()=>$('#marketPaginationTop')?.scrollIntoView({behavior:'smooth',block:'start'}));
    });
  });
}

function renderListings(){
  const rows=filteredListings();
  const totalPages=Math.max(1,Math.ceil(rows.length/state.marketPageSize));
  state.marketPage=Math.min(Math.max(1,state.marketPage),totalPages);

  const start=(state.marketPage-1)*state.marketPageSize;
  const pageRows=rows.slice(start,start+state.marketPageSize);

  $('#emptyState').hidden=rows.length>0;
  $('#listingGrid').innerHTML=pageRows.map(cardHtml).join('');
  bindListingCards($('#listingGrid'));
  renderMarketPagination(rows.length);
  syncCategorySelection();
}

function cardHtml(l){
  const cat=state.categories.find(c=>c.id===l.category_id);const own=state.user?.id===l.seller_id;const image=l.images?.[0];
  return `<article class="listing-card" data-id="${l.id}">
    <button class="fav ${state.favorites.has(l.id)?'active':''}" data-fav="${l.id}" aria-label="Favorite">${state.favorites.has(l.id)?'♥':'♡'}</button>
    <button class="listing-share" data-share-listing="${l.id}" aria-label="Distribuie anunțul">↗</button>
    <div class="listing-image ${image?'has-photo':''}" ${image?`style="--listing-photo:url(\'${esc(image)}\')"`:''}><span class="badge">${esc(conditionLabels[l.condition]||l.condition)}</span>${image?`<img src="${esc(image)}" alt="${esc(l.title)}" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.remove('has-photo')">`:`<span class="placeholder-icon">${icons[cat?.slug]||'◈'}</span>`}${own?'<span class="owner-badge">Al tău</span>':''}</div>
    <div class="listing-body"><h3 class="listing-title">${esc(l.title)}</h3><div class="price">${money(l.price,l.currency)}</div><div class="listing-meta"><span>${esc(l.location)}</span><span>${since(l.created_at)}</span></div></div>
  </article>`;
}

function bindListingCards(root=document){
  $$('[data-fav]',root).forEach(b=>b.onclick=async e=>{e.stopPropagation();await toggleFavorite(b.dataset.fav);});
  $$('[data-share-listing]',root).forEach(b=>b.onclick=async e=>{e.stopPropagation();await shareListing(b.dataset.shareListing);});
  $$('.listing-card',root).forEach(c=>c.onclick=()=>openDetail(c.dataset.id));
}

async function toggleFavorite(listingId){
  if(!requireActive())return;
  if(state.favorites.has(listingId)){const {error}=await db.from('favorites').delete().eq('user_id',state.user.id).eq('listing_id',listingId);if(error)return toast(error.message,'error');state.favorites.delete(listingId);}
  else{const {error}=await db.from('favorites').insert({user_id:state.user.id,listing_id:listingId});if(error)return toast(error.message,'error');state.favorites.add(listingId);}
  renderListings();if($('#accountModal').open&&state.accountTab==='favorites')renderAccount();
}

function ratingCountText(count){
  const n=Number(count||0);
  return `${n} ${n===1?'recenzie':'recenzii'}`;
}

function sellerRatingHtml(sellerId,stats=null,myRating=0,own=false){
  const avg=Number(stats?.average_rating||0);
  const count=Number(stats?.review_count||0);
  const rounded=Math.max(0,Math.min(5,Math.round(avg)));
  const averageLabel=count?new Intl.NumberFormat('ro-RO',{maximumFractionDigits:1}).format(avg):'0';
  const stars=Array.from({length:5},(_,i)=>{
    const value=i+1;
    const filled=value<=rounded;
    const selected=Number(myRating)===value;
    const glyph=filled?'★':'☆';
    if(own){
      return `<span class="seller-rating-star ${filled?'filled':''}" aria-hidden="true">${glyph}</span>`;
    }
    return `<button type="button" class="seller-rating-star rating-action ${filled?'filled':''} ${selected?'selected':''}" data-rate-seller="${value}" aria-label="Acordă ${value} ${value===1?'stea':'stele'}" aria-pressed="${selected?'true':'false'}" title="Acordă ${value}/5">${glyph}</button>`;
  }).join('');

  return `<div class="seller-rating-block" id="sellerRatingBlock" data-seller-id="${esc(sellerId)}">
    <div class="seller-rating-row" title="Media evaluărilor: ${esc(averageLabel)} din 5">
      <div class="seller-rating-stars" aria-label="Evaluare medie ${esc(averageLabel)} din 5">${stars}</div>
      <span class="seller-rating-count">— ${ratingCountText(count)}</span>
    </div>
    ${own?'':`<small class="seller-rating-hint">${state.user?(myRating?`Evaluarea ta: ${myRating}/5 · poți apăsa altă stea pentru a o modifica.`:'Apasă pe o stea pentru a evalua utilizatorul.'):'Intră în cont pentru a acorda o evaluare.'}</small>`}
  </div>`;
}

async function getSellerRatingData(sellerId,own=false){
  const statsPromise=db.from('seller_rating_stats')
    .select('average_rating,review_count')
    .eq('seller_id',sellerId)
    .maybeSingle();

  const minePromise=state.user&&!own
    ?db.from('user_ratings').select('rating')
      .eq('reviewer_id',state.user.id)
      .eq('seller_id',sellerId)
      .maybeSingle()
    :Promise.resolve({data:null,error:null});

  const [statsRes,mineRes]=await Promise.all([statsPromise,minePromise]);
  if(statsRes.error)console.warn('seller rating stats',statsRes.error);
  if(mineRes.error)console.warn('my seller rating',mineRes.error);

  return {
    stats:statsRes.data||{average_rating:0,review_count:0},
    myRating:Number(mineRes.data?.rating||0)
  };
}

function bindSellerRatingControls(sellerId){
  const block=$('#sellerRatingBlock');
  if(!block)return;
  $$('[data-rate-seller]',block).forEach(button=>{
    button.onclick=()=>submitSellerRating(sellerId,Number(button.dataset.rateSeller));
  });
}

async function refreshSellerRatingBlock(sellerId){
  const block=$('#sellerRatingBlock');
  if(!block)return;
  const own=state.user?.id===sellerId;
  const {stats,myRating}=await getSellerRatingData(sellerId,own);
  block.outerHTML=sellerRatingHtml(sellerId,stats,myRating,own);
  bindSellerRatingControls(sellerId);
}

async function submitSellerRating(sellerId,rating){
  if(!requireActive())return;
  if(state.user.id===sellerId)return toast('Nu îți poți evalua propriul profil.','error');
  const value=Math.max(1,Math.min(5,Number(rating)||0));
  const {error}=await db.from('user_ratings').upsert({
    reviewer_id:state.user.id,
    seller_id:sellerId,
    rating:value
  },{onConflict:'reviewer_id,seller_id'});
  if(error){
    console.error(error);
    return toast('Evaluarea nu a putut fi salvată. Încearcă din nou.','error');
  }
  await refreshSellerRatingBlock(sellerId);
  toast(`Evaluarea ta de ${value}/5 a fost salvată.`);
}

function sellerOtherListingCardHtml(l){
  const cat=state.categories.find(c=>c.id===l.category_id);
  const image=l.images?.[0];
  return `<button type="button" class="seller-other-card" data-other-listing="${l.id}">
    <div class="seller-other-image ${image?'has-photo':''}">
      <span class="badge">${esc(conditionLabels[l.condition]||l.condition)}</span>
      ${image?`<img src="${esc(image)}" alt="${esc(l.title)}" loading="lazy">`:`<span class="placeholder-icon">${icons[cat?.slug]||'◈'}</span>`}
    </div>
    <div class="seller-other-body">
      <h3>${esc(l.title)}</h3>
      <strong>${money(l.price,l.currency)}</strong>
      <span>${esc(l.location)} · ${since(l.created_at)}</span>
    </div>
  </button>`;
}

function openSellerListings(sellerId,sellerName,currentListingId){
  const rows=state.listings
    .filter(x=>x.seller_id===sellerId&&x.state==='active'&&x.id!==currentListingId)
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  $('#sellerListingsTitle').textContent=`Anunțurile lui ${sellerName||'acestui utilizator'}`;
  $('#sellerListingsSubtitle').textContent=rows.length
    ?`${rows.length} ${rows.length===1?'anunț activ':'anunțuri active'}`
    :'Nu există alte anunțuri active momentan.';

  const root=$('#sellerListingsScroller');
  root.innerHTML=rows.length
    ?rows.map(sellerOtherListingCardHtml).join('')
    :'<div class="empty compact seller-listings-empty"><b>Niciun alt anunț activ.</b><span>Revino mai târziu pentru alte produse publicate de acest utilizator.</span></div>';

  $$('[data-other-listing]',root).forEach(card=>card.onclick=()=>{
    const nextId=card.dataset.otherListing;
    closeDialog('sellerListingsModal');
    closeDialog('detailModal');
    setTimeout(()=>openDetail(nextId),50);
  });

  const dialog=$('#sellerListingsModal');
  if(dialog&&!dialog.open)dialog.showModal();
}

async function openDetail(id){
  const l=state.listings.find(x=>x.id===id);if(!l)return;state.selectedListing=l;
  const own=state.user?.id===l.seller_id;

  const [{data:profile},{data:flag},ratingData]=await Promise.all([
    db.from('profiles').select('display_name,location,bio,avatar_path,created_at,contact_incognito').eq('id',l.seller_id).maybeSingle(),
    db.from('user_flags').select('verified').eq('user_id',l.seller_id).maybeSingle(),
    getSellerRatingData(l.seller_id,own)
  ]);

  const cat=state.categories.find(c=>c.id===l.category_id);
  const photos=l.images?.length?`<div class="photo-grid">${l.images.map((u,i)=>`<button class="photo-thumb ${i===0?'main':''}" data-photo-index="${i}" aria-label="Deschide fotografia ${i+1}"><img src="${esc(u)}" alt="Fotografie ${i+1} — ${esc(l.title)}" loading="lazy"></button>`).join('')}</div>`:`<div class="detail-photo placeholder">${icons[cat?.slug]||'◈'}</div>`;

  const sellerName=profile?.display_name||'Membru';
  const ratingBlock=sellerRatingHtml(l.seller_id,ratingData.stats,ratingData.myRating,own);
  const directContactControl=profile?.contact_incognito
    ?'<div class="seller-incognito-note"><b>Incognito activ</b><span>Telefonul și WhatsApp-ul sunt ascunse. Folosește Mesaje.</span></div>'
    :'<button class="ghost" id="detailContactBtn">Telefon / WhatsApp</button>';

  $('#detailContent').innerHTML=`<div class="modal-head"><div><span class="kicker">${esc(cat?.name||'ANUNȚ')}</span><h2>${esc(l.title)}</h2></div><button class="close" type="button" data-close="detailModal">×</button></div>
    ${photos}<div class="detail-layout"><div><p class="detail-price">${money(l.price,l.currency)} ${l.negotiable?'<small>negociabil</small>':''}</p><p class="detail-desc">${esc(l.description).replace(/\n/g,'<br>')}</p><p class="listing-meta"><span>${esc(l.location)} • ${esc(conditionLabels[l.condition]||l.condition)}</span><span>${since(l.created_at)}</span></p></div>
    <aside class="seller-box"><div class="seller-profile">${avatarHtml(profile,'seller-avatar')}<div><span class="kicker">${own?'ANUNȚUL TĂU':'VÂNZĂTOR'}</span><h3>${esc(sellerName)}${flag?.verified?' <span class="verified">✓</span>':''}</h3></div></div><p>${profile?.location?`${esc(profile.location)} • `:''}${profile?.created_at?`Membru din ${new Intl.DateTimeFormat('ro-RO',{month:'long',year:'numeric'}).format(new Date(profile.created_at))}`:''}</p>${profile?.bio?`<p class="seller-bio">${esc(profile.bio)}</p>`:''}${ratingBlock}<button class="ghost seller-other-listings-btn" id="sellerOtherListingsBtn">Alte Anunțuri</button>${own?'<button class="ghost" id="detailEditBtn">Editează anunțul</button><button class="ghost detail-share" id="detailShareBtn">↗ Distribuie anunțul</button><button class="danger detail-delete" id="detailDeleteBtn">Șterge anunțul</button>':`<button class="primary" id="detailMessageBtn">Trimite mesaj</button>${directContactControl}<button class="ghost detail-share" id="detailShareBtn">↗ Distribuie anunțul</button><button class="report-btn" id="detailReportBtn">Raportează anunțul</button>`}</aside></div>`;

  bindCloseButtons($('#detailContent'));
  bindSellerRatingControls(l.seller_id);
  $('#sellerOtherListingsBtn').onclick=()=>openSellerListings(l.seller_id,sellerName,l.id);

  if(own){
    $('#detailEditBtn').onclick=()=>{closeDialog('detailModal');openEditListing(l.id,false);};
    $('#detailDeleteBtn').onclick=()=>deleteListing(l.id,true);
  }else{
    $('#detailMessageBtn').onclick=()=>openMessage(l);
    const contactBtn=$('#detailContactBtn');
    if(contactBtn)contactBtn.onclick=()=>showContact(l);
    $('#detailReportBtn').onclick=()=>reportListing(l);
  }

  $('#detailShareBtn').onclick=()=>shareListing(l.id);
  $$('.photo-thumb',$('#detailContent')).forEach(b=>b.onclick=()=>openPhotoGallery(l.images,Number(b.dataset.photoIndex)||0,l.title));
  $('#detailModal').showModal();
}

async function showContact(l){
  if(!requireActive())return;

  const [{data:privacy,error:privacyError},{data,error}]=await Promise.all([
    db.from('profiles').select('contact_incognito').eq('id',l.seller_id).maybeSingle(),
    db.from('listing_contacts').select('phone,whatsapp').eq('listing_id',l.id).maybeSingle()
  ]);

  if(privacyError)console.warn('contact privacy check',privacyError);
  if(privacy?.contact_incognito){
    return toast('Vânzătorul a activat modul Incognito. Contactează-l prin Mesaje.');
  }
  if(error){
    console.error(error);
    return toast('Nu am putut încărca datele de contact.','error');
  }
  if(!data)return toast('Datele de contact direct nu sunt disponibile.');

  const buttons=[];
  if(data.phone)buttons.push(`<a class="primary link-button" href="tel:${esc(cleanPhone(data.phone))}">Sună ${esc(data.phone)}</a>`);
  if(data.whatsapp)buttons.push(`<a class="whatsapp link-button" target="_blank" rel="noopener" href="https://wa.me/${esc(whatsappPhone(data.whatsapp))}">WhatsApp</a>`);

  const box=$('.seller-box',$('#detailContent'));
  $('.contact-reveal',box)?.remove();
  box.insertAdjacentHTML('beforeend',`<div class="contact-reveal">${buttons.join('')}</div>`);
}

function openMessage(l){
  if(!requireActive())return;if(l.seller_id===state.user.id)return toast('Nu îți poți trimite mesaj propriului anunț.');
  $('#messageListingTitle').textContent=l.title;$('#messageForm [name=listing_id]').value=l.id;$('#messageForm [name=seller_id]').value=l.seller_id;$('#messageForm [name=body]').value='Salut! Mai este disponibil?';$('#messageModal').showModal();
}

async function sendMessage(e){
  e.preventDefault();if(!requireActive())return;const form=e.currentTarget,btn=form.querySelector('.primary'),fd=new FormData(form);setBusy(btn,true,'Se trimite…');
  try{
    const listingId=fd.get('listing_id'),sellerId=fd.get('seller_id');
    let {data:conv,error}=await db.from('conversations').select('id').eq('listing_id',listingId).eq('buyer_id',state.user.id).eq('seller_id',sellerId).maybeSingle();
    if(error)throw error;
    if(!conv){const r=await db.from('conversations').insert({listing_id:listingId,buyer_id:state.user.id,seller_id:sellerId}).select('id').single();if(r.error)throw r.error;conv=r.data;}
    const r2=await db.from('messages').insert({conversation_id:conv.id,sender_id:state.user.id,body:String(fd.get('body')).trim()});if(r2.error)throw r2.error;
    closeDialog('messageModal');toast('Mesaj trimis.');
  }catch(err){console.error(err);toast(err.message||'Mesajul nu a putut fi trimis.','error');}finally{setBusy(btn,false);}
}

async function reportListing(l){
  if(!requireActive())return;if(l.seller_id===state.user.id)return toast('Nu îți poți raporta propriul anunț.');
  const reason=prompt('Motiv: fraudă / ilegal / contrafăcut / spam / înșelător / nepotrivit / altul','spam');if(!reason)return;
  const map={'fraudă':'fraud','frauda':'fraud','ilegal':'illegal','contrafăcut':'counterfeit','contrafacut':'counterfeit','spam':'spam','înșelător':'misleading','inselator':'misleading','nepotrivit':'inappropriate','altul':'other'};
  const code=map[reason.toLowerCase()]||'other';const {error}=await db.from('reports').insert({reporter_id:state.user.id,listing_id:l.id,reason:code});
  if(error){if(error.code==='23505')return toast('Ai raportat deja acest anunț.');console.error(error);return toast('Raportarea nu a putut fi trimisă.','error');}toast('Raport trimis către moderare.');
}

function openAuth(mode='login'){state.authMode=mode;updateAuthMode();$('#authModal').showModal();}
function updateAuthMode(){const signup=state.authMode==='signup';$('#authTitle').textContent=signup?'Creează cont':'Intră în cont';$('#authSubmit').textContent=signup?'Creează cont':'Intră în cont';$('#displayNameField').hidden=!signup;$('#forgotPasswordRow').hidden=signup;$('#authNotice').textContent=signup?'Fiecare adresă de email poate avea un singur cont. Dacă emailul este deja înregistrat, crearea unui cont nou este blocată.':'Contul îți permite să publici, să salvezi favorite și să contactezi vânzătorii.';$('#authForm [name=password]').autocomplete=signup?'new-password':'current-password';$$('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b.dataset.authMode===state.authMode));}
async function submitAuth(e){
  e.preventDefault();const form=e.currentTarget,btn=$('#authSubmit'),fd=new FormData(form),email=String(fd.get('email')).trim(),password=String(fd.get('password'));setBusy(btn,true,state.authMode==='signup'?'Se creează…':'Se autentifică…');
  try{
    if(state.authMode==='signup'){
      const display=String(fd.get('display_name')||'').trim();if(display.length<2)throw new Error('Completează numele afișat.');
      const response=await fetch(`${SUPABASE_URL}/functions/v1/register-user`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({email,password,display_name:display})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Contul nu a putut fi creat.');
      const login=await db.auth.signInWithPassword({email,password});if(login.error)throw login.error;
      closeDialog('authModal');toast('Cont creat. Bine ai venit!');
    } else {const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;closeDialog('authModal');toast('Ai intrat în cont.');}
  }catch(err){console.error(err);toast(err.message||'Autentificarea a eșuat.','error');}finally{setBusy(btn,false);}
}

async function requestPasswordReset(){
  const input=$('#authForm [name=email]');const email=String(input?.value||'').trim().toLowerCase();
  if(!email||!/^\S+@\S+\.\S+$/.test(email)){input?.focus();return toast('Introdu mai întâi adresa de email.','error');}
  const btn=$('#forgotPasswordBtn');setBusy(btn,true,'Se trimite…');
  try{
    const {error}=await db.auth.resetPasswordForEmail(email);
    if(error)throw error;
    sessionStorage.setItem('fsh_recovery_email',email);
    const form=$('#passwordResetForm');form.reset();form.elements.recovery_email.value=email;$('#recoveryEmailHint').textContent=`Cod trimis la ${email}.`;closeDialog('authModal');$('#passwordResetModal').showModal();
    toast('Dacă există un cont pentru acest email, vei primi un cod temporar.');
  }catch(err){console.error(err);toast('Codul de recuperare nu a putut fi trimis.','error');}finally{setBusy(btn,false);}
}

async function submitPasswordReset(e){
  e.preventDefault();const form=e.currentTarget,btn=$('#passwordResetSubmit'),fd=new FormData(form),email=String(fd.get('recovery_email')||sessionStorage.getItem('fsh_recovery_email')||'').trim().toLowerCase(),token=String(fd.get('temporary_code')||'').trim(),password=String(fd.get('new_password')||''),confirm=String(fd.get('confirm_password')||'');
  if(!email)return toast('Adresa de email pentru recuperare lipsește. Cere un cod nou.','error');
  if(token.length<6)return toast('Introdu codul temporar primit pe email.','error');
  if(password.length<8)return toast('Parola trebuie să aibă minimum 8 caractere.','error');
  if(password!==confirm)return toast('Parolele nu coincid.','error');
  setBusy(btn,true,'Se verifică…');
  try{
    const verified=await db.auth.verifyOtp({email,token,type:'recovery'});if(verified.error)throw verified.error;
    const changed=await db.auth.updateUser({password});if(changed.error)throw changed.error;
    sessionStorage.removeItem('fsh_recovery_email');form.reset();await db.auth.signOut({scope:'local'});closeDialog('passwordResetModal');openAuth('login');$('#authForm [name=email]').value=email;$('#authForm [name=password]').value='';toast('Parola a fost schimbată. Intră în cont cu parola nouă.');
  }catch(err){console.error(err);toast('Codul este invalid sau expirat. Cere un cod nou și încearcă din nou.','error');}finally{setBusy(btn,false);}
}

function prepareSellForm(mode='new'){
  const form=$('#sellForm');
  resetListingImageEditor();
  form.reset();
  form.elements.location.value='București';
  $('#sellModal .kicker').textContent=mode==='edit'?'EDITARE ANUNȚ':'ANUNȚ NOU';
  $('#sellModal h2').textContent=mode==='edit'?'Editează anunțul':'Ce vrei să vinzi?';
  $('#publishBtn').textContent=mode==='edit'?'Salvează modificările':'Publică anunț';
  $('#imageHelp').textContent=mode==='edit'?'Poți păstra, șterge, adăuga sau reordona fotografiile.':'JPG, PNG sau WEBP. Recomandat sub 5 MB / imagine.';
}

function openListingLimitModal(){
  closeDialog('sellModal');
  const d=$('#listingLimitModal');
  if(d&&!d.open)d.showModal();
}

function isListingLimitError(err){
  const msg=String(err?.message||err?.details||err?.hint||'');
  return msg.includes('ACTIVE_LISTING_LIMIT_REACHED');
}

async function activeListingCount(){
  if(!state.user)return 0;
  const {count,error}=await db.from('listings')
    .select('id',{count:'exact',head:true})
    .eq('seller_id',state.user.id)
    .eq('state','active');
  if(error)throw error;
  return Number(count||0);
}

async function openSell(){
  if(!requireActive())return;
  try{
    const count=await activeListingCount();
    if(count>=10){openListingLimitModal();return;}
  }catch(error){
    console.warn('active listing limit precheck',error);
    /* DB trigger remains authoritative; don't block publishing only because the precheck failed. */
  }
  state.editingListingId=null;state.editReturnToAccount=false;prepareSellForm('new');$('#sellModal').showModal();
}

async function openEditListing(id,returnToAccount=true){
  if(!requireActive())return;
  const l=state.listings.find(x=>x.id===id);
  if(!l||l.seller_id!==state.user?.id)return toast('Poți edita doar propriul anunț.','error');
  state.editingListingId=id;state.editReturnToAccount=returnToAccount;
  prepareSellForm('edit');
  const form=$('#sellForm');
  form.elements.title.value=l.title||'';
  form.elements.category.value=l.category_id||'';
  form.elements.price.value=l.price??'';
  form.elements.currency.value=l.currency||'RON';
  form.elements.condition.value=l.condition||'used';
  form.elements.location.value=l.location||'';
  form.elements.negotiable.checked=!!l.negotiable;
  form.elements.description.value=l.description||'';
  const {data:contact,error}=await db.from('listing_contacts').select('phone,whatsapp').eq('listing_id',id).maybeSingle();
  if(error)console.warn('contact edit load',error);
  form.elements.phone.value=contact?.phone||'';
  form.elements.whatsapp.value=contact?.whatsapp||'';
  await initializeExistingListingImages(l);
  closeDialog('accountModal');
  $('#sellModal').showModal();
}

async function publishListing(e){
  e.preventDefault();if(!requireActive())return;
  const form=e.currentTarget,btn=$('#publishBtn'),fd=new FormData(form),editing=!!state.editingListingId;
  const current=editing?state.listings.find(x=>x.id===state.editingListingId):null;
  const imageItems=[...listingImageEditor.items];
  if(imageItems.length>8)return toast('Poți avea maximum 8 fotografii.','error');
  if(!fd.get('phone')&&!fd.get('whatsapp'))return toast('Adaugă telefon sau WhatsApp pentru contact direct.','error');

  setBusy(btn,true,editing?'Se salvează…':'Se publică…');
  let listingId=state.editingListingId;
  const newlyUploadedPaths=[];
  try{
    const row={category_id:fd.get('category'),title:String(fd.get('title')).trim(),description:String(fd.get('description')).trim(),price:Number(fd.get('price')),currency:fd.get('currency'),condition:fd.get('condition'),location:String(fd.get('location')).trim(),negotiable:fd.get('negotiable')==='on'};
    if(editing){
      if(!current||current.seller_id!==state.user.id)throw new Error('Anunțul nu îți aparține.');
      const r=await db.from('listings').update({...row,state:'active',updated_at:new Date().toISOString()}).eq('id',listingId).eq('seller_id',state.user.id).select('id').single();if(r.error)throw r.error;
      const contactPatch={phone:String(fd.get('phone')||'').trim()||null,whatsapp:String(fd.get('whatsapp')||'').trim()||null};
      const rc=await db.from('listing_contacts').update(contactPatch).eq('listing_id',listingId).eq('seller_id',state.user.id);if(rc.error)throw rc.error;
    }else{
      const r=await db.from('listings').insert({...row,seller_id:state.user.id}).select('id').single();if(r.error)throw r.error;listingId=r.data.id;
      const contact={listing_id:listingId,seller_id:state.user.id,phone:String(fd.get('phone')||'').trim()||null,whatsapp:String(fd.get('whatsapp')||'').trim()||null};
      const rc=await db.from('listing_contacts').insert(contact);if(rc.error)throw rc.error;
    }

    const pathByKey=new Map();
    for(const item of imageItems){
      if(item.kind==='existing'){
        pathByKey.set(item.key,item.path);
        continue;
      }
      const f=item.file;
      if(!f)continue;
      if(f.size>6*1024*1024)throw new Error(`Imaginea ${f.name} depășește 6 MB.`);
      const ext=(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
      const path=`${state.user.id}/${listingId}/${crypto.randomUUID()}.${ext}`;
      const up=await db.storage.from('listing-images').upload(path,f,{cacheControl:'3600',upsert:false,contentType:f.type});
      if(up.error)throw up.error;
      newlyUploadedPaths.push(path);
      const ri=await db.from('listing_images').insert({listing_id:listingId,storage_path:path,sort_order:99});
      if(ri.error)throw ri.error;
      pathByKey.set(item.key,path);
    }

    const finalPaths=imageItems.map(item=>pathByKey.get(item.key)).filter(Boolean);

    if(editing){
      const originalPaths=[...listingImageEditor.originalPaths];
      const keep=new Set(finalPaths);
      const removed=originalPaths.filter(path=>!keep.has(path));
      if(removed.length){
        const rd=await db.from('listing_images').delete().eq('listing_id',listingId).in('storage_path',removed);
        if(rd.error)throw rd.error;
        const rs=await db.storage.from('listing-images').remove(removed);
        if(rs.error)console.warn('storage image cleanup',rs.error);
      }
    }

    for(let i=0;i<finalPaths.length;i++){
      const ru=await db.from('listing_images').update({sort_order:i}).eq('listing_id',listingId).eq('storage_path',finalPaths[i]);
      if(ru.error)throw ru.error;
    }

    const returnToAccount=state.editReturnToAccount;
    state.editingListingId=null;state.editReturnToAccount=false;
    prepareSellForm('new');
    closeDialog('sellModal');
    await loadListings();renderListings();

    if(editing){
      toast('Anunț actualizat. Ordinea fotografiilor a fost salvată.');
      if(returnToAccount)await openAccount('listings');
    }else{
      toast('Anunț publicat în Support Hub Giuleștean 1923.');
      $('#anunturi').scrollIntoView({behavior:'smooth'});
    }
  }catch(err){
    console.error(err);
    if(newlyUploadedPaths.length){
      try{await db.from('listing_images').delete().in('storage_path',newlyUploadedPaths);}catch(_){}
      try{await db.storage.from('listing-images').remove(newlyUploadedPaths);}catch(_){}
    }
    if(!editing&&isListingLimitError(err)){
      if(listingId)await db.from('listings').delete().eq('id',listingId);
      openListingLimitModal();
    }else{
      toast(err.message||(editing?'Anunțul nu a putut fi actualizat.':'Anunțul nu a putut fi publicat.'),'error');
      if(!editing&&listingId)await db.from('listings').delete().eq('id',listingId);
    }
  }finally{setBusy(btn,false);}
}
async function openAccount(tab='listings'){
  if(!requireAuth())return;state.accountTab=tab;$('#accountName').textContent=state.profile?.display_name||'Contul meu';$('#accountEmail').textContent=state.user.email||'';$('#accountAvatar').innerHTML=avatarHtml(state.profile,'account-avatar-inner');updateSuspensionUI();updateAccountTabButtons();await renderAccount();$('#accountModal').showModal();
}
function updateAccountTabButtons(){$$('[data-account-tab]').forEach(b=>b.classList.toggle('active',b.dataset.accountTab===state.accountTab));}
async function renderAccount(){
  const root=$('#accountContent');root.innerHTML='<div class="loading-line">Se încarcă…</div>';
  try{
    if(state.accountTab==='listings'){
      const own=state.listings.filter(l=>l.seller_id===state.user.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      let statuses={};if(own.length){const {data}=await db.from('listing_approvals').select('listing_id,status').in('listing_id',own.map(x=>x.id));(data||[]).forEach(x=>statuses[x.listing_id]=x.status);}
      root.innerHTML=own.length?`<div class="account-list">${own.map(l=>`<div class="account-row"><div><b>${esc(l.title)}</b><small>${money(l.price,l.currency)} • ${esc(l.location)}</small></div><span class="status ${statuses[l.id]||'approved'}">${statuses[l.id]==='pending'?'În moderare':statuses[l.id]==='rejected'?'Respins':'Activ'}</span><button class="ghost mini" data-edit="${l.id}">Editează</button><button class="danger mini" data-delete="${l.id}">Șterge</button></div>`).join('')}</div>`:'<div class="empty compact"><b>N-ai publicat încă.</b><span>Primul anunț poate fi pus chiar acum.</span></div>';
      $$('[data-edit]',root).forEach(b=>b.onclick=()=>openEditListing(b.dataset.edit,true));$$('[data-delete]',root).forEach(b=>b.onclick=()=>deleteListing(b.dataset.delete));
    } else if(state.accountTab==='favorites'){
      const favs=state.listings.filter(l=>state.favorites.has(l.id));root.innerHTML=favs.length?`<div class="listing-grid account-grid">${favs.map(cardHtml).join('')}</div>`:'<div class="empty compact"><b>N-ai favorite.</b><span>Apasă ♡ pe un anunț ca să-l păstrezi aici.</span></div>';bindListingCards(root);
    } else if(state.accountTab==='messages'){
      await renderMessages(root);
    } else if(state.accountTab==='admin'&&isAdmin()){
      await renderAdmin(root);
    }
  }catch(err){console.error(err);root.innerHTML=`<div class="status-banner">${esc(err.message||'Nu am putut încărca această secțiune.')}</div>`;}
}

async function deleteListing(id,fromDetail=false){
  if(!confirm('Ștergi definitiv acest anunț și fotografiile lui?'))return;
  const l=state.listings.find(x=>x.id===id);if(!l||l.seller_id!==state.user?.id)return toast('Poți șterge doar propriul anunț.','error');
  try{
    const {data:imgs}=await db.from('listing_images').select('storage_path').eq('listing_id',id);
    const paths=(imgs||[]).map(x=>x.storage_path).filter(Boolean);
    if(paths.length){const rm=await db.storage.from('listing-images').remove(paths);if(rm.error)console.warn('storage cleanup',rm.error);}
    const {data,error}=await db.from('listings').delete().eq('id',id).eq('seller_id',state.user.id).select('id');
    if(error)throw error;if(!data?.length)throw new Error('Anunțul nu a fost șters. Reîncarcă pagina și încearcă din nou.');
    if(fromDetail)closeDialog('detailModal');await loadListings();renderListings();if($('#accountModal').open)await renderAccount();toast('Anunț șters definitiv.');
  }catch(err){console.error(err);toast(err.message||'Anunțul nu a putut fi șters.','error');}
}

function updateContactIncognitoUI(){
  const input=$('#profileForm [name=contact_incognito]');
  const label=$('#contactIncognitoState');
  if(!input||!label)return;
  label.textContent=input.checked?'ON':'OFF';
  label.classList.toggle('on',input.checked);
}

function openProfileEditor(){
  if(!requireAuth())return;
  const f=$('#profileForm');
  f.elements.display_name.value=state.profile?.display_name||'';
  f.elements.location.value=state.profile?.location||'';
  f.elements.bio.value=state.profile?.bio||'';
  f.elements.avatar.value='';
  f.elements.remove_avatar.checked=false;
  f.elements.contact_incognito.checked=!!state.profile?.contact_incognito;
  $('#profilePreview').innerHTML=avatarHtml(state.profile,'profile-preview-avatar');
  updateContactIncognitoUI();
  updateAdminAccessUI();
  $('#profileModal').showModal();
}
async function saveProfile(e){
  e.preventDefault();if(!requireAuth())return;const form=e.currentTarget,btn=$('#profileSaveBtn'),fd=new FormData(form),file=form.elements.avatar.files?.[0];setBusy(btn,true,'Se salvează…');
  try{
    const display=String(fd.get('display_name')||'').trim();if(display.length<2)throw new Error('Numele trebuie să aibă minimum 2 caractere.');
    let nextAvatar=state.profile?.avatar_path||null;const oldAvatar=nextAvatar;
    if(fd.get('remove_avatar')==='on'){nextAvatar=null;}
    if(file){if(file.size>3*1024*1024)throw new Error('Avatarul poate avea maximum 3 MB.');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Avatarul trebuie să fie JPG, PNG sau WEBP.');const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${state.user.id}/avatar-${Date.now()}.${ext}`;const up=await db.storage.from('profile-avatars').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});if(up.error)throw up.error;nextAvatar=path;}
    const patch={display_name:display,location:String(fd.get('location')||'').trim()||null,bio:String(fd.get('bio')||'').trim()||null,avatar_path:nextAvatar,contact_incognito:fd.get('contact_incognito')==='on'};
    const {data,error}=await db.from('profiles').update(patch).eq('id',state.user.id).select('*').single();if(error)throw error;state.profile=data;
    if(oldAvatar&&oldAvatar!==nextAvatar){const rm=await db.storage.from('profile-avatars').remove([oldAvatar]);if(rm.error)console.warn('old avatar cleanup',rm.error);}
    closeDialog('profileModal');updateAccountButtons();$('#accountName').textContent=state.profile.display_name;$('#accountAvatar').innerHTML=avatarHtml(state.profile,'account-avatar-inner');toast('Profil actualizat.');
  }catch(err){console.error(err);toast(err.message||'Profilul nu a putut fi salvat.','error');}finally{setBusy(btn,false);}
}


function openDeleteAccount(){
  if(!requireAuth())return;closeDialog('profileModal');const form=$('#deleteAccountForm');form.reset();$('#deleteAccountModal').showModal();
}

async function deleteAccount(e){
  e.preventDefault();if(!requireAuth())return;const form=e.currentTarget,confirmation=String(new FormData(form).get('confirmation')||'').trim().toUpperCase();
  if(confirmation!=='ȘTERGE'&&confirmation!=='STERGE')return toast('Scrie ȘTERGE pentru confirmare.','error');
  const btn=$('#deleteAccountConfirmBtn');setBusy(btn,true,'Se șterge…');
  try{
    const session=(await db.auth.getSession()).data.session;if(!session?.access_token)throw new Error('Sesiunea a expirat. Intră din nou în cont.');
    const response=await fetch(`${SUPABASE_URL}/functions/v1/delete-account`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${session.access_token}`}});
    const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Contul nu a putut fi șters.');
    await db.auth.signOut({scope:'local'});state.session=null;state.user=null;state.profile=null;state.favorites.clear();closeDialog('deleteAccountModal');closeDialog('accountModal');updateAccountButtons();await loadListings();renderListings();toast('Contul și datele asociate au fost șterse definitiv.');
  }catch(err){console.error(err);toast(err.message||'Contul nu a putut fi șters.','error');}finally{setBusy(btn,false);}
}


async function hideConversationForMe(conversationId){
  if(!requireAuth())return;
  if(!confirm('Ștergi această conversație din contul tău? Cealaltă persoană își păstrează mesajele. Dacă apare un mesaj nou, conversația va reapărea.'))return;

  const {error}=await db.from('conversation_hidden').upsert({
    conversation_id:conversationId,
    user_id:state.user.id,
    hidden_at:new Date().toISOString()
  },{onConflict:'conversation_id,user_id'});

  if(error){
    console.error(error);
    return toast('Conversația nu a putut fi ștearsă.','error');
  }

  await renderMessages($('#accountContent'));
  toast('Conversația a fost ștearsă din lista ta.');
}

async function renderMessages(root){
  const ownFilter=`buyer_id.eq.${state.user.id},seller_id.eq.${state.user.id}`;
  const [convRes,hiddenRes]=await Promise.all([
    db.from('conversations')
      .select('id,listing_id,buyer_id,seller_id,updated_at')
      .or(ownFilter)
      .order('updated_at',{ascending:false}),
    db.from('conversation_hidden')
      .select('conversation_id')
      .eq('user_id',state.user.id)
  ]);

  if(convRes.error)throw convRes.error;
  if(hiddenRes.error)throw hiddenRes.error;

  const hidden=new Set((hiddenRes.data||[]).map(row=>row.conversation_id));
  const convs=(convRes.data||[]).filter(c=>!hidden.has(c.id));

  if(!convs.length){
    root.innerHTML='<div class="empty compact"><b>N-ai conversații.</b><span>Mesajele pornite din anunțuri vor apărea aici.</span></div>';
    return;
  }

  const lmap=Object.fromEntries(state.listings.map(l=>[l.id,l]));
  const cards=[];

  for(const c of convs){
    const {data:msgs}=await db.from('messages')
      .select('id,sender_id,body,created_at')
      .eq('conversation_id',c.id)
      .order('created_at',{ascending:true})
      .limit(40);

    const last=msgs?.[msgs.length-1];
    cards.push(`<div class="conversation-card-wrap">
      <button class="conversation-card" data-conv="${c.id}" data-listing="${c.listing_id}" data-other="${c.buyer_id===state.user.id?c.seller_id:c.buyer_id}">
        <b>${esc(lmap[c.listing_id]?.title||'Anunț')}</b>
        <span>${esc(last?.body||'Conversație nouă')}</span>
        <small>${last?since(last.created_at):''}</small>
      </button>
      <button type="button" class="conversation-delete" data-delete-conv="${c.id}" aria-label="Șterge conversația" title="Șterge conversația">×</button>
    </div>`);
  }

  root.innerHTML=`<div class="conversation-list">${cards.join('')}</div><div class="thread" id="threadPane"><div class="thread-placeholder">Alege o conversație.</div></div>`;

  $$('[data-conv]',root).forEach(b=>b.onclick=()=>openThread(b));
  $$('[data-delete-conv]',root).forEach(b=>b.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    hideConversationForMe(b.dataset.deleteConv);
  });
}

async function openThread(button){
  const pane=$('#threadPane');
  const id=button.dataset.conv;
  const {data:msgs,error}=await db.from('messages')
    .select('id,sender_id,body,created_at')
    .eq('conversation_id',id)
    .order('created_at');

  if(error)return toast(error.message,'error');

  pane.innerHTML=`<div class="thread-messages">${(msgs||[]).map(m=>`<div class="bubble ${m.sender_id===state.user.id?'mine':''}"><span>${esc(m.body)}</span><small>${since(m.created_at)}</small></div>`).join('')}</div><form class="thread-form" data-thread-form="${id}"><input name="body" maxlength="2000" required placeholder="Scrie un mesaj…"><button class="primary">Trimite</button></form>`;

  $('[data-thread-form]',pane).onsubmit=async e=>{
    e.preventDefault();
    if(!requireActive())return;
    const input=e.currentTarget.body;
    const body=input.value.trim();
    if(!body)return;
    const {error}=await db.from('messages').insert({conversation_id:id,sender_id:state.user.id,body});
    if(error)return toast(error.message,'error');
    input.value='';
    await openThread(button);
  };

  pane.scrollTop=pane.scrollHeight;
}

async function renderAdmin(root){
  const {data:reports,error}=await db.from('reports').select('id,listing_id,reason,status,created_at').in('status',['open','reviewing']).order('created_at',{ascending:false});if(error)throw error;
  const {data:pending}=await db.from('listing_approvals').select('listing_id,status,updated_at').eq('status','pending').order('updated_at',{ascending:false});
  root.innerHTML=`<div class="admin-grid"><section><h3>În moderare</h3>${pending?.length?pending.map(x=>`<div class="admin-row"><span>${esc(state.listings.find(l=>l.id===x.listing_id)?.title||x.listing_id)}</span><button class="primary mini" data-approve="${x.listing_id}">Aprobă</button><button class="danger mini" data-reject="${x.listing_id}">Respinge</button></div>`).join(''):'<p class="muted">Nimic în așteptare.</p>'}</section><section><h3>Raportări deschise</h3>${reports?.length?reports.map(x=>`<div class="admin-row"><span>${esc(x.reason)} • ${esc(state.listings.find(l=>l.id===x.listing_id)?.title||x.listing_id)}</span><button class="ghost mini" data-resolve="${x.id}">Rezolvă</button></div>`).join(''):'<p class="muted">Nicio raportare deschisă.</p>'}</section></div>`;
  $$('[data-approve]',root).forEach(b=>b.onclick=()=>moderate(b.dataset.approve,'approved'));$$('[data-reject]',root).forEach(b=>b.onclick=()=>moderate(b.dataset.reject,'rejected'));$$('[data-resolve]',root).forEach(b=>b.onclick=()=>resolveReport(b.dataset.resolve));
}
async function moderate(id,status){const {error}=await db.from('listing_approvals').update({status,reviewed_by:state.user.id,reviewed_at:new Date().toISOString()}).eq('listing_id',id);if(error)return toast(error.message,'error');await loadListings();renderListings();renderAccount();}
async function resolveReport(id){const {error}=await db.from('reports').update({status:'resolved'}).eq('id',id);if(error)return toast(error.message,'error');renderAccount();}

function renderAll(){renderCategories();renderListings();updateAccountButtons();}
function showListingSkeletons(){$('#listingGrid').innerHTML=Array.from({length:8},()=>'<div class="listing-card skeleton-card"><div class="listing-image"></div><div class="listing-body"><div class="skeleton"></div><div class="skeleton short"></div></div></div>').join('');}

function bindCloseButtons(root=document){$$('[data-close]',root).forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));}
function bindStaticEvents(){
  bindCloseButtons();
  $$('[data-open-sell]').forEach(b=>b.onclick=openSell);
  $('#loginBtn').onclick=()=>state.user?openAccount():openAuth('login');$('#mobileAccount').onclick=$('#loginBtn').onclick;
  $$('[data-auth-mode]').forEach(b=>b.onclick=()=>{state.authMode=b.dataset.authMode;updateAuthMode();});
  $('#authForm').addEventListener('submit',submitAuth);$('#forgotPasswordBtn').onclick=requestPasswordReset;$('#passwordResetForm').addEventListener('submit',submitPasswordReset);$('#sellForm').addEventListener('submit',publishListing);$('#messageForm').addEventListener('submit',sendMessage);
  $('#logoutBtn').onclick=async()=>{await db.auth.signOut();closeDialog('accountModal');toast('Ai ieșit din cont.');};$('#editProfileBtn').onclick=openProfileEditor;$('#adminPanelBtn').onclick=()=>window.open('/admin.html','_blank','noopener');$('#profileForm').addEventListener('submit',saveProfile);$('#deleteAccountBtn').onclick=openDeleteAccount;$('#deleteAccountForm').addEventListener('submit',deleteAccount);$('#profileForm [name=avatar]').onchange=e=>{const f=e.target.files?.[0];if(f){const u=URL.createObjectURL(f);$('#profilePreview').innerHTML=`<span class="profile-preview-avatar has-image"><img src="${esc(u)}" alt="Preview avatar"></span>`;}};
  $('#profileForm [name=contact_incognito]').onchange=updateContactIncognitoUI;
  $$('[data-account-tab]').forEach(b=>b.onclick=async()=>{state.accountTab=b.dataset.accountTab;updateAccountTabButtons();await renderAccount();});
  $('#listingLimitManage').onclick=async()=>{closeDialog('listingLimitModal');await openAccount('listings');};
  $('#searchBtn').onclick=()=>{resetMarketPage();renderListings();$('#anunturi').scrollIntoView({behavior:'smooth'});};$('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#searchBtn').click();});
  $$('[data-search]').forEach(b=>b.onclick=()=>{$('#searchInput').value=b.dataset.search;$('#searchBtn').click();});
  $('#categoryFilter').onchange=()=>{resetMarketPage();syncCategorySelection();renderListings();};$('#sortSelect').onchange=()=>{resetMarketPage();renderListings();};$('#allCategories').onclick=()=>{$('#categoryFilter').value='all';resetMarketPage();syncCategorySelection();renderListings();};
  $$('[data-focus-search]').forEach(b=>b.onclick=()=>{scrollTo({top:0,behavior:'smooth'});setTimeout(()=>$('#searchInput').focus(),300);});$$('[data-home]').forEach(b=>b.onclick=()=>scrollTo({top:0,behavior:'smooth'}));$$('[data-favorites]').forEach(b=>b.onclick=()=>openAccount('favorites'));
  $$('[data-legal]').forEach(a=>a.onclick=e=>{e.preventDefault();openLegal(a.dataset.legal);});
  $('#sellForm [name=images]').onchange=e=>{addListingImageFiles([...e.target.files]);e.target.value='';};
  $('#addMoreImagesBtn').onclick=()=>$('#sellForm [name=images]').click();
  ['authModal','passwordResetModal','sellModal','detailModal','sellerListingsModal','messageModal','accountModal','profileModal','deleteAccountModal','legalModal'].forEach(id=>{const d=document.getElementById(id);d.addEventListener('click',e=>{if(e.target===d)d.close();});});
}

const TERMS_OF_USE_HTML=`<article class="legal-doc"><h3 class="legal-doc-title">TERMENI DE UTILIZARE ȘI POLITICA DE MODERARE</h3><p class="legal-doc-subtitle"><strong>HUB Giuleștean — Support Hub Giuleștean 1923</strong></p><p class="legal-doc-meta">Versiunea 1.0</p><p class="legal-doc-meta">Data intrării în vigoare: [se completează la publicare]</p><h4>1. Identitatea operatorului și contact</h4><p>Platforma HUB Giuleștean, denumită și „Support Hub Giuleștean 1923”, este administrată de <strong>CASA DEL DANIEL DIGITAL CONSULTING S.R.L.</strong>, denumită în continuare „Operatorul”, având următoarele date de identificare:</p><ul><li><strong>Sediul social:</strong> Strada Valea Gârboului nr. 5, Florești, județul Cluj, România;</li><li><strong>Cod unic de înregistrare:</strong> 511***88;</li><li><strong>Număr de ordine în Registrul Comerțului:</strong> J2025<strong>*</strong>*001;</li><li><strong>Identificator unic european — EUID:</strong> ROONRC.J2025<strong>*</strong>*001;</li><li><strong>Telefon:</strong> 0753.670.173;</li><li><strong>E-mail:</strong> <a href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a>.</li></ul><p>Adresa de e-mail reprezintă punctul de contact pentru asistență, reclamații, raportarea conținutului, contestarea măsurilor de moderare și comunicarea cu autoritățile. Comunicarea se desfășoară în limba română și permite contactul cu o persoană din partea Operatorului.</p><h4>2. Scopul și caracterul independent al Platformei</h4><p>HUB Giuleștean este o platformă independentă de anunțuri, destinată facilitării contactului dintre persoanele care oferă sau caută bunuri și servicii.</p><p>Caracterul comunitar al Platformei nu reprezintă o verificare sau o garanție a identității, seriozității ori capacității utilizatorilor de a-și îndeplini obligațiile.</p><p>Referirile la comunitatea giuleșteană și utilizarea denumirii Platformei nu trebuie interpretate, prin ele însele, ca dovadă a unei afilieri oficiale cu un club sportiv sau cu o altă organizație. Orice parteneriat oficial va fi prezentat explicit.</p><h4>3. Domeniul de aplicare și acceptarea termenilor</h4><p>Acești termeni reglementează utilizarea Platformei, crearea conturilor, publicarea anunțurilor și interacțiunile realizate prin funcțiile disponibile.</p><p>Crearea unui cont presupune acceptarea expresă a termenilor prin mecanismul pus la dispoziție în Platformă. Termenii trebuie să poată fi consultați și salvați înainte de acceptare.</p><p>Acceptarea lor reglementează relația dintre utilizator și Operator. Condițiile tranzacțiilor dintre utilizatori se stabilesc separat între persoanele implicate, cu respectarea legii.</p><h4>4. Eligibilitatea și gestionarea contului</h4><p>Crearea conturilor și publicarea anunțurilor sunt permise persoanelor care au împlinit 18 ani. Persoana care acționează pentru o societate sau organizație trebuie să aibă dreptul de a o reprezenta.</p><p>Utilizatorul se obligă:</p><ul><li>să furnizeze informații corecte și actualizate;</li><li>să utilizeze date de contact asupra cărora are control;</li><li>să protejeze parola și codurile de autentificare;</li><li>să nu folosească fără drept identitatea altei persoane;</li><li>să anunțe Operatorul când suspectează compromiterea contului;</li><li>să nu creeze conturi pentru a evita restricțiile aplicate justificat.</li></ul><p>Utilizatorul răspunde pentru propriile acțiuni și pentru activitățile autorizate de acesta. Folosirea neautorizată a contului nu stabilește automat culpa titularului.</p><p>Operatorul nu solicită parole, coduri PIN sau coduri de autentificare pentru verificarea unui anunț ori pentru confirmarea unei tranzacții.</p><h4>5. Rolul Platformei în tranzacții</h4><p>Platforma oferă infrastructura necesară publicării anunțurilor și facilitării contactului dintre utilizatori.</p><p><strong>Operatorul nu este parte în tranzacțiile dintre utilizatori</strong> și nu acționează ca vânzător, cumpărător, mandatar sau garant al acestora.</p><p>Părțile stabilesc direct:</p><ul><li>prețul și modalitatea de plată;</li><li>condițiile de predare sau livrare;</li><li>verificarea bunului;</li><li>condițiile prestării serviciului;</li><li>eventualele garanții contractuale și condiții de restituire, cu respectarea drepturilor legale aplicabile.</li></ul><p>În modelul de anunțuri reglementat de acești termeni, Operatorul nu încasează și nu păstrează contravaloarea bunurilor ori serviciilor tranzacționate între utilizatori.</p><p>Aceste precizări nu înlătură obligațiile legale și răspunderea proprie a Operatorului.</p><h4>6. Responsabilitatea pentru ofertele publicate</h4><p>Autorul răspunde pentru legalitatea ofertei, autenticitatea bunului, exactitatea descrierii și dreptul de a utiliza fotografiile, textele și celelalte materiale publicate.</p><p>Utilizatorul trebuie să dețină bunul sau să fie autorizat să îl ofere și să aibă calificările ori autorizațiile necesare pentru serviciile prestate, atunci când legea le impune.</p><p>Anunțul trebuie să prezinte clar:</p><ul><li>bunul sau serviciul oferit;</li><li>caracteristicile esențiale;</li><li>starea reală și defectele cunoscute;</li><li>prețul sau modul de calcul;</li><li>costurile suplimentare cunoscute;</li><li>condițiile și limitările relevante ale ofertei.</li></ul><p>Fotografiile trebuie să reflecte corect oferta. Imaginile ilustrative trebuie identificate ca atare.</p><p>Sunt interzise ascunderea defectelor, prezentarea produselor contrafăcute drept originale, ofertele inexistente și prețurile fictive folosite pentru atragerea accesărilor.</p><p>Anunțurile trebuie actualizate sau retrase când oferta nu mai este disponibilă.</p><h4>7. Utilizatori particulari și profesioniști</h4><p>Utilizatorii trebuie să declare corect dacă acționează ca particulari sau în cadrul unei activități profesionale.</p><p>Profesioniștii răspund pentru furnizarea informațiilor comerciale obligatorii, respectarea cerințelor de autorizare, emiterea documentelor fiscale și respectarea drepturilor consumatorilor.</p><p>Dreptul de retragere, obligațiile privind conformitatea și celelalte drepturi specifice consumatorilor se aplică în condițiile prevăzute de lege. Acestea nu se aplică automat tranzacțiilor între particulari, pentru care rămân valabile regulile dreptului civil.</p><p>Selectarea unui cont de particular nu înlătură obligațiile aferente unei activități care este, în realitate, profesională.</p><h4>8. Bunuri, servicii și conținut interzis</h4><p>Sunt interzise:</p><ul><li>bunurile furate, contrafăcute sau comercializate fără drept;</li><li>produsele și serviciile interzise de lege;</li><li>fraudele, schemele piramidale și ofertele cu promisiuni înșelătoare de câștig;</li><li>documentele false, datele bancare, parolele și conturile compromise;</li><li>comercializarea sau divulgarea fără drept a datelor personale;</li><li>materialele care încalcă drepturi de autor, mărci sau dreptul la imagine;</li><li>conținutul care exploatează minori;</li><li>amenințările, hărțuirea și incitarea la ură sau violență;</li><li>linkurile de phishing, programele malițioase și tentativele de furt de date;</li><li>anunțurile care folosesc fără drept identitatea unei persoane ori organizații.</li></ul><p>Prin politica Platformei sunt interzise și ofertele de arme, muniții, explozibili, articole pirotehnice, droguri, medicamente, tutun, produse cu nicotină și servicii sexuale, chiar dacă anumite categorii pot fi comercializate legal în alte condiții.</p><p>Biletele și abonamentele la evenimente pot fi oferite numai dacă transferul este permis de lege și de condițiile emitentului. Nu sunt acceptate bilete false, duplicate sau prezentate înșelător.</p><h4>9. Reguli de conduită</h4><p>Comunicarea trebuie să fie relevantă și să respecte drepturile celorlalte persoane.</p><p>Nu sunt permise:</p><ul><li>intimidarea și insultele repetate adresate altor utilizatori;</li><li>mesajele comerciale nesolicitate trimise în masă;</li><li>anunțurile duplicate excesiv;</li><li>recenziile fictive și manipularea reputației;</li><li>raportările abuzive;</li><li>colectarea masivă a datelor cu încălcarea legii;</li><li>accesarea neautorizată și perturbarea Platformei.</li></ul><p>Datele de contact publicate pentru o ofertă trebuie folosite în legătură cu aceasta. Publicarea lor nu reprezintă acord pentru includerea în baze de date de marketing.</p><p>Criticile formulate cu bună-credință, inclusiv cele privind Platforma, nu constituie prin ele însele un motiv de sancționare.</p><h4>10. Siguranța tranzacțiilor</h4><p>Utilizatorilor li se recomandă să verifice bunul, condițiile ofertei și dreptul vânzătorului de a-l comercializa înainte de efectuarea plății.</p><p>Apartenența la aceeași comunitate nu înlocuiește aceste verificări.</p><p>Publicarea sau menținerea unui anunț după moderare nu reprezintă certificarea autenticității produsului, a calității serviciului sau a executării tranzacției.</p><p>În cazul unei suspiciuni de fraudă, utilizatorul poate informa Operatorul și autoritățile competente, păstrând dovezile relevante.</p><h4>11. Raportarea conținutului</h4><p>Orice persoană poate semnala conținut presupus ilegal sau contrar regulilor la <strong><a href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a></strong>, fără a avea nevoie de cont. Poate fi utilizată și funcția de raportare, dacă este disponibilă.</p><p>Sesizarea trebuie să includă:</p><ul><li>localizarea exactă a conținutului, prin link sau identificator;</li><li>explicația motivelor raportării;</li><li>dovezile disponibile;</li><li>numele și adresa de e-mail, cu excepțiile legale;</li><li>confirmarea că informațiile sunt transmise cu bună-credință și sunt considerate exacte și complete.</li></ul><p>Operatorul confirmă primirea când dispune de date electronice de contact și comunică decizia și căile de contestare fără întârzieri nejustificate. Sesizările sunt tratate diligent, obiectiv și proporțional cu gravitatea situației.</p><h4>12. Politica de moderare</h4><p>Moderarea se realizează manual, de persoane desemnate de Operator, pe baza sesizărilor și a verificărilor proprii. Nu se promite verificarea prealabilă a fiecărui anunț.</p><p>Operatorul poate solicita corectarea unei oferte, limita vizibilitatea, elimina conținutul sau suspenda temporar contul. Închiderea definitivă poate interveni pentru fraude, abateri grave ori repetate.</p><p>Măsura ține cont de gravitate, impact și istoricul abaterilor. Pentru riscuri urgente se poate interveni imediat.</p><p>Persoanei afectate i se comunică motivul concret, temeiul, întinderea și durata restricției, precum și căile de contestare, cu excepțiile legale. Eventuala introducere a moderării automate va fi explicată prin actualizarea acestei politici.</p><h4>13. Contestarea măsurilor</h4><p>Utilizatorul poate solicita gratuit reanalizarea unei măsuri prin e-mail la <strong><a href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a></strong>, indicând contul sau anunțul, decizia și motivele contestației.</p><p>Cererea este examinată de o persoană desemnată. Dacă măsura este nejustificată, Operatorul o corectează și comunică rezultatul.</p><p>Procedura nu limitează drepturile legale de contestare, sesizarea autorităților sau accesul la instanță.</p><h4>14. Drepturile asupra materialelor</h4><p>Utilizatorul păstrează drepturile asupra conținutului propriu.</p><p>Prin publicare, acordă Operatorului o permisiune neexclusivă și gratuită de a stoca, reproduce, adapta tehnic și afișa materialele pentru funcționarea Platformei și prezentarea anunțului.</p><p>Permisiunea nu transferă proprietatea asupra materialelor și nu autorizează folosirea acestora în campanii publicitare externe fără un acord separat.</p><p>După retragerea conținutului, păstrarea unor copii este limitată la situații justificate privind copiile de siguranță, obligațiile legale sau apărarea unor drepturi.</p><h4>15. Gratuitate și servicii opționale</h4><p>Publicarea standard a anunțurilor este gratuită.</p><p>Eventualele servicii opționale contra cost vor avea prețul total, durata, caracteristicile și condițiile comunicate înainte de comandă. Nu vor fi activate fără acceptare expresă.</p><p>Anunțurile promovate vor fi identificate vizibil. Plata promovării nu garantează vânzarea și nu exonerează autorul de respectarea regulilor.</p><p>Criteriile principale care influențează ordinea ofertelor și efectul eventualelor promovări vor fi explicate în interfața de afișare a anunțurilor, potrivit funcționării reale.</p><h4>16. Date personale</h4><p>Modul de prelucrare a datelor personale este descris separat în Politica de Confidențialitate a Platformei. Utilizarea cookie-urilor și a tehnologiilor similare este explicată în informarea dedicată.</p><p>Acceptarea termenilor nu reprezintă consimțământ general pentru marketing sau pentru orice utilizare a datelor. Atunci când este necesar, consimțământul se solicită separat.</p><p>Utilizatorii nu trebuie să publice CNP-uri, copii ale actelor de identitate, date complete de card sau alte informații care nu sunt necesare prezentării ofertei.</p><p>Solicitările privind datele personale pot fi transmise la <strong><a href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a></strong>.</p><h4>17. Disponibilitate și răspundere</h4><p>Operatorul depune eforturi rezonabile pentru funcționarea și securitatea Platformei. Pot exista întreruperi pentru mentenanță, incidente tehnice sau cauze externe.</p><p>Nu se garantează disponibilitatea neîntreruptă, vânzarea bunurilor, un anumit număr de vizualizări ori comportamentul altor utilizatori.</p><p>Autorul răspunde pentru propriul anunț și pentru obligațiile asumate în tranzacție. Operatorul răspunde pentru propriile fapte și obligații potrivit legii.</p><p>Nicio clauză nu exclude răspunderea care nu poate fi limitată legal și nu restrânge drepturile obligatorii ale consumatorilor.</p><h4>18. Închiderea contului</h4><p>Utilizatorul poate solicita închiderea contului prin funcția disponibilă sau prin e-mail la <strong><a href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a></strong>. Pentru prevenirea solicitărilor neautorizate, Operatorul poate verifica în mod proporțional identitatea solicitantului.</p><p>Anunțurile active vor fi retrase la închiderea contului. Datele vor fi șterse sau păstrate limitat, în condițiile Politicii de confidențialitate și ale legii.</p><p>Închiderea contului nu anulează obligațiile din tranzacțiile deja încheiate și nu presupune ștergerea imediată a tuturor evidențelor necesare legal.</p><h4>19. Modificarea termenilor</h4><p>Termenii pot fi actualizați pentru modificări legislative, de securitate sau de funcționalitate.</p><p>Modificările relevante vor fi comunicate înainte de aplicare, cu un preaviz rezonabil, exceptând situațiile care impun intervenția imediată. Comunicarea va indica data aplicării.</p><p>Modificările nu produc efecte retroactive. Acceptarea expresă va fi solicitată când este necesară. Utilizatorul care nu acceptă noile condiții poate înceta utilizarea și solicita închiderea contului.</p><h4>20. Reclamații, lege aplicabilă și litigii</h4><p>Reclamațiile privind Platforma pot fi transmise la <strong><a href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a></strong>, cu descrierea situației și dovezile relevante.</p><p>Neînțelegerile dintre cumpărător și vânzător se soluționează între aceștia și, după caz, prin autorități sau instanțele abilitate. Operatorul poate analiza conduita utilizatorilor pentru aplicarea regulilor Platformei, fără a decide obligatoriu asupra litigiului.</p><p>Termenii sunt guvernați de legea română, fără înlăturarea protecției obligatorii de care consumatorul beneficiază potrivit legii aplicabile.</p><p>În funcție de obiectul sesizării, utilizatorul se poate adresa ANPC, ANSPDCP, ANCOM sau altor autorități competente. ANCOM supraveghează respectarea obligațiilor privind serviciile digitale, fără a înlocui instanțele în soluționarea litigiilor dintre utilizatori.</p><p>Accesul la autorități sau instanțele competente nu este condiționat de parcurgerea prealabilă a unei proceduri amiabile.</p></article>`;

const PRIVACY_POLICY_HTML=`<article class="legal-doc legal-privacy-doc"><h3 class="legal-doc-title">POLITICA DE CONFIDENȚIALITATE</h3><p class="legal-doc-subtitle"><strong>HUB Giuleștean — Support Hub Giuleștean 1923</strong></p>
<p class="legal-doc-meta">Versiunea 1.0</p><p class="legal-doc-meta">Data intrării în vigoare: [se completează la publicare]</p>
<h4>1. Cine răspunde pentru datele tale</h4>
<p>Operatorul datelor personale prelucrate prin HUB Giuleștean este
<strong>CASA DEL DANIEL DIGITAL CONSULTING S.R.L.</strong>, cu
următoarele date de identificare:</p>
<ul>
<li><strong>Sediul social:</strong> Strada Valea Gârboului nr. 5,
Florești, județul Cluj, România;</li>
<li><strong>Cod unic de înregistrare:</strong> 511***88;</li>
<li><strong>Număr de ordine în Registrul Comerțului:</strong>
J2025******001;</li>
<li><strong>Identificator unic european — EUID:</strong>
ROONRC.J2025******001;</li>
<li><strong>Telefon:</strong> 0753.670.173;</li>
<li><strong>E-mail:</strong> <a
href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a>.</li>
</ul>
<p>În această politică, „Platforma” înseamnă HUB Giuleștean, denumită și
„Support Hub Giuleștean 1923”.</p>
<p>Politica explică ce date folosim, de ce le folosim, cui le putem
comunica, cât timp le păstrăm și cum îți poți exercita drepturile.</p>
<h4>2. Principiile pe care le respectăm</h4>
<p>Prelucrăm datele pentru scopuri determinate și folosim numai
informațiile necesare îndeplinirii acestora.</p>
<p><strong>Nu vindem date personale.</strong></p>
<p>Nu folosim acceptarea Termenilor de utilizare drept acord general
pentru marketing sau pentru orice prelucrare a datelor.</p>
<p>Accesul la date este limitat în funcție de atribuții și de
necesitatea utilizării lor. Datele nu sunt păstrate nelimitat doar
pentru că ar putea deveni utile.</p>
<h4>3. Ce date putem prelucra</h4>
<p>În funcție de funcțiile utilizate, prelucrăm următoarele
categorii:</p>
<div class="legal-table-wrap"><table>
<colgroup>
<col style="width: 14%" />
<col style="width: 85%" />
</colgroup>
<thead>
<tr class="header">
<th>Categoria</th>
<th>Date vizate</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Cont și autentificare</td>
<td>Adresa de e-mail, identificatorul contului, numele de utilizator și
datele tehnice necesare autentificării și recuperării accesului.</td>
</tr>
<tr class="even">
<td>Profil și contact</td>
<td>Numele afișat, fotografia de profil, telefonul și localitatea, dacă
le furnizezi.</td>
</tr>
<tr class="odd">
<td>Anunțuri</td>
<td>Titlul, descrierea, fotografiile, categoria, prețul, localizarea
indicată și istoricul administrării anunțului.</td>
</tr>
<tr class="even">
<td>Favorite</td>
<td>Anunțurile salvate și asocierea acestora cu propriul cont.</td>
</tr>
<tr class="odd">
<td>Mesaje</td>
<td>Conținutul conversațiilor, participanții, data și ora transmiterii
și atașamentele, dacă funcția le permite.</td>
</tr>
<tr class="even">
<td>Asistență și moderare</td>
<td>Solicitările, raportările, dovezile transmise, răspunsurile și
măsurile luate.</td>
</tr>
<tr class="odd">
<td>Date tehnice și de securitate</td>
<td>Adresa IP, informații despre browser și dispozitiv, evenimente de
autentificare, erori și jurnale tehnice, în măsura în care sunt
colectate de infrastructura utilizată.</td>
</tr>
<tr class="even">
<td>Preferințe și acorduri</td>
<td>Versiunea termenilor acceptați și, unde este cazul, opțiunile
privind cookie-urile și comunicările comerciale.</td>
</tr>
</tbody>
</table></div>
<p>Nu solicităm în mod obișnuit CNP, copii ale actelor de identitate,
date complete de card sau informații medicale.</p>
<p>Nu publica asemenea date în anunțuri și nu transmite informații
despre alte persoane fără un temei justificat.</p>
<h4>4. De unde obținem datele</h4>
<p>Datele provin:</p>
<ul>
<li>direct de la tine, când creezi contul, publici, salvezi favorite,
trimiți mesaje sau ne contactezi;</li>
<li>din utilizarea Platformei, pentru operațiuni tehnice și
securitate;</li>
<li>de la alți utilizatori, dacă îți trimit mesaje sau depun o sesizare
care te privește;</li>
<li>de la autorități, atunci când există o comunicare legală
relevantă.</li>
</ul>
<p>Dacă primim informații despre tine de la alte persoane, le folosim
numai pentru scopul justificat și îndeplinim obligațiile de informare
aplicabile.</p>
<h4>5. Scopurile și temeiurile juridice</h4>
<div class="legal-table-wrap"><table>
<colgroup>
<col style="width: 45%" />
<col style="width: 54%" />
</colgroup>
<thead>
<tr class="header">
<th>Scop</th>
<th>Temei juridic</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Crearea contului, autentificarea și recuperarea accesului</td>
<td>Executarea contractului privind utilizarea Platformei — art. 6 alin.
(1) lit. b) GDPR.</td>
</tr>
<tr class="even">
<td>Publicarea și administrarea anunțurilor</td>
<td>Executarea contractului — art. 6 alin. (1) lit. b).</td>
</tr>
<tr class="odd">
<td>Favorite, mesagerie și contactul solicitat între utilizatori</td>
<td>Executarea contractului — art. 6 alin. (1) lit. b).</td>
</tr>
<tr class="even">
<td>Răspunsuri la solicitări privind propriul cont sau serviciul
utilizat</td>
<td>Executarea contractului — art. 6 alin. (1) lit. b).</td>
</tr>
<tr class="odd">
<td>Protejarea conturilor, prevenirea fraudei, securitate și
investigarea abuzurilor</td>
<td>Interes legitim — art. 6 alin. (1) lit. f), după evaluarea
necesității și a impactului asupra persoanelor.</td>
</tr>
<tr class="even">
<td>Aplicarea regulilor comunității, în afara obligațiilor legale
specifice</td>
<td>Interes legitim de administrare a unui serviciu sigur — art. 6 alin.
(1) lit. f).</td>
</tr>
<tr class="odd">
<td>Soluționarea cererilor GDPR și respectarea obligațiilor legale de
raportare ori comunicare</td>
<td>Obligație legală — art. 6 alin. (1) lit. c).</td>
</tr>
<tr class="even">
<td>Constatarea, exercitarea sau apărarea unor drepturi</td>
<td>Interes legitim — art. 6 alin. (1) lit. f).</td>
</tr>
<tr class="odd">
<td>Marketing opțional și tehnologii neesențiale care necesită
acord</td>
<td>Consimțământ — art. 6 alin. (1) lit. a), împreună cu regulile
speciale aplicabile.</td>
</tr>
</tbody>
</table></div>
<p>Nu considerăm orice activitate utilă Platformei ca fiind automat
necesară executării contractului.</p>
<p>Pentru prelucrările bazate pe interes legitim, evaluăm dacă scopul
poate fi atins prin mijloace mai puțin intruzive și dacă drepturile tale
prevalează.</p>
<p>Datele marcate ca obligatorii sunt necesare funcției solicitate. Dacă
nu le furnizezi, este posibil să nu putem crea contul sau presta funcția
respectivă. Refuzul marketingului opțional nu împiedică folosirea
funcțiilor de bază.</p>
<h4>6. Cine poate vedea datele tale</h4>
<p class="legal-doc-emphasis"><strong>Vizitatorii neautentificați</strong></p>
<p>Pot vedea conținutul public al anunțurilor și informațiile de profil
desemnate publice în interfață.</p>
<p><strong>Datele de contact direct din câmpurile dedicate nu sunt
afișate vizitatorilor neautentificați.</strong></p>
<p>Această protecție nu acoperă telefonul, e-mailul sau alte date pe
care le introduci chiar tu în descriere, în fotografii ori în alte zone
publice. Evită publicarea lor în aceste locuri.</p>
<p class="legal-doc-emphasis"><strong>Utilizatorii autentificați</strong></p>
<p>Pot accesa datele de contact destinate contactării autorului, conform
opțiunilor și funcțiilor Platformei. Autentificarea nu garantează că
destinatarul nu va copia informațiile.</p>
<p class="legal-doc-emphasis"><strong>Mesajele și favoritele</strong></p>
<p>Favoritele sunt asociate contului tău și nu sunt afișate public.</p>
<p>Mesajele sunt destinate participanților la conversație. Personalul
autorizat poate accesa punctual conținutul dacă este necesar pentru o
sesizare, un incident de securitate, asistență sau o obligație legală.
Accesul trebuie limitat la informațiile relevante.</p>
<p>Nu prezentăm mesageria ca fiind criptată integral între participanți
în lipsa unei asemenea implementări tehnice.</p>
<h4>7. Cui putem comunica datele</h4>
<p>În limita necesară, datele pot fi accesate de:</p>
<ul>
<li>ceilalți utilizatori, conform funcțiilor descrise mai sus;</li>
<li>personalul autorizat al Operatorului;</li>
<li>furnizori de găzduire, baze de date, autentificare, stocare și
livrare a e-mailurilor;</li>
<li>furnizori de securitate și suport tehnic;</li>
<li>consultanți profesionali, când este necesar pentru o problemă
concretă;</li>
<li>autorități și instanțe, în condițiile legii.</li>
</ul>
<p>Furnizorii care prelucrează date în numele nostru trebuie să aibă
obligații contractuale adecvate privind confidențialitatea, securitatea
și utilizarea datelor.</p>
<p><strong>[De completat înainte de publicare: furnizorii efectiv
utilizați, rolul fiecăruia, categoriile de date accesate și țările
relevante pentru prelucrare.]</strong></p>
<p>Faptul că nu vindem date nu exclude comunicarea lor către furnizorii
necesari funcționării serviciului.</p>
<h4>8. Prelucrarea în afara Spațiului Economic
European</h4>
<p>Unii furnizori pot implica stocarea datelor sau accesul la acestea
din afara Spațiului Economic European.</p>
<p>În asemenea situații, transferurile trebuie să se bazeze pe
mecanismele prevăzute de GDPR, precum o decizie de adecvare aplicabilă
sau clauze contractuale standard, împreună cu evaluările și măsurile
suplimentare necesare.</p>
<p><strong>[De completat înainte de publicare: transferurile efective,
țările, furnizorii și mecanismul aplicabil fiecărui
transfer.]</strong></p>
<p>Poți solicita informații despre garanțiile aplicabile și o copie a
acestora, cu protejarea informațiilor confidențiale justificate, la <a
href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a>.</p>
<h4>9. Cât timp păstrăm datele</h4>
<p><strong>Calendar propus — trebuie validat și implementat înainte de
publicare. Duratele de mai jos sunt alegeri de administrare, nu termene
generale impuse de GDPR.</strong></p>
<div class="legal-table-wrap"><table>
<colgroup>
<col style="width: 16%" />
<col style="width: 83%" />
</colgroup>
<thead>
<tr class="header">
<th>Categoria</th>
<th>Perioada propusă</th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>Cont și profil</td>
<td>Cât timp contul este activ. După închidere, eliminare din sistemele
active în cel mult 30 de zile, exceptând datele păstrate
justificat.</td>
</tr>
<tr class="even">
<td>Conturi neconfirmate</td>
<td>30 de zile de la înregistrare, apoi ștergere dacă înregistrarea nu a
fost finalizată.</td>
</tr>
<tr class="odd">
<td>Anunțuri și fotografii</td>
<td>Cât timp anunțul este activ; după retragere, eliminare din sistemele
active în cel mult 30 de zile, cu excepțiile justificate.</td>
</tr>
<tr class="even">
<td>Favorite</td>
<td>Până la eliminarea lor de către utilizator, eliminarea definitivă a
anunțului sau închiderea contului.</td>
</tr>
<tr class="odd">
<td>Mesaje</td>
<td>Maximum 12 luni de la ultima activitate în conversație, cu analiza
separată a cererilor de ștergere și a eventualelor litigii.</td>
</tr>
<tr class="even">
<td>Jurnale tehnice și de securitate</td>
<td>Maximum 90 de zile; extrasele relevante pentru un incident pot fi
păstrate separat pe durata investigării justificate.</td>
</tr>
<tr class="odd">
<td>Solicitări obișnuite de asistență</td>
<td>Maximum 12 luni de la soluționare.</td>
</tr>
<tr class="even">
<td>Dosare de moderare și cereri GDPR</td>
<td>Maximum 3 ani de la soluționare, numai pentru informațiile necesare
demonstrării modului de tratare și apărării drepturilor; cu verificarea
periodică a necesității.</td>
</tr>
<tr class="odd">
<td>Copii de siguranță</td>
<td>Eliminare prin rotația copiilor în maximum 90 de zile de la
ștergerea din sistemele active, după confirmarea compatibilității cu
furnizorii.</td>
</tr>
</tbody>
</table></div>
<p>Dacă anumite date sunt necesare pentru un litigiu sau trebuie
păstrate potrivit unei obligații legale, se reține numai partea
relevantă, cu acces restricționat, pentru perioada justificată.</p>
<p>Retragerea acordului pentru marketing oprește utilizarea în acest
scop. O evidență minimă a retragerii poate fi păstrată pentru
respectarea opțiunii tale.</p>
<h4>10. Cum soliciți ștergerea contului și a datelor</h4>
<p>Poți utiliza funcția de ștergere, dacă este disponibilă, sau poți
trimite o cerere la <strong><a
href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a></strong>.</p>
<p>Pentru identificarea solicitării, indică adresa de e-mail asociată
contului și dacă dorești închiderea contului, ștergerea unor date sau
ambele. Nu trebuie să folosești un formular sau un subiect
obligatoriu.</p>
<p>Procedura presupune:</p>
<ol type="1">
<li>Identificarea contului și, dacă există îndoieli rezonabile,
verificarea proporțională a identității.</li>
<li>Retragerea anunțurilor și dezactivarea accesului, dacă ai solicitat
închiderea contului.</li>
<li>Ștergerea sau anonimizarea ireversibilă a datelor eligibile.</li>
<li>Informarea ta despre rezultat și despre eventualele date păstrate,
motivele și durata păstrării.</li>
</ol>
<p>Nu solicităm în mod automat copia actului de identitate.</p>
<p>Închiderea contului nu înseamnă că toate mesajele dispar automat din
conversațiile celorlalți participanți. Evaluăm separat datele care pot
fi șterse, drepturile celorlalți și necesitatea păstrării unor dovezi.
Această situație nu justifică păstrarea nelimitată a conversațiilor.</p>
<p>Nu putem șterge direct capturile sau copiile realizate independent de
alte persoane. Acest lucru nu înlătură obligațiile noastre legale de
notificare a destinatarilor, atunci când sunt aplicabile.</p>
<p>Datele rămase temporar în copiile de siguranță nu sunt utilizate în
activitatea obișnuită. Dacă o copie este restaurată, măsurile de
ștergere trebuie reaplicate.</p>
<h4>11. Drepturile tale</h4>
<p>În condițiile GDPR, poți solicita:</p>
<ul>
<li>acces la date și o copie a acestora;</li>
<li>corectarea informațiilor inexacte;</li>
<li>ștergerea datelor;</li>
<li>restricționarea prelucrării;</li>
<li>portabilitatea datelor, pentru prelucrările automate bazate pe
contract sau consimțământ;</li>
<li>opoziție la prelucrările bazate pe interes legitim, pentru motive
legate de situația ta;</li>
<li>oprirea marketingului direct;</li>
<li>retragerea consimțământului, fără afectarea legalității prelucrării
anterioare.</li>
</ul>
<p>Răspundem fără întârzieri nejustificate și, în principiu, în cel mult
o lună de la primirea cererii. Pentru cereri complexe sau numeroase,
termenul poate fi prelungit cu încă două luni, cu informarea ta în prima
lună și explicarea motivelor.</p>
<p>Exercitarea drepturilor este, de regulă, gratuită. Dacă nu putem da
curs unei cereri, comunicăm motivele și opțiunile de contestare.</p>
<h4>12. Cookie-uri și comunicări</h4>
<p>Tehnologiile strict necesare autentificării, securității și
funcțiilor solicitate sunt descrise în informarea privind
cookie-urile.</p>
<p>Tehnologiile de analiză sau publicitate care necesită consimțământ
vor fi activate numai după exprimarea acestuia. Refuzul și retragerea
trebuie să fie accesibile.</p>
<p><strong>[De completat în politica de cookie-uri: inventarul real,
furnizorii, scopurile și duratele.]</strong></p>
<p>E-mailurile de confirmare a contului, recuperare a accesului și
notificările necesare serviciului sunt distincte de comunicările de
marketing.</p>
<h4>13. Securitatea datelor</h4>
<p>Aplicăm măsuri tehnice și organizatorice proporționale cu riscurile,
inclusiv limitarea accesului și gestionarea incidentelor.</p>
<p>Niciun serviciu online nu poate garanta eliminarea tuturor
riscurilor. Dacă un incident impune informarea autorității sau a
persoanelor afectate, vom proceda conform obligațiilor legale.</p>
<p>Pentru siguranța contului, folosește o parolă unică și nu comunica
altor persoane codurile de autentificare.</p>
<h4>14. Minori și decizii automate</h4>
<p>Crearea contului este destinată persoanelor de minimum 18 ani,
conform Termenilor de utilizare. Dacă aflăm că un cont nu respectă
această condiție, verificăm situația și luăm măsuri proporționale
privind contul și datele sale.</p>
<p><strong>[De confirmat înainte de publicare: Platforma nu adoptă
decizii exclusiv automate care produc efecte juridice sau afectează
similar, în mod semnificativ, utilizatorii.]</strong></p>
<p>Dacă sunt introduse asemenea prelucrări, informarea va explica logica
relevantă, consecințele și garanțiile aplicabile.</p>
<h4>15. Reclamații și actualizarea politicii</h4>
<p>Pentru orice întrebare sau solicitare privind datele personale, ne
poți contacta la <strong><a
href="mailto:office.casadeldaniel@aol.com">office.casadeldaniel@aol.com</a></strong>.</p>
<p>Ai dreptul să depui o plângere la <strong>Autoritatea Națională de
Supraveghere a Prelucrării Datelor cu Caracter Personal —
ANSPDCP</strong>, prin modalitățile prezentate pe <a
href="https://www.dataprotection.ro">www.dataprotection.ro</a>, și să te
adresezi instanțelor competente.</p>
<p>Putem actualiza politica atunci când se modifică funcțiile,
furnizorii sau cerințele legale. Modificările relevante vor fi
comunicate corespunzător. Publicarea unei versiuni noi nu înlocuiește
consimțământul, acolo unde acesta este necesar.</p>
</article>`;

function openLegal(type){
  const privacy=type==='privacy';
  const title=privacy?'Confidențialitate':'Termeni de utilizare și politica de moderare';
  const body=privacy
    ?PRIVACY_POLICY_HTML
    :TERMS_OF_USE_HTML;
  $('#legalContent').innerHTML=`<div class="modal-head legal-modal-head"><div><span class="kicker">HUB • GIULEȘTI • 1923</span><h2>${title}</h2></div><button class="close" data-close="legalModal">×</button></div>${body}`;
  bindCloseButtons($('#legalContent'));
  $('#legalModal').showModal();
}

init().catch(err=>{console.error(err);toast('Aplicația nu s-a inițializat corect.','error');});

