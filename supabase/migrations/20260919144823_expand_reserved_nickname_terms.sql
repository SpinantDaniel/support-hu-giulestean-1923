-- Expand reserved nickname terms while preserving the existing admin exception.
-- Normalization is case-insensitive, removes separators/punctuation, and folds common Romanian diacritics.

create or replace function private.validate_profile_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text := btrim(coalesce(new.display_name, ''));
  v_normalized text;
  v_reserved_allowed boolean := false;
  v_reserved_term text;
begin
  if tg_op = 'UPDATE' and new.display_name is not distinct from old.display_name then
    return new;
  end if;

  v_normalized := regexp_replace(
    translate(lower(v_name), 'ăâîșşțţ', 'aaisstt'),
    '[^a-z0-9]+',
    '',
    'g'
  );

  select term
  into v_reserved_term
  from unnest(array['admin','rapidistpursange','premium','gold','silver']::text[]) as term
  where position(term in v_normalized) > 0
  limit 1;

  select exists(
    select 1
    from private.nickname_reserved_exceptions e
    where e.user_id = new.id
  ) into v_reserved_allowed;

  if v_reserved_term is not null and not v_reserved_allowed then
    raise exception using errcode = 'P0001', message = 'DISPLAY_NAME_RESERVED';
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 14 then
    raise exception using errcode = 'P0001', message = 'DISPLAY_NAME_LENGTH_INVALID';
  end if;

  new.display_name := v_name;
  return new;
end;
$function$;
