begin;

-- Step 4: Privacy / RLS hardening.
-- Keep marketplace-visible profile data public, but remove legal-consent metadata
-- and moderation/suspension internals from direct client access.

create or replace function public.can_read_listing(target_listing uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.can_read_listing(uuid) from public;
grant execute on function public.can_read_listing(uuid) to anon, authenticated;

create or replace function public.get_my_user_flag_private()
returns table (
  suspended boolean,
  suspended_until timestamptz,
  suspension_reason text,
  verified boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.suspended, f.suspended_until, f.suspension_reason, f.verified
  from public.user_flags f
  where f.user_id = auth.uid();
$$;

revoke all on function public.get_my_user_flag_private() from public;
grant execute on function public.get_my_user_flag_private() to authenticated;

-- PROFILES
-- Public marketplace identity remains readable. Legal acceptance timestamps /
-- versions are server-side records and are no longer directly client-readable.
revoke all privileges on table public.profiles from anon, authenticated;

grant select (
  id,
  display_name,
  avatar_path,
  bio,
  location,
  created_at,
  contact_incognito
) on table public.profiles to anon, authenticated;

grant update (
  display_name,
  avatar_path,
  bio,
  location,
  contact_incognito
) on table public.profiles to authenticated;

-- USER FLAGS
-- Only public verification state is directly exposed.
-- Suspension internals for the current user are available through the narrow RPC above.
revoke all privileges on table public.user_flags from anon, authenticated;

grant select (
  user_id,
  verified
) on table public.user_flags to anon, authenticated;

-- LISTING APPROVALS
-- Do not expose moderation rows to anonymous visitors or unrelated users.
drop policy if exists approvals_read on public.listing_approvals;
drop policy if exists approvals_owner_or_admin_read on public.listing_approvals;

create policy approvals_owner_or_admin_read
on public.listing_approvals
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.listings l
    where l.id = listing_approvals.listing_id
      and l.seller_id = auth.uid()
  )
);

revoke all privileges on table public.listing_approvals from anon, authenticated;

grant select (
  listing_id,
  status,
  updated_at
) on table public.listing_approvals to authenticated;

grant update (
  status,
  reviewed_by,
  reviewed_at
) on table public.listing_approvals to authenticated;

-- LISTING VISIBILITY
-- Centralize the exact same visibility rule for listing rows and image metadata.
drop policy if exists listings_public_or_owner_read on public.listings;

create policy listings_public_or_owner_read
on public.listings
for select
to public
using (public.can_read_listing(id));

drop policy if exists listing_images_visible_read on public.listing_images;

create policy listing_images_visible_read
on public.listing_images
for select
to anon, authenticated
using (public.can_read_listing(listing_id));

-- Least-privilege table grants for listing image metadata.
revoke all privileges on table public.listing_images from anon, authenticated;

grant select on table public.listing_images to anon, authenticated;
grant insert (listing_id, storage_path, sort_order)
  on table public.listing_images to authenticated;
grant update (sort_order)
  on table public.listing_images to authenticated;
grant delete on table public.listing_images to authenticated;

commit;
