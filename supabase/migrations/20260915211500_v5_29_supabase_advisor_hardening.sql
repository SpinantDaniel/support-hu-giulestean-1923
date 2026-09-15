begin;

-- STEP 6: keep privileged helpers out of the exposed public API schema.
create schema if not exists app_private authorization postgres;
revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated, service_role;
alter default privileges in schema app_private revoke execute on functions from public;

create or replace function app_private.is_user_suspended(target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.user_flags f
    where f.user_id = target_user
      and f.suspended = true
      and (f.suspended_until is null or f.suspended_until > now())
  );
$$;

create or replace function app_private.is_newsletter_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_admin()
    or (
      not app_private.is_user_suspended(auth.uid())
      and exists(
        select 1
        from public.newsletter_editors e
        where e.email = lower(coalesce(auth.jwt() ->> 'email',''))
      )
    ),
    false
  );
$$;

create or replace function app_private.can_read_listing(target_listing uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.listings l
    where l.id = target_listing
      and (
        public.is_admin()
        or l.seller_id = auth.uid()
        or (
          l.state = 'active'
          and exists(
            select 1
            from public.listing_approvals a
            where a.listing_id = l.id
              and a.status = 'approved'
          )
          and not app_private.is_user_suspended(l.seller_id)
        )
      )
  );
$$;

create or replace function app_private.blog_post_like_counts()
returns table(post_id uuid, likes_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.post_id, count(*)::bigint
  from public.blog_post_likes l
  group by l.post_id;
$$;

create or replace function app_private.blog_post_comment_counts()
returns table(post_id uuid, comments_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.post_id, count(*)::bigint
  from public.blog_comments c
  group by c.post_id;
$$;

create or replace function app_private.seller_rating_stats()
returns table(seller_id uuid, average_rating numeric, review_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.seller_id,
         round(avg(r.rating), 2) as average_rating,
         count(*)::integer as review_count
  from public.user_ratings r
  group by r.seller_id;
$$;

revoke all on all functions in schema app_private from public;
grant execute on function app_private.is_user_suspended(uuid) to anon, authenticated, service_role;
grant execute on function app_private.is_newsletter_editor() to anon, authenticated, service_role;
grant execute on function app_private.can_read_listing(uuid) to anon, authenticated, service_role;
grant execute on function app_private.blog_post_like_counts() to anon, authenticated, service_role;
grant execute on function app_private.blog_post_comment_counts() to anon, authenticated, service_role;
grant execute on function app_private.seller_rating_stats() to anon, authenticated, service_role;

-- The public aggregate interfaces remain unchanged for the frontend,
-- but the views themselves now execute with caller permissions.
create or replace view public.blog_post_like_counts
with (security_invoker = true)
as
select * from app_private.blog_post_like_counts();

create or replace view public.blog_post_comment_counts
with (security_invoker = true)
as
select * from app_private.blog_post_comment_counts();

create or replace view public.seller_rating_stats
with (security_invoker = true)
as
select * from app_private.seller_rating_stats();

revoke all on table public.blog_post_like_counts from public, anon, authenticated;
revoke all on table public.blog_post_comment_counts from public, anon, authenticated;
revoke all on table public.seller_rating_stats from public, anon, authenticated;
grant select on table public.blog_post_like_counts to anon, authenticated, service_role;
grant select on table public.blog_post_comment_counts to anon, authenticated, service_role;
grant select on table public.seller_rating_stats to anon, authenticated, service_role;

-- Remove direct anonymous execution from privileged public RPCs.
revoke all on function public.create_my_listing_atomic(
  uuid,text,text,numeric,text,text,text,boolean,text,text
) from public, anon;
grant execute on function public.create_my_listing_atomic(
  uuid,text,text,numeric,text,text,text,boolean,text,text
) to authenticated, service_role;

revoke all on function public.update_my_listing_atomic(
  uuid,uuid,text,text,numeric,text,text,text,boolean,text,text,text[]
) from public, anon;
grant execute on function public.update_my_listing_atomic(
  uuid,uuid,text,text,numeric,text,text,text,boolean,text,text,text[]
) to authenticated, service_role;

revoke all on function public.get_my_user_flag_private() from public, anon;
grant execute on function public.get_my_user_flag_private() to authenticated, service_role;

-- These public helpers are no longer used by browser/RLS calls after this migration.
revoke all on function public.can_read_listing(uuid) from public, anon, authenticated;
revoke all on function public.is_user_suspended(uuid) from public, anon, authenticated;
revoke all on function public.is_newsletter_editor() from public, anon, authenticated;
grant execute on function public.can_read_listing(uuid) to service_role;
grant execute on function public.is_user_suspended(uuid) to service_role;
grant execute on function public.is_newsletter_editor() to service_role;

-- Trigger function must not be callable as an RPC.
revoke all on function public.validate_blog_comment_parent() from public, anon, authenticated;

-- RLS helper migration + auth initplan optimization.
alter policy listings_public_or_owner_read on public.listings
using (app_private.can_read_listing(id));

alter policy listing_images_visible_read on public.listing_images
using (app_private.can_read_listing(listing_id));

alter policy blog_likes_own_read on public.blog_post_likes
using ((user_id = (select auth.uid())) or public.is_admin());

alter policy blog_likes_own_insert on public.blog_post_likes
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.blog_posts p
    where p.id = blog_post_likes.post_id
      and p.status = 'published'
  )
  and not app_private.is_user_suspended((select auth.uid()))
);

alter policy blog_likes_own_delete on public.blog_post_likes
using ((user_id = (select auth.uid())) or public.is_admin());

alter policy newsletter_editors_read on public.newsletter_editors
using (
  public.is_admin()
  or email = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
);

alter policy blog_posts_read on public.blog_posts
using (
  status = 'published'
  or public.is_admin()
  or (
    app_private.is_newsletter_editor()
    and author_id = (select auth.uid())
  )
);

alter policy blog_posts_insert on public.blog_posts
with check (
  (public.is_admin() or app_private.is_newsletter_editor())
  and author_id = (select auth.uid())
  and not app_private.is_user_suspended((select auth.uid()))
);

alter policy blog_posts_update on public.blog_posts
using (
  public.is_admin()
  or (
    app_private.is_newsletter_editor()
    and author_id = (select auth.uid())
  )
)
with check (
  public.is_admin()
  or (
    app_private.is_newsletter_editor()
    and author_id = (select auth.uid())
  )
);

alter policy blog_posts_delete on public.blog_posts
using (
  public.is_admin()
  or (
    app_private.is_newsletter_editor()
    and author_id = (select auth.uid())
  )
);

alter policy listing_contacts_owner_insert on public.listing_contacts
with check (
  seller_id = (select auth.uid())
  and not app_private.is_user_suspended((select auth.uid()))
  and exists (
    select 1 from public.listings l
    where l.id = listing_contacts.listing_id
      and l.seller_id = (select auth.uid())
  )
);

alter policy listing_contacts_owner_update on public.listing_contacts
using (
  (
    seller_id = (select auth.uid())
    and not app_private.is_user_suspended((select auth.uid()))
  )
  or public.is_admin()
)
with check (
  (
    seller_id = (select auth.uid())
    and not app_private.is_user_suspended((select auth.uid()))
  )
  or public.is_admin()
);

alter policy listings_owner_insert on public.listings
with check (
  seller_id = (select auth.uid())
  and state = 'active'
  and not app_private.is_user_suspended((select auth.uid()))
);

alter policy listings_owner_update on public.listings
using (
  (
    seller_id = (select auth.uid())
    and not app_private.is_user_suspended((select auth.uid()))
  )
  or public.is_admin()
)
with check (
  (
    seller_id = (select auth.uid())
    and not app_private.is_user_suspended((select auth.uid()))
  )
  or public.is_admin()
);

alter policy listing_images_owner_insert on public.listing_images
with check (
  not app_private.is_user_suspended((select auth.uid()))
  and exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id
      and l.seller_id = (select auth.uid())
  )
);

alter policy listing_images_owner_update on public.listing_images
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id
      and (
        (
          l.seller_id = (select auth.uid())
          and not app_private.is_user_suspended((select auth.uid()))
        )
        or public.is_admin()
      )
  )
)
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id
      and (
        (
          l.seller_id = (select auth.uid())
          and not app_private.is_user_suspended((select auth.uid()))
        )
        or public.is_admin()
      )
  )
);

alter policy conversations_buyer_insert on public.conversations
with check (
  buyer_id = (select auth.uid())
  and buyer_id <> seller_id
  and not app_private.is_user_suspended((select auth.uid()))
  and exists (
    select 1 from public.listings l
    where l.id = conversations.listing_id
      and l.seller_id = conversations.seller_id
  )
);

alter policy messages_participant_insert on public.messages
with check (
  sender_id = (select auth.uid())
  and not app_private.is_user_suspended((select auth.uid()))
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.buyer_id = (select auth.uid())
        or c.seller_id = (select auth.uid())
      )
  )
);

alter policy favorites_owner_insert on public.favorites
with check (
  user_id = (select auth.uid())
  and not app_private.is_user_suspended((select auth.uid()))
);

alter policy favorites_owner_delete on public.favorites
using (
  user_id = (select auth.uid())
  and not app_private.is_user_suspended((select auth.uid()))
);

alter policy blog_comments_auth_insert on public.blog_comments
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.blog_posts p
    where p.id = blog_comments.post_id
      and p.status = 'published'
  )
  and not app_private.is_user_suspended((select auth.uid()))
);

alter policy blog_comments_owner_delete on public.blog_comments
using ((user_id = (select auth.uid())) or public.is_admin());

alter policy user_ratings_select_own on public.user_ratings
using ((select auth.uid()) = reviewer_id);

alter policy user_ratings_insert_own on public.user_ratings
with check (
  (select auth.uid()) = reviewer_id
  and reviewer_id <> seller_id
);

alter policy user_ratings_update_own on public.user_ratings
using ((select auth.uid()) = reviewer_id)
with check (
  (select auth.uid()) = reviewer_id
  and reviewer_id <> seller_id
);

alter policy user_ratings_delete_own on public.user_ratings
using ((select auth.uid()) = reviewer_id);

alter policy approvals_owner_or_admin_read on public.listing_approvals
using (
  public.is_admin()
  or exists (
    select 1 from public.listings l
    where l.id = listing_approvals.listing_id
      and l.seller_id = (select auth.uid())
  )
);

-- Cover all FK columns reported by the Supabase performance advisor.
create index if not exists blog_comments_user_id_idx
  on public.blog_comments(user_id);

create index if not exists blog_post_likes_user_id_idx
  on public.blog_post_likes(user_id);

create index if not exists conversation_hidden_user_id_idx
  on public.conversation_hidden(user_id);

create index if not exists newsletter_editors_added_by_idx
  on public.newsletter_editors(added_by);

create index if not exists user_flags_suspended_by_idx
  on public.user_flags(suspended_by);

commit;
