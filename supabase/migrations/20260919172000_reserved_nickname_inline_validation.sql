-- Reserved nickname hardening:
-- - block reserved terms anywhere in changed/new nicknames
-- - preserve an existing legacy nickname only while it remains unchanged
-- - remove the previous admin exception for changed nicknames

create or replace function private.validate_profile_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text := btrim(coalesce(new.display_name, ''));
  v_normalized text;
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
  from unnest(array['administrator','admin','rapidistpursange','premium','gold','silver']::text[]) as term
  where position(term in v_normalized) > 0
  limit 1;

  if v_reserved_term is not null then
    raise exception using errcode = 'P0001', message = 'DISPLAY_NAME_RESERVED';
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 14 then
    raise exception using errcode = 'P0001', message = 'DISPLAY_NAME_LENGTH_INVALID';
  end if;

  new.display_name := v_name;
  return new;
end;
$function$;
