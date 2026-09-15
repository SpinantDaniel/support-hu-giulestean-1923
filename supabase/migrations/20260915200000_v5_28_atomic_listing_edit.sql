begin;

create or replace function public.update_my_listing_atomic(
  p_listing_id uuid,
  p_category_id uuid,
  p_title text,
  p_description text,
  p_price numeric,
  p_currency text,
  p_condition text,
  p_location text,
  p_negotiable boolean,
  p_phone text,
  p_whatsapp text,
  p_image_paths text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_path text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.is_user_suspended(v_uid) then
    raise exception 'USER_SUSPENDED';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = p_listing_id
      and l.seller_id = v_uid
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
  where id = p_listing_id
    and seller_id = v_uid;

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
$$;

revoke all on function public.update_my_listing_atomic(
  uuid,uuid,text,text,numeric,text,text,text,boolean,text,text,text[]
) from public;

grant execute on function public.update_my_listing_atomic(
  uuid,uuid,text,text,numeric,text,text,text,boolean,text,text,text[]
) to authenticated;

commit;
