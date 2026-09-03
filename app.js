
const SUPABASE_URL = 'https://bhqpixyiojthpfqnyhsh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_U2IRhs6K85S43ZRqKK5U8Q_HSknWMNY';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const state = { session:null, user:null, profile:null, categories:[], listings:[], favorites:new Set(), selectedListing:null, authMode:'login', accountTab:'listings' };
const icons = { 'rapid-colectii':'⚑','auto-moto':'◉','electronice':'▣','telefoane':'▯','haine-incaltaminte':'♢','casa-gradina':'⌂','servicii':'✦','bilete':'▥','imobiliare':'▤','joburi':'▰','donez-caut':'♡','diverse':'•••' };
const conditionLabels = {new:'Nou',like_new:'Ca nou',used:'Utilizat',damaged:'Cu defecte',service:'Serviciu',not_applicable:'N/A'};

function esc(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
function money(n,c='RON'){return new Intl.NumberFormat('ro-RO',{style:'currency',currency:c,maximumFractionDigits:c==='RON'?0:2}).format(Number(n||0));}
function since(iso){const d=(Date.now()-new Date(iso).getTime())/1000;if(d<60)return 'acum';if(d<3600)return `acum ${Math.floor(d/60)} min`;if(d<86400)return `acum ${Math.floor(d/3600)} h`;if(d<172800)return 'ieri';return new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'short'}).format(new Date(iso));}
function cleanPhone(v=''){return String(v).replace(/[^0-9+]/g,'');}
function whatsappPhone(v=''){let p=cleanPhone(v);if(p.startsWith('0'))p='40'+p.slice(1);if(p.startsWith('+'))p=p.slice(1);return p;}
function isAdmin(){return state.user?.app_metadata?.role === 'admin';}
function toast(text,type='info'){const el=$('#toast');el.textContent=text;el.dataset.type=type;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3200);}
function closeDialog(id){const d=document.getElementById(id);if(d?.open)d.close();}
function requireAuth(next){if(state.user){next?.();return true;}openAuth('login');toast('Ai nevoie de cont pentru această acțiune.');return false;}
function setBusy(button,busy,label){if(!button)return; if(busy){button.dataset.label=button.textContent;button.disabled=true;button.textContent=label||'Se procesează…';}else{button.disabled=false;button.textContent=button.dataset.label||button.textContent;}}

function publicStorageUrl(bucket,path){if(!path)return '';return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}`;}
function initials(name='Membru'){return String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'M';}
function avatarUrl(profile){return profile?.avatar_path?publicStorageUrl('profile-avatars',profile.avatar_path):'';}
function avatarHtml(profile,cls='avatar'){const name=profile?.display_name||'Membru',url=avatarUrl(profile);return url?`<span class="${cls} has-image"><img src="${esc(url)}" alt="${esc(name)}"></span>`:`<span class="${cls}">${esc(initials(name))}</span>`;}

async function init(){
  bindStaticEvents();
  showListingSkeletons();
  const {data:{session}}=await db.auth.getSession();
  await applySession(session);
  await Promise.all([loadCategories(), loadListings()]);
  if(state.user) await loadFavorites();
  renderAll();
  db.auth.onAuthStateChange(async (_event, session)=>{await applySession(session);await loadListings();if(state.user)await loadFavorites();else state.favorites.clear();renderAll();});
}

async function applySession(session){
  state.session=session;state.user=session?.user||null;state.profile=null;
  if(state.user){const {data}=await db.from('profiles').select('*').eq('id',state.user.id).maybeSingle();state.profile=data||null;}
  updateAccountButtons();
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

function renderCategories(){
  const grid=$('#categoryGrid');grid.innerHTML=state.categories.map(c=>`<button class="category" data-cat="${c.id}"><span class="icon">${icons[c.slug]||c.icon||'◈'}</span><b>${esc(c.name)}</b><small>Vezi anunțurile</small></button>`).join('');
  const opts=state.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#categoryFilter').innerHTML='<option value="all">Toate categoriile</option>'+opts;
  $('#sellCategory').innerHTML='<option value="">Alege categoria</option>'+opts;
  $$('.category').forEach(b=>b.onclick=()=>{$('#categoryFilter').value=b.dataset.cat;renderListings();$('#anunturi').scrollIntoView({behavior:'smooth'});});
}

function filteredListings(){
  const q=$('#searchInput').value.trim().toLowerCase();const cat=$('#categoryFilter').value;const sort=$('#sortSelect').value;
  let rows=state.listings.filter(l=>(cat==='all'||l.category_id===cat)&&(!q||`${l.title} ${l.description} ${l.location}`.toLowerCase().includes(q)));
  if(sort==='low')rows.sort((a,b)=>Number(a.price)-Number(b.price));else if(sort==='high')rows.sort((a,b)=>Number(b.price)-Number(a.price));else rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  return rows;
}

function renderListings(){
  const rows=filteredListings();$('#emptyState').hidden=rows.length>0;
  $('#listingGrid').innerHTML=rows.map(cardHtml).join('');
  bindListingCards($('#listingGrid'));
}

function cardHtml(l){
  const cat=state.categories.find(c=>c.id===l.category_id);const own=state.user?.id===l.seller_id;const image=l.images?.[0];
  return `<article class="listing-card" data-id="${l.id}">
    <button class="fav ${state.favorites.has(l.id)?'active':''}" data-fav="${l.id}" aria-label="Favorite">${state.favorites.has(l.id)?'♥':'♡'}</button>
    <div class="listing-image ${image?'has-photo':''}"><span class="badge">${esc(conditionLabels[l.condition]||l.condition)}</span>${image?`<img src="${esc(image)}" alt="${esc(l.title)}" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.remove('has-photo')">`:`<span class="placeholder-icon">${icons[cat?.slug]||'◈'}</span>`}${own?'<span class="owner-badge">Al tău</span>':''}</div>
    <div class="listing-body"><h3 class="listing-title">${esc(l.title)}</h3><div class="price">${money(l.price,l.currency)}</div><div class="listing-meta"><span>${esc(l.location)}</span><span>${since(l.created_at)}</span></div></div>
  </article>`;
}

function bindListingCards(root=document){
  $$('[data-fav]',root).forEach(b=>b.onclick=async e=>{e.stopPropagation();await toggleFavorite(b.dataset.fav);});
  $$('.listing-card',root).forEach(c=>c.onclick=()=>openDetail(c.dataset.id));
}

async function toggleFavorite(listingId){
  if(!requireAuth())return;
  if(state.favorites.has(listingId)){const {error}=await db.from('favorites').delete().eq('user_id',state.user.id).eq('listing_id',listingId);if(error)return toast(error.message,'error');state.favorites.delete(listingId);}
  else{const {error}=await db.from('favorites').insert({user_id:state.user.id,listing_id:listingId});if(error)return toast(error.message,'error');state.favorites.add(listingId);}
  renderListings();if($('#accountModal').open&&state.accountTab==='favorites')renderAccount();
}

async function openDetail(id){
  const l=state.listings.find(x=>x.id===id);if(!l)return;state.selectedListing=l;
  const [{data:profile},{data:flag}]=await Promise.all([
    db.from('profiles').select('display_name,location,bio,avatar_path,created_at').eq('id',l.seller_id).maybeSingle(),
    db.from('user_flags').select('verified').eq('user_id',l.seller_id).maybeSingle()
  ]);
  const cat=state.categories.find(c=>c.id===l.category_id);const own=state.user?.id===l.seller_id;const photos=l.images?.length?`<div class="photo-grid">${l.images.map((u,i)=>`<button class="photo-thumb ${i===0?'main':''}" data-photo="${esc(u)}"><img src="${esc(u)}" alt="Fotografie ${i+1} — ${esc(l.title)}" loading="lazy"></button>`).join('')}</div>`:`<div class="detail-photo placeholder">${icons[cat?.slug]||'◈'}</div>`;
  $('#detailContent').innerHTML=`<div class="modal-head"><div><span class="kicker">${esc(cat?.name||'ANUNȚ')}</span><h2>${esc(l.title)}</h2></div><button class="close" type="button" data-close="detailModal">×</button></div>
    ${photos}<div class="detail-layout"><div><p class="detail-price">${money(l.price,l.currency)} ${l.negotiable?'<small>negociabil</small>':''}</p><p class="detail-desc">${esc(l.description).replace(/\n/g,'<br>')}</p><p class="listing-meta"><span>${esc(l.location)} • ${esc(conditionLabels[l.condition]||l.condition)}</span><span>${since(l.created_at)}</span></p></div>
    <aside class="seller-box"><div class="seller-profile">${avatarHtml(profile,'seller-avatar')}<div><span class="kicker">${own?'ANUNȚUL TĂU':'VÂNZĂTOR'}</span><h3>${esc(profile?.display_name||'Membru')}${flag?.verified?' <span class="verified">✓</span>':''}</h3></div></div><p>${profile?.location?`${esc(profile.location)} • `:''}${profile?.created_at?`Membru din ${new Intl.DateTimeFormat('ro-RO',{month:'long',year:'numeric'}).format(new Date(profile.created_at))}`:''}</p>${profile?.bio?`<p class="seller-bio">${esc(profile.bio)}</p>`:''}${own?'<button class="ghost" id="detailSoldBtn">Marchează vândut / reactivează</button><button class="danger detail-delete" id="detailDeleteBtn">Șterge anunțul</button>':'<button class="primary" id="detailMessageBtn">Trimite mesaj</button><button class="ghost" id="detailContactBtn">Telefon / WhatsApp</button><button class="report-btn" id="detailReportBtn">Raportează anunțul</button>'}</aside></div>`;
  bindCloseButtons($('#detailContent'));
  if(own){$('#detailSoldBtn').onclick=async()=>{await markSold(l.id);closeDialog('detailModal');};$('#detailDeleteBtn').onclick=()=>deleteListing(l.id,true);}else{$('#detailMessageBtn').onclick=()=>openMessage(l);$('#detailContactBtn').onclick=()=>showContact(l);$('#detailReportBtn').onclick=()=>reportListing(l);}
  $$('.photo-thumb',$('#detailContent')).forEach(b=>b.onclick=()=>openPhoto(b.dataset.photo));
  $('#detailModal').showModal();
}

function openPhoto(url){window.open(url,'_blank','noopener,noreferrer');}

async function showContact(l){
  if(!requireAuth())return;
  const {data,error}=await db.from('listing_contacts').select('phone,whatsapp').eq('listing_id',l.id).maybeSingle();
  if(error){console.error(error);return toast('Nu am putut încărca datele de contact.','error');}
  if(!data)return toast('Vânzătorul nu a adăugat contact direct.');
  const buttons=[];if(data.phone)buttons.push(`<a class="primary link-button" href="tel:${esc(cleanPhone(data.phone))}">Sună ${esc(data.phone)}</a>`);if(data.whatsapp)buttons.push(`<a class="whatsapp link-button" target="_blank" rel="noopener" href="https://wa.me/${esc(whatsappPhone(data.whatsapp))}">WhatsApp</a>`);
  const box=$('.seller-box',$('#detailContent'));$('.contact-reveal',box)?.remove();box.insertAdjacentHTML('beforeend',`<div class="contact-reveal">${buttons.join('')}</div>`);
}

function openMessage(l){
  if(!requireAuth())return;if(l.seller_id===state.user.id)return toast('Nu îți poți trimite mesaj propriului anunț.');
  $('#messageListingTitle').textContent=l.title;$('#messageForm [name=listing_id]').value=l.id;$('#messageForm [name=seller_id]').value=l.seller_id;$('#messageForm [name=body]').value='Salut! Mai este disponibil?';$('#messageModal').showModal();
}

async function sendMessage(e){
  e.preventDefault();if(!requireAuth())return;const form=e.currentTarget,btn=form.querySelector('.primary'),fd=new FormData(form);setBusy(btn,true,'Se trimite…');
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
  if(!requireAuth())return;if(l.seller_id===state.user.id)return toast('Nu îți poți raporta propriul anunț.');
  const reason=prompt('Motiv: fraudă / ilegal / contrafăcut / spam / înșelător / nepotrivit / altul','spam');if(!reason)return;
  const map={'fraudă':'fraud','frauda':'fraud','ilegal':'illegal','contrafăcut':'counterfeit','contrafacut':'counterfeit','spam':'spam','înșelător':'misleading','inselator':'misleading','nepotrivit':'inappropriate','altul':'other'};
  const code=map[reason.toLowerCase()]||'other';const {error}=await db.from('reports').insert({reporter_id:state.user.id,listing_id:l.id,reason:code});
  if(error){if(error.code==='23505')return toast('Ai raportat deja acest anunț.');console.error(error);return toast('Raportarea nu a putut fi trimisă.','error');}toast('Raport trimis către moderare.');
}

function openAuth(mode='login'){state.authMode=mode;updateAuthMode();$('#authModal').showModal();}
function updateAuthMode(){const signup=state.authMode==='signup';$('#authTitle').textContent=signup?'Creează cont':'Intră în cont';$('#authSubmit').textContent=signup?'Creează cont':'Intră în cont';$('#displayNameField').hidden=!signup;$('#authForm [name=password]').autocomplete=signup?'new-password':'current-password';$$('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b.dataset.authMode===state.authMode));}
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

function openSell(){if(!requireAuth())return;$('#sellModal').showModal();}
async function publishListing(e){
  e.preventDefault();if(!requireAuth())return;const form=e.currentTarget,btn=$('#publishBtn'),fd=new FormData(form),files=[...form.elements.images.files];
  if(files.length>8)return toast('Poți încărca maximum 8 fotografii.','error');if(!fd.get('phone')&&!fd.get('whatsapp'))return toast('Adaugă telefon sau WhatsApp pentru contact direct.','error');
  setBusy(btn,true,'Se publică…');let listingId=null;
  try{
    const row={seller_id:state.user.id,category_id:fd.get('category'),title:String(fd.get('title')).trim(),description:String(fd.get('description')).trim(),price:Number(fd.get('price')),currency:fd.get('currency'),condition:fd.get('condition'),location:String(fd.get('location')).trim(),negotiable:fd.get('negotiable')==='on'};
    const r=await db.from('listings').insert(row).select('id').single();if(r.error)throw r.error;listingId=r.data.id;
    const contact={listing_id:listingId,seller_id:state.user.id,phone:String(fd.get('phone')||'').trim()||null,whatsapp:String(fd.get('whatsapp')||'').trim()||null};const rc=await db.from('listing_contacts').insert(contact);if(rc.error)throw rc.error;
    for(let i=0;i<files.length;i++){
      const f=files[i];if(f.size>6*1024*1024)throw new Error(`Imaginea ${f.name} depășește 6 MB.`);
      const ext=(f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${state.user.id}/${listingId}/${crypto.randomUUID()}.${ext}`;
      const up=await db.storage.from('listing-images').upload(path,f,{cacheControl:'3600',upsert:false,contentType:f.type});if(up.error)throw up.error;
      const ri=await db.from('listing_images').insert({listing_id:listingId,storage_path:path,sort_order:i});if(ri.error)throw ri.error;
    }
    form.reset();form.elements.location.value='București';closeDialog('sellModal');await loadListings();renderListings();toast('Anunț publicat în Support Hub Giuleștean 1923.');$('#anunturi').scrollIntoView({behavior:'smooth'});
  }catch(err){console.error(err);toast(err.message||'Anunțul nu a putut fi publicat.','error');if(listingId)await db.from('listings').delete().eq('id',listingId);}finally{setBusy(btn,false);}
}

async function openAccount(tab='listings'){
  if(!requireAuth())return;state.accountTab=tab;$('#accountName').textContent=state.profile?.display_name||'Contul meu';$('#accountEmail').textContent=state.user.email||'';$('#accountAvatar').innerHTML=avatarHtml(state.profile,'account-avatar-inner');$('#adminTab').hidden=!isAdmin();updateAccountTabButtons();await renderAccount();$('#accountModal').showModal();
}
function updateAccountTabButtons(){$$('[data-account-tab]').forEach(b=>b.classList.toggle('active',b.dataset.accountTab===state.accountTab));}
async function renderAccount(){
  const root=$('#accountContent');root.innerHTML='<div class="loading-line">Se încarcă…</div>';
  try{
    if(state.accountTab==='listings'){
      const own=state.listings.filter(l=>l.seller_id===state.user.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      let statuses={};if(own.length){const {data}=await db.from('listing_approvals').select('listing_id,status').in('listing_id',own.map(x=>x.id));(data||[]).forEach(x=>statuses[x.listing_id]=x.status);}
      root.innerHTML=own.length?`<div class="account-list">${own.map(l=>`<div class="account-row"><div><b>${esc(l.title)}</b><small>${money(l.price,l.currency)} • ${esc(l.location)}</small></div><span class="status ${statuses[l.id]||'approved'}">${statuses[l.id]==='pending'?'În moderare':statuses[l.id]==='rejected'?'Respins':'Activ'}</span><button class="ghost mini" data-sold="${l.id}">${l.state==='sold'?'Vândut':'Marchează vândut'}</button><button class="danger mini" data-delete="${l.id}">Șterge</button></div>`).join('')}</div>`:'<div class="empty compact"><b>N-ai publicat încă.</b><span>Primul anunț poate fi pus chiar acum.</span></div>';
      $$('[data-sold]',root).forEach(b=>b.onclick=()=>markSold(b.dataset.sold));$$('[data-delete]',root).forEach(b=>b.onclick=()=>deleteListing(b.dataset.delete));
    } else if(state.accountTab==='favorites'){
      const favs=state.listings.filter(l=>state.favorites.has(l.id));root.innerHTML=favs.length?`<div class="listing-grid account-grid">${favs.map(cardHtml).join('')}</div>`:'<div class="empty compact"><b>N-ai favorite.</b><span>Apasă ♡ pe un anunț ca să-l păstrezi aici.</span></div>';bindListingCards(root);
    } else if(state.accountTab==='messages'){
      await renderMessages(root);
    } else if(state.accountTab==='admin'&&isAdmin()){
      await renderAdmin(root);
    }
  }catch(err){console.error(err);root.innerHTML=`<div class="status-banner">${esc(err.message||'Nu am putut încărca această secțiune.')}</div>`;}
}

async function markSold(id){const l=state.listings.find(x=>x.id===id);if(!l)return;const next=l.state==='sold'?'active':'sold';const {error}=await db.from('listings').update({state:next}).eq('id',id);if(error)return toast(error.message,'error');await loadListings();renderListings();renderAccount();toast(next==='sold'?'Marcat ca vândut.':'Anunț reactivat.');}
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

function openProfileEditor(){
  if(!requireAuth())return;const f=$('#profileForm');f.elements.display_name.value=state.profile?.display_name||'';f.elements.location.value=state.profile?.location||'';f.elements.bio.value=state.profile?.bio||'';f.elements.avatar.value='';f.elements.remove_avatar.checked=false;$('#profilePreview').innerHTML=avatarHtml(state.profile,'profile-preview-avatar');$('#profileModal').showModal();
}
async function saveProfile(e){
  e.preventDefault();if(!requireAuth())return;const form=e.currentTarget,btn=$('#profileSaveBtn'),fd=new FormData(form),file=form.elements.avatar.files?.[0];setBusy(btn,true,'Se salvează…');
  try{
    const display=String(fd.get('display_name')||'').trim();if(display.length<2)throw new Error('Numele trebuie să aibă minimum 2 caractere.');
    let nextAvatar=state.profile?.avatar_path||null;const oldAvatar=nextAvatar;
    if(fd.get('remove_avatar')==='on'){nextAvatar=null;}
    if(file){if(file.size>3*1024*1024)throw new Error('Avatarul poate avea maximum 3 MB.');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Avatarul trebuie să fie JPG, PNG sau WEBP.');const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${state.user.id}/avatar-${Date.now()}.${ext}`;const up=await db.storage.from('profile-avatars').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});if(up.error)throw up.error;nextAvatar=path;}
    const patch={display_name:display,location:String(fd.get('location')||'').trim()||null,bio:String(fd.get('bio')||'').trim()||null,avatar_path:nextAvatar};
    const {data,error}=await db.from('profiles').update(patch).eq('id',state.user.id).select('*').single();if(error)throw error;state.profile=data;
    if(oldAvatar&&oldAvatar!==nextAvatar){const rm=await db.storage.from('profile-avatars').remove([oldAvatar]);if(rm.error)console.warn('old avatar cleanup',rm.error);}
    closeDialog('profileModal');updateAccountButtons();$('#accountName').textContent=state.profile.display_name;$('#accountAvatar').innerHTML=avatarHtml(state.profile,'account-avatar-inner');toast('Profil actualizat.');
  }catch(err){console.error(err);toast(err.message||'Profilul nu a putut fi salvat.','error');}finally{setBusy(btn,false);}
}


async function renderMessages(root){
  const {data:convs,error}=await db.from('conversations').select('id,listing_id,buyer_id,seller_id,updated_at').order('updated_at',{ascending:false});if(error)throw error;
  if(!convs?.length){root.innerHTML='<div class="empty compact"><b>N-ai conversații.</b><span>Mesajele pornite din anunțuri vor apărea aici.</span></div>';return;}
  const lmap=Object.fromEntries(state.listings.map(l=>[l.id,l]));
  const cards=[];
  for(const c of convs){const {data:msgs}=await db.from('messages').select('id,sender_id,body,created_at').eq('conversation_id',c.id).order('created_at',{ascending:true}).limit(40);const last=msgs?.[msgs.length-1];cards.push(`<button class="conversation-card" data-conv="${c.id}" data-listing="${c.listing_id}" data-other="${c.buyer_id===state.user.id?c.seller_id:c.buyer_id}"><b>${esc(lmap[c.listing_id]?.title||'Anunț')}</b><span>${esc(last?.body||'Conversație nouă')}</span><small>${last?since(last.created_at):''}</small></button>`);}
  root.innerHTML=`<div class="conversation-list">${cards.join('')}</div><div class="thread" id="threadPane"><div class="thread-placeholder">Alege o conversație.</div></div>`;
  $$('[data-conv]',root).forEach(b=>b.onclick=()=>openThread(b));
}

async function openThread(button){
  const pane=$('#threadPane');const id=button.dataset.conv;const {data:msgs,error}=await db.from('messages').select('id,sender_id,body,created_at').eq('conversation_id',id).order('created_at');if(error)return toast(error.message,'error');
  pane.innerHTML=`<div class="thread-messages">${(msgs||[]).map(m=>`<div class="bubble ${m.sender_id===state.user.id?'mine':''}"><span>${esc(m.body)}</span><small>${since(m.created_at)}</small></div>`).join('')}</div><form class="thread-form" data-thread-form="${id}"><input name="body" maxlength="2000" required placeholder="Scrie un mesaj…"><button class="primary">Trimite</button></form>`;
  $('[data-thread-form]',pane).onsubmit=async e=>{e.preventDefault();const input=e.currentTarget.body;const body=input.value.trim();if(!body)return;const {error}=await db.from('messages').insert({conversation_id:id,sender_id:state.user.id,body});if(error)return toast(error.message,'error');input.value='';await openThread(button);};
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
  $('#authForm').addEventListener('submit',submitAuth);$('#sellForm').addEventListener('submit',publishListing);$('#messageForm').addEventListener('submit',sendMessage);
  $('#logoutBtn').onclick=async()=>{await db.auth.signOut();closeDialog('accountModal');toast('Ai ieșit din cont.');};$('#editProfileBtn').onclick=openProfileEditor;$('#profileForm').addEventListener('submit',saveProfile);$('#profileForm [name=avatar]').onchange=e=>{const f=e.target.files?.[0];if(f){const u=URL.createObjectURL(f);$('#profilePreview').innerHTML=`<span class="profile-preview-avatar has-image"><img src="${esc(u)}" alt="Preview avatar"></span>`;}};
  $$('[data-account-tab]').forEach(b=>b.onclick=async()=>{state.accountTab=b.dataset.accountTab;updateAccountTabButtons();await renderAccount();});
  $('#searchBtn').onclick=()=>{renderListings();$('#anunturi').scrollIntoView({behavior:'smooth'});};$('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#searchBtn').click();});
  $$('[data-search]').forEach(b=>b.onclick=()=>{$('#searchInput').value=b.dataset.search;$('#searchBtn').click();});
  $('#categoryFilter').onchange=renderListings;$('#sortSelect').onchange=renderListings;$('#allCategories').onclick=()=>{$('#categoryFilter').value='all';renderListings();};
  $$('[data-focus-search]').forEach(b=>b.onclick=()=>{scrollTo({top:0,behavior:'smooth'});setTimeout(()=>$('#searchInput').focus(),300);});$$('[data-home]').forEach(b=>b.onclick=()=>scrollTo({top:0,behavior:'smooth'}));$$('[data-favorites]').forEach(b=>b.onclick=()=>openAccount('favorites'));
  $$('[data-legal]').forEach(a=>a.onclick=e=>{e.preventDefault();openLegal(a.dataset.legal);});
  $('#sellForm [name=images]').onchange=e=>{const n=e.target.files.length;$('#imageHelp').textContent=n?`${n} fotografie${n===1?'':'i'} selectată${n===1?'':'e'}.`:'JPG, PNG sau WEBP. Recomandat sub 5 MB / imagine.';};
  ['authModal','sellModal','detailModal','messageModal','accountModal','profileModal','legalModal'].forEach(id=>{const d=document.getElementById(id);d.addEventListener('click',e=>{if(e.target===d)d.close();});});
}

function openLegal(type){const title=type==='privacy'?'Confidențialitate':'Termeni de utilizare';const body=type==='privacy'?`Support Hub Giuleștean 1923 folosește datele necesare pentru cont, publicarea anunțurilor, favorite, mesaje și contact între utilizatori. Datele de contact direct nu sunt afișate vizitatorilor neautentificați. Nu vindem date personale. Pentru lansarea publică, această pagină trebuie completată cu operatorul de date, baza legală, perioada de retenție și procedura de ștergere.`:`Support Hub Giuleștean 1923 este o platformă independentă de anunțuri și nu este parte în tranzacții. Utilizatorul este responsabil pentru legalitatea, autenticitatea și descrierea bunurilor sau serviciilor publicate. Sunt interzise produsele ilegale, fraudele, conținutul care încalcă drepturile altora și anunțurile înșelătoare. Pentru lansarea publică, termenii trebuie completați cu datele operatorului și politica de moderare.`;$('#legalContent').innerHTML=`<div class="modal-head"><div><span class="kicker">FSH • GIULEȘTI • 1923</span><h2>${title}</h2></div><button class="close" data-close="legalModal">×</button></div><p class="detail-desc">${body}</p>`;bindCloseButtons($('#legalContent'));$('#legalModal').showModal();}

init().catch(err=>{console.error(err);toast('Aplicația nu s-a inițializat corect.','error');});

