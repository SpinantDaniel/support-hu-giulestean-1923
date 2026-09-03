const SUPABASE_URL='https://bhqpixyiojthpfqnyhsh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_U2IRhs6K85S43ZRqKK5U8Q_HSknWMNY';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const imageUrl=path=>path?`${SUPABASE_URL}/storage/v1/object/public/blog-images/${String(path).split('/').map(encodeURIComponent).join('/')}`:'';
const fmt=d=>new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(d));
const state={session:null,posts:[],likes:new Map(),comments:new Map(),liked:new Set(),search:'',sort:'none',article:null,articleComments:[]};

function paragraphs(text=''){return String(text).split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');}
function initials(name='Membru'){return String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'M';}
function avatarUrl(path){return path?`${SUPABASE_URL}/storage/v1/object/public/profile-avatars/${String(path).split('/').map(encodeURIComponent).join('/')}`:'';}
function count(map,id){return Number(map.get(id)||0);}
function likeIcon(){return '<svg class="thumb-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>';}

async function currentSession(){const {data}=await db.auth.getSession();state.session=data.session||null;return state.session;}
function needAccount(action='interacționa'){alert(`Trebuie să fii autentificat pentru a ${action}. Intră în cont din Marketplace.`);}
async function shareContent(title,text,url){
  if(navigator.share){
    try{await navigator.share({title,text,url});return;}catch(e){if(e?.name==='AbortError')return;}
  }
  try{await navigator.clipboard.writeText(url);alert('Linkul a fost copiat.');}
  catch(e){prompt('Copiază linkul:',url);}
}

async function init(){
  await currentSession();
  const slug=new URLSearchParams(location.search).get('post');
  if(slug)return showArticle(slug);
  bindControls();
  await loadPosts();
}

function bindControls(){
  $('#newsSearch').addEventListener('input',e=>{state.search=e.target.value.trim().toLocaleLowerCase('ro');renderList();});
  $('#newsSort').addEventListener('change',e=>{state.sort=e.target.value;renderList();});
}

async function loadPosts(){
  const {data,error}=await db.from('blog_posts').select('id,title,slug,excerpt,body,image_path,author_name,published_at').eq('status','published').order('published_at',{ascending:false});
  if(error){console.error(error);$('#newsList').innerHTML='<div class="empty">Noutățile nu sunt disponibile momentan.</div>';return;}
  state.posts=data||[];
  await loadEngagement(state.posts.map(p=>p.id));
  renderList();
}

async function loadEngagement(ids){
  state.likes=new Map();state.comments=new Map();state.liked=new Set();
  if(!ids.length)return;
  const calls=[
    db.from('blog_post_like_counts').select('post_id,likes_count').in('post_id',ids),
    db.from('blog_post_comment_counts').select('post_id,comments_count').in('post_id',ids)
  ];
  if(state.session?.user)calls.push(db.from('blog_post_likes').select('post_id').eq('user_id',state.session.user.id).in('post_id',ids));
  const results=await Promise.all(calls);
  (results[0].data||[]).forEach(r=>state.likes.set(r.post_id,Number(r.likes_count||0)));
  (results[1].data||[]).forEach(r=>state.comments.set(r.post_id,Number(r.comments_count||0)));
  (results[2]?.data||[]).forEach(r=>state.liked.add(r.post_id));
}

function filteredPosts(){
  let rows=state.posts.filter(p=>!state.search||`${p.title} ${p.excerpt||''} ${p.body||''} ${p.author_name||''}`.toLocaleLowerCase('ro').includes(state.search));
  rows=[...rows];
  if(state.sort==='date-asc')rows.sort((a,b)=>new Date(a.published_at)-new Date(b.published_at));
  else if(state.sort==='date-desc')rows.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
  else if(state.sort==='az')rows.sort((a,b)=>a.title.localeCompare(b.title,'ro',{sensitivity:'base'}));
  else if(state.sort==='za')rows.sort((a,b)=>b.title.localeCompare(a.title,'ro',{sensitivity:'base'}));
  return rows;
}

function renderList(){
  const rows=filteredPosts();
  if(!state.posts.length){$('#newsList').innerHTML='<div class="empty">Nu există încă articole publicate.</div>';return;}
  if(!rows.length){$('#newsList').innerHTML='<div class="empty">Nu am găsit articole pentru căutarea selectată.</div>';return;}
  $('#newsList').innerHTML=rows.map(p=>`<article class="news-card" data-post="${p.id}">
    <a class="news-card-main" href="/newsletter.html?post=${encodeURIComponent(p.slug)}">
      ${p.image_path?`<div class="news-image"><img src="${esc(imageUrl(p.image_path))}" alt="${esc(p.title)}" loading="lazy"></div>`:'<div class="news-image"></div>'}
      <div class="news-body"><div class="news-meta">${esc(p.author_name||'Support Hub')} · ${fmt(p.published_at)}</div><h2>${esc(p.title)}</h2><p>${esc(p.excerpt||String(p.body).slice(0,180))}</p></div>
    </a>
    <div class="news-actions">
      <button class="engage-btn like-btn ${state.liked.has(p.id)?'liked':''}" data-like="${p.id}" aria-label="Îmi place">${likeIcon()}<span>${count(state.likes,p.id)}</span></button>
      <a class="engage-btn comment-link" href="/newsletter.html?post=${encodeURIComponent(p.slug)}#comentarii" aria-label="Comentarii"><span aria-hidden="true">◌</span><span>${count(state.comments,p.id)} comentarii</span></a>
      <button class="engage-btn share-btn" data-share="${p.slug}" data-title="${esc(p.title)}" aria-label="Distribuie"><span aria-hidden="true">↗</span><span>Distribuie</span></button>
    </div>
  </article>`).join('');
  bindCardActions();
}

function bindCardActions(){
  $$('[data-like]').forEach(b=>b.onclick=()=>toggleLike(b.dataset.like));
  $$('[data-share]').forEach(b=>b.onclick=()=>shareContent(b.dataset.title,'Articol Support Hub Giuleștean 1923',`${location.origin}/newsletter.html?post=${encodeURIComponent(b.dataset.share)}`));
}

async function toggleLike(postId){
  if(!state.session?.user)return needAccount('aprecia articolul');
  const liked=state.liked.has(postId);
  let error;
  if(liked)({error}=await db.from('blog_post_likes').delete().eq('post_id',postId).eq('user_id',state.session.user.id));
  else({error}=await db.from('blog_post_likes').insert({post_id:postId,user_id:state.session.user.id}));
  if(error){console.error(error);alert('Like-ul nu a putut fi salvat.');return;}
  if(liked){state.liked.delete(postId);state.likes.set(postId,Math.max(0,count(state.likes,postId)-1));}
  else{state.liked.add(postId);state.likes.set(postId,count(state.likes,postId)+1);}
  if(state.article?.id===postId)renderArticleActions();
  else renderList();
}

async function showArticle(slug){
  const {data,error}=await db.from('blog_posts').select('id,title,slug,excerpt,body,image_path,author_name,published_at').eq('status','published').eq('slug',slug).maybeSingle();
  $('#newsHero').hidden=true;$('#newsControls').hidden=true;$('#newsList').hidden=true;$('#articleView').hidden=false;
  if(error||!data){$('#articleView').innerHTML='<a class="article-back" href="/newsletter.html">← Toate noutățile</a><div class="empty">Articolul nu există sau nu mai este public.</div>';return;}
  state.article=data;
  await loadEngagement([data.id]);
  document.title=`${data.title} — Support Hub Giuleștean 1923`;
  $('#articleView').innerHTML=`<a class="article-back" href="/newsletter.html">← Toate noutățile</a>
    <h1>${esc(data.title)}</h1>
    <div class="article-meta">${esc(data.author_name||'Support Hub Giuleștean 1923')} · ${fmt(data.published_at)}</div>
    <div id="articleActions"></div>
    ${data.image_path?`<img class="article-hero" src="${esc(imageUrl(data.image_path))}" alt="${esc(data.title)}">`:''}
    <div class="article-content">${paragraphs(data.body)}</div>
    <section class="comments-section" id="comentarii">
      <div class="comments-head"><h2>Comentarii</h2><span id="commentsTotal">${count(state.comments,data.id)}</span></div>
      <div id="commentComposer"></div>
      <div id="commentsList"><div class="loading comments-loading">Se încarcă discuția…</div></div>
    </section>`;
  renderArticleActions();
  renderCommentComposer();
  await loadComments(data.id);
  if(location.hash==='#comentarii')setTimeout(()=>$('#comentarii')?.scrollIntoView({behavior:'smooth',block:'start'}),150);
}

function renderArticleActions(){
  if(!state.article)return;
  const p=state.article;
  const root=$('#articleActions');if(!root)return;
  root.innerHTML=`<div class="article-actions">
    <button class="engage-btn like-btn ${state.liked.has(p.id)?'liked':''}" id="articleLikeBtn">${likeIcon()}<span>${count(state.likes,p.id)} aprecieri</span></button>
    <a class="engage-btn comment-link" href="#comentarii"><span aria-hidden="true">◌</span><span>${count(state.comments,p.id)} comentarii</span></a>
    <button class="engage-btn share-btn" id="articleShareBtn"><span aria-hidden="true">↗</span><span>Distribuie</span></button>
  </div>`;
  $('#articleLikeBtn').onclick=()=>toggleLike(p.id);
  $('#articleShareBtn').onclick=()=>shareContent(p.title,p.excerpt||'Articol Support Hub Giuleștean 1923',location.href.split('#')[0]);
}

function renderCommentComposer(){
  const root=$('#commentComposer');if(!root)return;
  if(!state.session?.user){
    root.innerHTML='<div class="comment-login">Pentru a comenta trebuie să fii autentificat. <a href="/">Intră în cont din Marketplace</a>.</div>';
    return;
  }
  root.innerHTML=`<form class="comment-form" id="commentForm">
    <textarea name="body" maxlength="1000" required placeholder="Scrie un comentariu..." rows="3"></textarea>
    <div><small>Maximum 1000 de caractere.</small><button>Publică comentariul</button></div>
  </form>`;
  $('#commentForm').onsubmit=submitComment;
}

async function submitComment(e){
  e.preventDefault();
  if(!state.session?.user)return needAccount('comenta');
  const btn=e.currentTarget.querySelector('button');
  const body=String(new FormData(e.currentTarget).get('body')||'').trim();
  if(!body)return;
  btn.disabled=true;btn.textContent='Se publică…';
  const {error}=await db.from('blog_comments').insert({post_id:state.article.id,user_id:state.session.user.id,body});
  btn.disabled=false;btn.textContent='Publică comentariul';
  if(error){console.error(error);alert('Comentariul nu a putut fi publicat.');return;}
  e.currentTarget.reset();
  state.comments.set(state.article.id,count(state.comments,state.article.id)+1);
  renderArticleActions();$('#commentsTotal').textContent=count(state.comments,state.article.id);
  await loadComments(state.article.id);
}

async function loadComments(postId){
  const {data,error}=await db.from('blog_comments').select('id,user_id,body,created_at').eq('post_id',postId).order('created_at',{ascending:false});
  if(error){console.error(error);$('#commentsList').innerHTML='<div class="empty">Comentariile nu sunt disponibile momentan.</div>';return;}
  state.articleComments=data||[];
  const ids=[...new Set(state.articleComments.map(c=>c.user_id))];
  let profiles=new Map();
  if(ids.length){
    const r=await db.from('profiles').select('id,display_name,avatar_path').in('id',ids);
    (r.data||[]).forEach(p=>profiles.set(p.id,p));
  }
  renderComments(profiles);
}

function renderComments(profiles){
  const root=$('#commentsList');
  if(!state.articleComments.length){root.innerHTML='<div class="empty comments-empty">Fii primul care lasă un comentariu.</div>';return;}
  const admin=state.session?.user?.app_metadata?.role==='admin';
  root.innerHTML=state.articleComments.map(c=>{
    const p=profiles.get(c.user_id)||{display_name:'Membru'};
    const avatar=avatarUrl(p.avatar_path);
    const canDelete=state.session?.user&&(state.session.user.id===c.user_id||admin);
    return `<article class="comment-item">
      <div class="comment-avatar">${avatar?`<img src="${esc(avatar)}" alt="">`:esc(initials(p.display_name))}</div>
      <div class="comment-main"><div class="comment-meta"><b>${esc(p.display_name||'Membru')}</b><span>${fmt(c.created_at)}</span></div><p>${esc(c.body).replace(/\n/g,'<br>')}</p>${canDelete?`<button class="comment-delete" data-delete-comment="${c.id}">Șterge</button>`:''}</div>
    </article>`;
  }).join('');
  $$('[data-delete-comment]').forEach(b=>b.onclick=()=>deleteComment(b.dataset.deleteComment));
}

async function deleteComment(id){
  if(!confirm('Ștergi acest comentariu?'))return;
  const {error}=await db.from('blog_comments').delete().eq('id',id);
  if(error){console.error(error);alert('Comentariul nu a putut fi șters.');return;}
  state.comments.set(state.article.id,Math.max(0,count(state.comments,state.article.id)-1));
  renderArticleActions();$('#commentsTotal').textContent=count(state.comments,state.article.id);
  await loadComments(state.article.id);
}

init();
