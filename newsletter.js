const SUPABASE_URL='https://bhqpixyiojthpfqnyhsh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_U2IRhs6K85S43ZRqKK5U8Q_HSknWMNY';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const imageUrl=path=>path?`${SUPABASE_URL}/storage/v1/object/public/blog-images/${String(path).split('/').map(encodeURIComponent).join('/')}`:'';
const fmt=d=>new Intl.DateTimeFormat('ro-RO',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(d));
function paragraphs(text=''){return String(text).split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`).join('');}
async function init(){
  const slug=new URLSearchParams(location.search).get('post');
  if(slug)return showArticle(slug);
  const {data,error}=await db.from('blog_posts').select('id,title,slug,excerpt,body,image_path,author_name,published_at').eq('status','published').order('published_at',{ascending:false});
  if(error){console.error(error);$('#newsList').innerHTML='<div class="empty">Noutățile nu sunt disponibile momentan.</div>';return;}
  if(!data?.length){$('#newsList').innerHTML='<div class="empty">Nu există încă articole publicate.</div>';return;}
  $('#newsList').innerHTML=data.map(p=>`<article class="news-card"><a href="/newsletter.html?post=${encodeURIComponent(p.slug)}">${p.image_path?`<div class="news-image"><img src="${esc(imageUrl(p.image_path))}" alt="${esc(p.title)}" loading="lazy"></div>`:'<div class="news-image"></div>'}<div class="news-body"><div class="news-meta">${esc(p.author_name||'Support Hub')} · ${fmt(p.published_at)}</div><h2>${esc(p.title)}</h2><p>${esc(p.excerpt||String(p.body).slice(0,180))}</p></div></a></article>`).join('');
}
async function showArticle(slug){
  const {data,error}=await db.from('blog_posts').select('title,slug,excerpt,body,image_path,author_name,published_at').eq('status','published').eq('slug',slug).maybeSingle();
  $('#newsHero').hidden=true;$('#newsList').hidden=true;$('#articleView').hidden=false;
  if(error||!data){$('#articleView').innerHTML='<a class="article-back" href="/newsletter.html">← Noutăți</a><div class="empty">Articolul nu există sau nu mai este public.</div>';return;}
  document.title=`${data.title} — Support Hub Giuleștean 1923`;
  $('#articleView').innerHTML=`<a class="article-back" href="/newsletter.html">← Toate noutățile</a><span class="eyebrow">NOUTĂȚI • SUPPORT HUB</span><h1>${esc(data.title)}</h1><div class="article-meta">${esc(data.author_name||'Support Hub Giuleștean 1923')} · ${fmt(data.published_at)}</div>${data.image_path?`<img class="article-hero" src="${esc(imageUrl(data.image_path))}" alt="${esc(data.title)}">`:''}<div class="article-content">${paragraphs(data.body)}</div>`;
}
init();
