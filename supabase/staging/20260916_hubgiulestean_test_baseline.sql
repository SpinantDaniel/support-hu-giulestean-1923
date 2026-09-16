-- HUB Giulestean staging baseline
-- Generated from production schema on 2026-09-16.
-- Purpose: initialize HubGiulestean-Test only.
-- IMPORTANT: do not apply this baseline to the production project.
-- Contains structure/security configuration and non-user reference data only.
-- Does NOT copy auth users, listings, messages, contacts, blog content, or other production user data.

SET check_function_bodies = off;

CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, service_role;
GRANT USAGE ON SCHEMA app_private TO anon, authenticated, service_role;


-- Tables
CREATE TABLE public.blog_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  parent_id uuid
);

CREATE TABLE public.blog_post_likes (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.blog_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_id uuid,
  author_name text,
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text,
  body text NOT NULL,
  image_path text,
  status text NOT NULL DEFAULT 'draft'::text,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.conversation_hidden (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  hidden_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.favorites (
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.listing_approvals (
  listing_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.listing_contacts (
  listing_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  phone text,
  whatsapp text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.listing_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  storage_path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.listings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  category_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RON'::text,
  condition text NOT NULL DEFAULT 'used'::text,
  location text NOT NULL DEFAULT 'București'::text,
  negotiable boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.marketplace_settings (
  id boolean NOT NULL DEFAULT true,
  moderation_required boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.moderation_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  listing_id uuid,
  user_id uuid,
  moderator_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.newsletter_editors (
  email text NOT NULL,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  display_name text NOT NULL DEFAULT 'Membru'::text,
  avatar_path text,
  bio text,
  location text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  contact_incognito boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamp with time zone,
  terms_version text,
  privacy_acknowledged_at timestamp with time zone,
  privacy_version text
);

CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.site_release_chunks (
  release_id text NOT NULL,
  seq integer NOT NULL,
  data text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_flags (
  user_id uuid NOT NULL,
  suspended boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  suspended_until timestamp with time zone,
  suspension_reason text,
  suspended_by uuid
);

CREATE TABLE public.user_ratings (
  reviewer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  rating smallint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Constraints
ALTER TABLE public.blog_comments ADD CONSTRAINT blog_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.blog_comments ADD CONSTRAINT blog_comments_body_check CHECK (char_length(TRIM(BOTH FROM body)) >= 1 AND char_length(TRIM(BOTH FROM body)) <= 1000);
ALTER TABLE public.blog_comments ADD CONSTRAINT blog_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE;
ALTER TABLE public.blog_comments ADD CONSTRAINT blog_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE;
ALTER TABLE public.blog_comments ADD CONSTRAINT blog_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blog_post_likes ADD CONSTRAINT blog_post_likes_pkey PRIMARY KEY (post_id, user_id);
ALTER TABLE public.blog_post_likes ADD CONSTRAINT blog_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE;
ALTER TABLE public.blog_post_likes ADD CONSTRAINT blog_post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_body_length CHECK (char_length(body) >= 10);
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_slug_length CHECK (char_length(slug) >= 3 AND char_length(slug) <= 220);
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]));
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 180);
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
ALTER TABLE public.categories ADD CONSTRAINT categories_name_key UNIQUE (name);
ALTER TABLE public.categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
ALTER TABLE public.categories ADD CONSTRAINT categories_slug_check CHECK (slug ~ '^[a-z0-9-]+$'::text);
ALTER TABLE public.conversation_hidden ADD CONSTRAINT conversation_hidden_pkey PRIMARY KEY (conversation_id, user_id);
ALTER TABLE public.conversation_hidden ADD CONSTRAINT conversation_hidden_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_hidden ADD CONSTRAINT conversation_hidden_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
ALTER TABLE public.conversations ADD CONSTRAINT conversations_listing_id_buyer_id_seller_id_key UNIQUE (listing_id, buyer_id, seller_id);
ALTER TABLE public.conversations ADD CONSTRAINT conversations_check CHECK (buyer_id <> seller_id);
ALTER TABLE public.conversations ADD CONSTRAINT conversations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.favorites ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, listing_id);
ALTER TABLE public.favorites ADD CONSTRAINT favorites_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
ALTER TABLE public.favorites ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.listing_approvals ADD CONSTRAINT listing_approvals_pkey PRIMARY KEY (listing_id);
ALTER TABLE public.listing_approvals ADD CONSTRAINT listing_approvals_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
ALTER TABLE public.listing_approvals ADD CONSTRAINT listing_approvals_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
ALTER TABLE public.listing_approvals ADD CONSTRAINT listing_approvals_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.listing_contacts ADD CONSTRAINT listing_contacts_pkey PRIMARY KEY (listing_id);
ALTER TABLE public.listing_contacts ADD CONSTRAINT listing_contacts_check CHECK (phone IS NOT NULL OR whatsapp IS NOT NULL);
ALTER TABLE public.listing_contacts ADD CONSTRAINT listing_contacts_phone_check CHECK (phone IS NULL OR char_length(phone) >= 6 AND char_length(phone) <= 30);
ALTER TABLE public.listing_contacts ADD CONSTRAINT listing_contacts_whatsapp_check CHECK (whatsapp IS NULL OR char_length(whatsapp) >= 6 AND char_length(whatsapp) <= 30);
ALTER TABLE public.listing_contacts ADD CONSTRAINT listing_contacts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
ALTER TABLE public.listing_contacts ADD CONSTRAINT listing_contacts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.listing_images ADD CONSTRAINT listing_images_pkey PRIMARY KEY (id);
ALTER TABLE public.listing_images ADD CONSTRAINT listing_images_storage_path_key UNIQUE (storage_path);
ALTER TABLE public.listing_images ADD CONSTRAINT listing_images_sort_order_check CHECK (sort_order >= 0 AND sort_order <= 20);
ALTER TABLE public.listing_images ADD CONSTRAINT listing_images_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
ALTER TABLE public.listings ADD CONSTRAINT listings_pkey PRIMARY KEY (id);
ALTER TABLE public.listings ADD CONSTRAINT listings_condition_check CHECK (condition = ANY (ARRAY['new'::text, 'like_new'::text, 'used'::text, 'damaged'::text, 'service'::text, 'not_applicable'::text]));
ALTER TABLE public.listings ADD CONSTRAINT listings_currency_check CHECK (currency = ANY (ARRAY['RON'::text, 'EUR'::text]));
ALTER TABLE public.listings ADD CONSTRAINT listings_description_check CHECK (char_length(description) >= 10 AND char_length(description) <= 5000);
ALTER TABLE public.listings ADD CONSTRAINT listings_location_check CHECK (char_length(location) >= 2 AND char_length(location) <= 120);
ALTER TABLE public.listings ADD CONSTRAINT listings_price_check CHECK (price >= 0::numeric);
ALTER TABLE public.listings ADD CONSTRAINT listings_state_check CHECK (state = ANY (ARRAY['active'::text, 'sold'::text, 'archived'::text]));
ALTER TABLE public.listings ADD CONSTRAINT listings_title_check CHECK (char_length(title) >= 4 AND char_length(title) <= 120);
ALTER TABLE public.listings ADD CONSTRAINT listings_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id);
ALTER TABLE public.listings ADD CONSTRAINT listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_settings ADD CONSTRAINT marketplace_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.marketplace_settings ADD CONSTRAINT marketplace_settings_id_check CHECK (id = true);
ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE public.messages ADD CONSTRAINT messages_body_check CHECK (char_length(body) >= 1 AND char_length(body) <= 2000);
ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.moderation_notes ADD CONSTRAINT moderation_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.moderation_notes ADD CONSTRAINT moderation_notes_note_check CHECK (char_length(note) >= 1 AND char_length(note) <= 2000);
ALTER TABLE public.moderation_notes ADD CONSTRAINT moderation_notes_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
ALTER TABLE public.moderation_notes ADD CONSTRAINT moderation_notes_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.moderation_notes ADD CONSTRAINT moderation_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.newsletter_editors ADD CONSTRAINT newsletter_editors_pkey PRIMARY KEY (email);
ALTER TABLE public.newsletter_editors ADD CONSTRAINT newsletter_editors_email_normalized CHECK (email = lower(btrim(email)));
ALTER TABLE public.newsletter_editors ADD CONSTRAINT newsletter_editors_email_shape CHECK (email ~~ '%_@_%._%'::text);
ALTER TABLE public.newsletter_editors ADD CONSTRAINT newsletter_editors_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_check CHECK (bio IS NULL OR char_length(bio) <= 500);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_check CHECK (char_length(display_name) >= 2 AND char_length(display_name) <= 60);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_location_check CHECK (location IS NULL OR char_length(location) <= 120);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD CONSTRAINT reports_pkey PRIMARY KEY (id);
ALTER TABLE public.reports ADD CONSTRAINT reports_one_per_user_listing UNIQUE (reporter_id, listing_id);
ALTER TABLE public.reports ADD CONSTRAINT reports_details_check CHECK (details IS NULL OR char_length(details) <= 1000);
ALTER TABLE public.reports ADD CONSTRAINT reports_reason_check CHECK (reason = ANY (ARRAY['fraud'::text, 'illegal'::text, 'counterfeit'::text, 'spam'::text, 'misleading'::text, 'inappropriate'::text, 'other'::text]));
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check CHECK (status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text]));
ALTER TABLE public.reports ADD CONSTRAINT reports_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.site_release_chunks ADD CONSTRAINT site_release_chunks_pkey PRIMARY KEY (release_id, seq);
ALTER TABLE public.user_flags ADD CONSTRAINT user_flags_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_flags ADD CONSTRAINT user_flags_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.user_flags ADD CONSTRAINT user_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_ratings ADD CONSTRAINT user_ratings_pkey PRIMARY KEY (reviewer_id, seller_id);
ALTER TABLE public.user_ratings ADD CONSTRAINT user_ratings_no_self_review CHECK (reviewer_id <> seller_id);
ALTER TABLE public.user_ratings ADD CONSTRAINT user_ratings_rating_check CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE public.user_ratings ADD CONSTRAINT user_ratings_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_ratings ADD CONSTRAINT user_ratings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Functions
CREATE OR REPLACE FUNCTION private.create_listing_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  needs_moderation boolean;
begin
  select moderation_required into needs_moderation from public.marketplace_settings where id = true;
  insert into public.listing_approvals(listing_id, status, reviewed_at)
  values (new.id, case when coalesce(needs_moderation,false) then 'pending' else 'approved' end,
          case when coalesce(needs_moderation,false) then null else now() end);
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION private.enforce_active_listing_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  active_count integer;
begin
  if new.state = 'active' then
    perform pg_advisory_xact_lock(hashtextextended(new.seller_id::text, 0));

    if tg_op = 'UPDATE'
       and old.state = 'active'
       and new.state = 'active'
       and old.seller_id = new.seller_id then
      return new;
    end if;

    select count(*)
      into active_count
      from public.listings
     where seller_id = new.seller_id
       and state = 'active'
       and (tg_op = 'INSERT' or id <> new.id);

    if active_count >= 10 then
      raise exception using
        errcode = 'P0001',
        message = 'ACTIVE_LISTING_LIMIT_REACHED';
    end if;
  end if;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  accepted_terms boolean := coalesce((new.raw_user_meta_data ->> 'accept_terms')::boolean, false);
  acknowledged_privacy boolean := coalesce((new.raw_user_meta_data ->> 'acknowledge_privacy')::boolean, false);
  terms_version_value text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'terms_version', '')), 40), '');
  privacy_version_value text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'privacy_version', '')), 40), '');
begin
  insert into public.profiles (
    id,
    display_name,
    terms_accepted_at,
    terms_version,
    privacy_acknowledged_at,
    privacy_version
  )
  values (
    new.id,
    left(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'display_name', ''),
        split_part(coalesce(new.email, 'Membru'), '@', 1),
        'Membru'
      ),
      60
    ),
    case when accepted_terms then now() else null end,
    case when accepted_terms then terms_version_value else null end,
    case when acknowledged_privacy then now() else null end,
    case when acknowledged_privacy then privacy_version_value else null end
  );

  insert into public.user_flags (user_id) values (new.id);
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION private.limit_listing_images()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if (select count(*) from public.listing_images where listing_id = new.listing_id) >= 8 then
    raise exception 'Maximum 8 images per listing';
  end if;
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION private.reset_approval_on_image_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_listing uuid;
  needs_moderation boolean;
begin
  target_listing := coalesce(new.listing_id, old.listing_id);
  select moderation_required into needs_moderation from public.marketplace_settings where id = true;
  update public.listing_approvals
    set status = case when coalesce(needs_moderation,false) then 'pending' else 'approved' end,
        reviewed_by = null,
        reviewed_at = case when coalesce(needs_moderation,false) then null else now() end,
        updated_at = now()
    where listing_id = target_listing;
  return coalesce(new, old);
end;
$function$

CREATE OR REPLACE FUNCTION private.reset_listing_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  needs_moderation boolean;
begin
  if row(old.title, old.description, old.price, old.currency, old.category_id, old.condition, old.location)
     is distinct from
     row(new.title, new.description, new.price, new.currency, new.category_id, new.condition, new.location) then
    select moderation_required into needs_moderation from public.marketplace_settings where id = true;
    update public.listing_approvals
      set status = case when coalesce(needs_moderation,false) then 'pending' else 'approved' end,
          reviewed_by = null,
          reviewed_at = case when coalesce(needs_moderation,false) then null else now() end,
          updated_at = now()
      where listing_id = new.id;
  end if;
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION private.reveal_conversation_on_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  delete from public.conversation_hidden
  where conversation_id = new.conversation_id;
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION private.touch_conversation_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION app_private.blog_post_comment_counts()
 RETURNS TABLE(post_id uuid, comments_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.post_id, count(*)::bigint
  from public.blog_comments c
  group by c.post_id;
$function$

CREATE OR REPLACE FUNCTION app_private.blog_post_like_counts()
 RETURNS TABLE(post_id uuid, likes_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select l.post_id, count(*)::bigint
  from public.blog_post_likes l
  group by l.post_id;
$function$

CREATE OR REPLACE FUNCTION app_private.can_read_listing(target_listing uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION app_private.is_newsletter_editor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION app_private.is_user_suspended(target_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.user_flags f
    where f.user_id = target_user
      and f.suspended = true
      and (f.suspended_until is null or f.suspended_until > now())
  );
$function$

CREATE OR REPLACE FUNCTION app_private.seller_rating_stats()
 RETURNS TABLE(seller_id uuid, average_rating numeric, review_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.seller_id,
         round(avg(r.rating), 2) as average_rating,
         count(*)::integer as review_count
  from public.user_ratings r
  group by r.seller_id;
$function$

CREATE OR REPLACE FUNCTION public.blog_posts_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.can_read_listing(target_listing uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.listings l
    where l.id = target_listing
      and (
        public.is_admin()
        or l.seller_id = auth.uid()
        or (
          l.state = 'active'
          and exists (
            select 1
            from public.listing_approvals a
            where a.listing_id = l.id
              and a.status = 'approved'
          )
          and not public.is_user_suspended(l.seller_id)
        )
      )
  );
$function$

CREATE OR REPLACE FUNCTION public.create_my_listing_atomic(p_category_id uuid, p_title text, p_description text, p_price numeric, p_currency text, p_condition text, p_location text, p_negotiable boolean, p_phone text, p_whatsapp text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_listing_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if app_private.is_user_suspended(v_uid) then
    raise exception 'USER_SUSPENDED';
  end if;

  if nullif(btrim(coalesce(p_phone,'')),'') is null
     and nullif(btrim(coalesce(p_whatsapp,'')),'') is null then
    raise exception 'CONTACT_REQUIRED';
  end if;

  insert into public.listings(
    seller_id, category_id, title, description, price, currency,
    condition, location, negotiable, state
  )
  values(
    v_uid, p_category_id, btrim(p_title), btrim(p_description),
    p_price, p_currency, p_condition, btrim(p_location),
    p_negotiable, 'active'
  )
  returning id into v_listing_id;

  insert into public.listing_contacts(
    listing_id, seller_id, phone, whatsapp
  )
  values(
    v_listing_id,
    v_uid,
    nullif(btrim(coalesce(p_phone,'')),''),
    nullif(btrim(coalesce(p_whatsapp,'')),'')
  );

  return v_listing_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_my_user_flag_private()
 RETURNS TABLE(suspended boolean, suspended_until timestamp with time zone, suspension_reason text, verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select f.suspended, f.suspended_until, f.suspension_reason, f.verified
  from public.user_flags f
  where f.user_id = auth.uid();
$function$

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$function$

CREATE OR REPLACE FUNCTION public.is_newsletter_editor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    public.is_admin()
    or (
      not public.is_user_suspended(auth.uid())
      and exists(
        select 1 from public.newsletter_editors e
        where e.email = lower(coalesce(auth.jwt() ->> 'email',''))
      )
    ), false
  );
$function$

CREATE OR REPLACE FUNCTION public.is_user_suspended(target_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.user_flags f
    where f.user_id = target_user
      and f.suspended = true
      and (f.suspended_until is null or f.suspended_until > now())
  );
$function$

CREATE OR REPLACE FUNCTION public.update_my_listing_atomic(p_listing_id uuid, p_category_id uuid, p_title text, p_description text, p_price numeric, p_currency text, p_condition text, p_location text, p_negotiable boolean, p_phone text, p_whatsapp text, p_image_paths text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_path text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if app_private.is_user_suspended(v_uid) then
    raise exception 'USER_SUSPENDED';
  end if;

  if not exists (
    select 1 from public.listings l
    where l.id = p_listing_id and l.seller_id = v_uid
  ) then
    raise exception 'LISTING_NOT_OWNED';
  end if;

  if coalesce(array_length(p_image_paths,1),0) > 8 then
    raise exception 'TOO_MANY_IMAGES';
  end if;

  if exists (
    select 1
    from (
      select x, count(*) c
      from unnest(coalesce(p_image_paths,'{}'::text[])) x
      group by x
      having count(*) > 1
    ) d
  ) then
    raise exception 'DUPLICATE_IMAGE_PATH';
  end if;

  foreach v_path in array coalesce(p_image_paths,'{}'::text[]) loop
    if v_path is null or v_path = '' then
      raise exception 'INVALID_IMAGE_PATH';
    end if;

    if v_path not like (v_uid::text || '/' || p_listing_id::text || '/%') then
      raise exception 'INVALID_IMAGE_OWNER';
    end if;

    if exists (
      select 1
      from public.listing_images li
      where li.storage_path = v_path
        and li.listing_id <> p_listing_id
    ) then
      raise exception 'IMAGE_PATH_ALREADY_USED';
    end if;
  end loop;

  update public.listings
  set
    category_id = p_category_id,
    title = btrim(p_title),
    description = btrim(p_description),
    price = p_price,
    currency = p_currency,
    condition = p_condition,
    location = btrim(p_location),
    negotiable = p_negotiable,
    state = 'active',
    updated_at = now()
  where id = p_listing_id and seller_id = v_uid;

  insert into public.listing_contacts(listing_id,seller_id,phone,whatsapp)
  values (
    p_listing_id,
    v_uid,
    nullif(btrim(coalesce(p_phone,'')),''),
    nullif(btrim(coalesce(p_whatsapp,'')),'')
  )
  on conflict (listing_id) do update
  set
    phone = excluded.phone,
    whatsapp = excluded.whatsapp,
    updated_at = now()
  where public.listing_contacts.seller_id = v_uid;

  delete from public.listing_images li
  where li.listing_id = p_listing_id
    and not (li.storage_path = any(coalesce(p_image_paths,'{}'::text[])));

  insert into public.listing_images(listing_id,storage_path,sort_order)
  select p_listing_id, x.path, (x.ord - 1)::integer
  from unnest(coalesce(p_image_paths,'{}'::text[])) with ordinality as x(path,ord)
  on conflict (storage_path) do update
  set sort_order = excluded.sort_order
  where public.listing_images.listing_id = p_listing_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.validate_blog_comment_parent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  parent_post uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A comment cannot reply to itself';
  end if;
  select post_id into parent_post from public.blog_comments where id = new.parent_id;
  if parent_post is null then
    raise exception 'Parent comment not found';
  end if;
  if parent_post <> new.post_id then
    raise exception 'Parent comment belongs to another post';
  end if;
  return new;
end;
$function$

-- Indexes
CREATE INDEX blog_comments_parent_id_idx ON public.blog_comments USING btree (parent_id);
CREATE INDEX blog_comments_post_created_idx ON public.blog_comments USING btree (post_id, created_at DESC);
CREATE INDEX blog_comments_post_parent_idx ON public.blog_comments USING btree (post_id, parent_id, created_at);
CREATE INDEX blog_comments_user_id_idx ON public.blog_comments USING btree (user_id);
CREATE INDEX blog_post_likes_post_idx ON public.blog_post_likes USING btree (post_id);
CREATE INDEX blog_post_likes_user_id_idx ON public.blog_post_likes USING btree (user_id);
CREATE INDEX blog_posts_author_idx ON public.blog_posts USING btree (author_id, created_at DESC);
CREATE INDEX blog_posts_public_idx ON public.blog_posts USING btree (status, published_at DESC);
CREATE INDEX conversation_hidden_user_id_idx ON public.conversation_hidden USING btree (user_id);
CREATE INDEX conversations_buyer_idx ON public.conversations USING btree (buyer_id, updated_at DESC);
CREATE INDEX conversations_seller_idx ON public.conversations USING btree (seller_id, updated_at DESC);
CREATE INDEX favorites_listing_idx ON public.favorites USING btree (listing_id);
CREATE INDEX listing_approvals_reviewed_by_idx ON public.listing_approvals USING btree (reviewed_by);
CREATE INDEX listing_approvals_status_idx ON public.listing_approvals USING btree (status, updated_at DESC);
CREATE INDEX listing_contacts_seller_idx ON public.listing_contacts USING btree (seller_id);
CREATE INDEX listing_images_listing_idx ON public.listing_images USING btree (listing_id, sort_order);
CREATE INDEX listings_category_idx ON public.listings USING btree (category_id, created_at DESC);
CREATE INDEX listings_created_idx ON public.listings USING btree (created_at DESC);
CREATE INDEX listings_seller_idx ON public.listings USING btree (seller_id, created_at DESC);
CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at);
CREATE INDEX messages_sender_idx ON public.messages USING btree (sender_id);
CREATE INDEX moderation_notes_listing_idx ON public.moderation_notes USING btree (listing_id);
CREATE INDEX moderation_notes_moderator_idx ON public.moderation_notes USING btree (moderator_id);
CREATE INDEX moderation_notes_user_idx ON public.moderation_notes USING btree (user_id);
CREATE INDEX newsletter_editors_added_by_idx ON public.newsletter_editors USING btree (added_by);
CREATE INDEX reports_listing_idx ON public.reports USING btree (listing_id);
CREATE INDEX reports_reporter_idx ON public.reports USING btree (reporter_id);
CREATE INDEX reports_reporter_listing_idx ON public.reports USING btree (reporter_id, listing_id);
CREATE INDEX reports_status_idx ON public.reports USING btree (status, created_at DESC);
CREATE INDEX user_flags_suspended_by_idx ON public.user_flags USING btree (suspended_by);
CREATE INDEX user_ratings_seller_idx ON public.user_ratings USING btree (seller_id);

-- Views
CREATE VIEW public.blog_post_comment_counts WITH (security_invoker=true) AS  SELECT post_id,
    comments_count
   FROM app_private.blog_post_comment_counts() blog_post_comment_counts(post_id, comments_count);;

CREATE VIEW public.blog_post_like_counts WITH (security_invoker=true) AS  SELECT post_id,
    likes_count
   FROM app_private.blog_post_like_counts() blog_post_like_counts(post_id, likes_count);;

CREATE VIEW public.seller_rating_stats WITH (security_invoker=true) AS  SELECT seller_id,
    average_rating,
    review_count
   FROM app_private.seller_rating_stats() seller_rating_stats(seller_id, average_rating, review_count);;

-- Triggers
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
CREATE TRIGGER trg_validate_blog_comment_parent BEFORE INSERT OR UPDATE OF parent_id, post_id ON blog_comments FOR EACH ROW EXECUTE FUNCTION validate_blog_comment_parent();
CREATE TRIGGER blog_posts_touch_trg BEFORE INSERT OR UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION blog_posts_touch();
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER listing_approvals_updated_at BEFORE UPDATE ON listing_approvals FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER before_listing_image_insert BEFORE INSERT ON listing_images FOR EACH ROW EXECUTE FUNCTION private.limit_listing_images();
CREATE TRIGGER on_listing_image_added AFTER INSERT ON listing_images FOR EACH ROW EXECUTE FUNCTION private.reset_approval_on_image_change();
CREATE TRIGGER on_listing_image_removed AFTER DELETE ON listing_images FOR EACH ROW EXECUTE FUNCTION private.reset_approval_on_image_change();
CREATE TRIGGER enforce_active_listing_limit BEFORE INSERT OR UPDATE OF state, seller_id ON listings FOR EACH ROW EXECUTE FUNCTION private.enforce_active_listing_limit();
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER on_listing_content_changed AFTER UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION private.reset_listing_approval();
CREATE TRIGGER on_listing_created AFTER INSERT ON listings FOR EACH ROW EXECUTE FUNCTION private.create_listing_approval();
CREATE TRIGGER on_message_created AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION private.touch_conversation_on_message();
CREATE TRIGGER reveal_conversation_on_new_message AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION private.reveal_conversation_on_new_message();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER user_flags_updated_at BEFORE UPDATE ON user_flags FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER user_ratings_updated_at BEFORE UPDATE ON user_ratings FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- RLS
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_hidden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_editors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_release_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY blog_comments_auth_insert ON public.blog_comments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM blog_posts p
  WHERE ((p.id = blog_comments.post_id) AND (p.status = 'published'::text)))) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))));

CREATE POLICY blog_comments_owner_delete ON public.blog_comments AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));

CREATE POLICY blog_comments_public_read ON public.blog_comments AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM blog_posts p
  WHERE ((p.id = blog_comments.post_id) AND (p.status = 'published'::text)))));

CREATE POLICY blog_likes_own_delete ON public.blog_post_likes AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));

CREATE POLICY blog_likes_own_insert ON public.blog_post_likes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM blog_posts p
  WHERE ((p.id = blog_post_likes.post_id) AND (p.status = 'published'::text)))) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))));

CREATE POLICY blog_likes_own_read ON public.blog_post_likes AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));

CREATE POLICY blog_posts_delete ON public.blog_posts AS PERMISSIVE FOR DELETE TO public USING ((is_admin() OR (app_private.is_newsletter_editor() AND (author_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY blog_posts_insert ON public.blog_posts AS PERMISSIVE FOR INSERT TO public WITH CHECK (((is_admin() OR app_private.is_newsletter_editor()) AND (author_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))));

CREATE POLICY blog_posts_read ON public.blog_posts AS PERMISSIVE FOR SELECT TO public USING (((status = 'published'::text) OR is_admin() OR (app_private.is_newsletter_editor() AND (author_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY blog_posts_update ON public.blog_posts AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (app_private.is_newsletter_editor() AND (author_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((is_admin() OR (app_private.is_newsletter_editor() AND (author_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY categories_admin_delete ON public.categories AS PERMISSIVE FOR DELETE TO authenticated USING (( SELECT is_admin() AS is_admin));

CREATE POLICY categories_admin_insert ON public.categories AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_admin() AS is_admin));

CREATE POLICY categories_admin_update ON public.categories AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));

CREATE POLICY categories_public_read ON public.categories AS PERMISSIVE FOR SELECT TO anon, authenticated USING (((active = true) OR ( SELECT is_admin() AS is_admin)));

CREATE POLICY conversation_hidden_own_delete ON public.conversation_hidden AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY conversation_hidden_own_insert ON public.conversation_hidden AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = conversation_hidden.conversation_id) AND ((c.buyer_id = ( SELECT auth.uid() AS uid)) OR (c.seller_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY conversation_hidden_own_select ON public.conversation_hidden AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = conversation_hidden.conversation_id) AND ((c.buyer_id = ( SELECT auth.uid() AS uid)) OR (c.seller_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY conversation_hidden_own_update ON public.conversation_hidden AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = conversation_hidden.conversation_id) AND ((c.buyer_id = ( SELECT auth.uid() AS uid)) OR (c.seller_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY conversations_buyer_insert ON public.conversations AS PERMISSIVE FOR INSERT TO public WITH CHECK (((buyer_id = ( SELECT auth.uid() AS uid)) AND (buyer_id <> seller_id) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid))) AND (EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = conversations.listing_id) AND (l.seller_id = conversations.seller_id))))));

CREATE POLICY conversations_participant_read ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated USING (((buyer_id = ( SELECT auth.uid() AS uid)) OR (seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));

CREATE POLICY favorites_owner_delete ON public.favorites AS PERMISSIVE FOR DELETE TO public USING (((user_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))));

CREATE POLICY favorites_owner_insert ON public.favorites AS PERMISSIVE FOR INSERT TO public WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))));

CREATE POLICY favorites_owner_read ON public.favorites AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY approvals_admin_update ON public.listing_approvals AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));

CREATE POLICY approvals_owner_or_admin_read ON public.listing_approvals AS PERMISSIVE FOR SELECT TO authenticated USING ((is_admin() OR (EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_approvals.listing_id) AND (l.seller_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY listing_contacts_authenticated_read ON public.listing_contacts AS PERMISSIVE FOR SELECT TO authenticated USING (((seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin) OR ((EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_contacts.listing_id) AND (l.state = 'active'::text)))) AND (NOT (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = listing_contacts.seller_id) AND (COALESCE(p.contact_incognito, false) = true))))))));

CREATE POLICY listing_contacts_owner_delete ON public.listing_contacts AS PERMISSIVE FOR DELETE TO authenticated USING (((seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));

CREATE POLICY listing_contacts_owner_insert ON public.listing_contacts AS PERMISSIVE FOR INSERT TO public WITH CHECK (((seller_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid))) AND (EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_contacts.listing_id) AND (l.seller_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY listing_contacts_owner_update ON public.listing_contacts AS PERMISSIVE FOR UPDATE TO public USING ((((seller_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))) OR is_admin())) WITH CHECK ((((seller_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))) OR is_admin()));

CREATE POLICY listing_images_owner_delete ON public.listing_images AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_images.listing_id) AND ((l.seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin))))));

CREATE POLICY listing_images_owner_insert ON public.listing_images AS PERMISSIVE FOR INSERT TO public WITH CHECK (((NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid))) AND (EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_images.listing_id) AND (l.seller_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY listing_images_owner_update ON public.listing_images AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_images.listing_id) AND (((l.seller_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))) OR is_admin()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_images.listing_id) AND (((l.seller_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))) OR is_admin())))));

CREATE POLICY listing_images_visible_read ON public.listing_images AS PERMISSIVE FOR SELECT TO anon, authenticated USING (app_private.can_read_listing(listing_id));

CREATE POLICY listings_owner_delete ON public.listings AS PERMISSIVE FOR DELETE TO authenticated USING (((seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));

CREATE POLICY listings_owner_insert ON public.listings AS PERMISSIVE FOR INSERT TO public WITH CHECK (((seller_id = ( SELECT auth.uid() AS uid)) AND (state = 'active'::text) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))));

CREATE POLICY listings_owner_update ON public.listings AS PERMISSIVE FOR UPDATE TO public USING ((((seller_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))) OR is_admin())) WITH CHECK ((((seller_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid)))) OR is_admin()));

CREATE POLICY listings_public_or_owner_read ON public.listings AS PERMISSIVE FOR SELECT TO public USING (app_private.can_read_listing(id));

CREATE POLICY marketplace_settings_admin_update ON public.marketplace_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));

CREATE POLICY marketplace_settings_public_read ON public.marketplace_settings AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY messages_participant_insert ON public.messages AS PERMISSIVE FOR INSERT TO public WITH CHECK (((sender_id = ( SELECT auth.uid() AS uid)) AND (NOT app_private.is_user_suspended(( SELECT auth.uid() AS uid))) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.buyer_id = ( SELECT auth.uid() AS uid)) OR (c.seller_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY messages_participant_read ON public.messages AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.buyer_id = ( SELECT auth.uid() AS uid)) OR (c.seller_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin))))));

CREATE POLICY moderation_notes_admin_all ON public.moderation_notes AS PERMISSIVE FOR ALL TO authenticated USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));

CREATE POLICY newsletter_editors_admin_delete ON public.newsletter_editors AS PERMISSIVE FOR DELETE TO public USING (is_admin());

CREATE POLICY newsletter_editors_admin_insert ON public.newsletter_editors AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());

CREATE POLICY newsletter_editors_admin_update ON public.newsletter_editors AS PERMISSIVE FOR UPDATE TO public USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY newsletter_editors_read ON public.newsletter_editors AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (email = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)))));

CREATE POLICY profiles_owner_update ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid) = id) OR ( SELECT is_admin() AS is_admin))) WITH CHECK (((( SELECT auth.uid() AS uid) = id) OR ( SELECT is_admin() AS is_admin)));

CREATE POLICY profiles_public_read ON public.profiles AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY reports_admin_update ON public.reports AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));

CREATE POLICY reports_owner_insert ON public.reports AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((reporter_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = reports.listing_id) AND (l.seller_id <> ( SELECT auth.uid() AS uid)))))));

CREATE POLICY reports_owner_read ON public.reports AS PERMISSIVE FOR SELECT TO authenticated USING (((reporter_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));

CREATE POLICY site_release_chunks_public_read ON public.site_release_chunks AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((release_id = ANY (ARRAY['current'::text, 'rebrand_v2'::text])));

CREATE POLICY user_flags_admin_insert ON public.user_flags AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (( SELECT is_admin() AS is_admin));

CREATE POLICY user_flags_admin_update ON public.user_flags AS PERMISSIVE FOR UPDATE TO authenticated USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));

CREATE POLICY user_flags_public_read ON public.user_flags AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY user_ratings_delete_own ON public.user_ratings AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = reviewer_id));

CREATE POLICY user_ratings_insert_own ON public.user_ratings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = reviewer_id) AND (reviewer_id <> seller_id)));

CREATE POLICY user_ratings_select_own ON public.user_ratings AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = reviewer_id));

CREATE POLICY user_ratings_update_own ON public.user_ratings AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = reviewer_id)) WITH CHECK (((( SELECT auth.uid() AS uid) = reviewer_id) AND (reviewer_id <> seller_id)));

CREATE POLICY blog_images_editor_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'blog-images'::text) AND (is_admin() OR (app_private.is_newsletter_editor() AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)))));

CREATE POLICY blog_images_editor_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'blog-images'::text) AND (is_admin() OR app_private.is_newsletter_editor()) AND (is_admin() OR ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))));

CREATE POLICY blog_images_editor_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'blog-images'::text) AND (is_admin() OR (app_private.is_newsletter_editor() AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))))) WITH CHECK (((bucket_id = 'blog-images'::text) AND (is_admin() OR (app_private.is_newsletter_editor() AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)))));

CREATE POLICY blog_images_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'blog-images'::text));

CREATE POLICY listing_images_storage_owner_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'listing-images'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid))));

CREATE POLICY listing_images_storage_owner_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'listing-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));

CREATE POLICY listing_images_storage_owner_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'listing-images'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid))));

CREATE POLICY listing_images_storage_owner_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'listing-images'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid)))) WITH CHECK (((bucket_id = 'listing-images'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid))));

CREATE POLICY listing_images_storage_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = 'listing-images'::text));

CREATE POLICY profile_avatars_owner_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'profile-avatars'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid))));

CREATE POLICY profile_avatars_owner_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'profile-avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));

CREATE POLICY profile_avatars_owner_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'profile-avatars'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid)))) WITH CHECK (((bucket_id = 'profile-avatars'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid))));

CREATE POLICY profile_avatars_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = 'profile-avatars'::text));

-- Base grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.blog_posts_touch() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_my_listing_atomic(uuid,text,text,numeric,text,text,text,boolean,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_my_listing_atomic(uuid,uuid,text,text,numeric,text,text,text,boolean,text,text,text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_user_flag_private() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_listing(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_newsletter_editor() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_user_suspended(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_blog_comment_parent() TO service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.limit_listing_images() TO PUBLIC;
GRANT EXECUTE ON FUNCTION private.set_updated_at() TO PUBLIC;


-- Storage buckets
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('blog-images','blog-images',true,6291456,'{image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO UPDATE SET name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('listing-images','listing-images',true,6291456,'{image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO UPDATE SET name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('profile-avatars','profile-avatars',true,3145728,'{image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO UPDATE SET name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Reference data
INSERT INTO public.marketplace_settings(id,moderation_required,updated_at) VALUES (true,false,now()) ON CONFLICT (id) DO UPDATE SET moderation_required=excluded.moderation_required,updated_at=now();
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('bef164fb-cdf9-4012-835f-514cf861c29b'::uuid,'rapid-colectii','Rapid & Colecții','⚽',10,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('3734b95d-c60f-4f38-a214-20b57a267745'::uuid,'auto-moto','Auto & Moto','🚗',20,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('b9df810c-06a1-4626-bf71-ee80cf18fc04'::uuid,'electronice','Electronice','💻',30,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('35d94c4a-1e5e-4283-921e-0d51b29fe00b'::uuid,'telefoane','Telefoane','📱',40,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('1ee84d4e-8db7-4ea2-89a4-4abc3b4d8113'::uuid,'haine-incaltaminte','Haine & Încălțăminte','👕',50,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('e546819e-e60e-4f14-8709-0bd0d2e62186'::uuid,'casa-gradina','Casă & Grădină','🏠',60,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('b558fff3-fa83-4b63-8fa1-71a76cbd8cb7'::uuid,'servicii','Servicii','🛠️',70,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('9aad4aac-084d-4617-a58b-6f03ecc2883d'::uuid,'bilete','Bilete & Deplasări','🎟️',80,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('61e3d254-2a8b-4efd-af19-49f578a84d8e'::uuid,'imobiliare','Imobiliare','🏢',90,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('b447456b-226a-4cc2-96f5-eb81d36ac98f'::uuid,'joburi','Joburi','💼',100,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('7f220f57-8f4e-4409-8e07-f9c490c10270'::uuid,'donez-caut','Donez / Caut','🤝',110,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;
INSERT INTO public.categories(id,slug,name,icon,sort_order,active) VALUES ('e2cb7b2c-217b-47b3-a6df-3567c9394f57'::uuid,'diverse','Diverse','📦',120,true) ON CONFLICT (id) DO UPDATE SET slug=excluded.slug,name=excluded.name,icon=excluded.icon,sort_order=excluded.sort_order,active=excluded.active;


SET check_function_bodies = on;
