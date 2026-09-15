begin;

create or replace function public.create_my_listing_atomic(
  p_category_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_currency text,
  p_condition text,
  p_location text,
  p_negotiable boolean,
  p_phone text,
  p_whatsapp text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_listing_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.is_user_suspended(v_uid) then
    raise exception 'USER_SUSPENDED';
  end if;

  if nullif(btrim(coalesce(p_phone,'')),'') is null
     and nullif(btrim(coalesce(p_whatsapp,'')),'') is null then
    raise exception 'CONTACT_REQUIRED';
  end if;

  insert into public.listings(
    seller_id,
    category_id,
    title,
    description,
    price,
    currency,
    condition,
    location,
    negotiable,
    state
  )
  values(
    v_uid,
    p_category_id,
    btrim(p_title),
    btrim(p_description),
    p_price,
    p_currency,
    p_condition,
    btrim(p_location),
    p_negotiable,
    'active'
  )
  returning id into v_listing_id;

  insert into public.listing_contacts(
    listing_id,
    seller_id,
    phone,
    whatsapp
  )
  values(
    v_listing_id,
    v_uid,
    nullif(btrim(coalesce(p_phone,'')),''),
    nullif(btrim(coalesce(p_whatsapp,'')),'')
  );

  return v_listing_id;
end;
$$;

revoke all on function public.create_my_listing_atomic(
  uuid,text,text,numeric,text,text,text,boolean,text,text
) from public;

grant execute on function public.create_my_listing_atomic(
  uuid,text,text,numeric,text,text,text,boolean,text,text
) to authenticated;

commit;
