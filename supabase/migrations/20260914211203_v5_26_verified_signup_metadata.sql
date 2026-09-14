-- v5.26 Step 3: persist signup legal acceptance from Auth metadata.
-- Backward-compatible with the current register-user Edge Function:
-- legacy signups still upsert these fields after auth user creation.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;
