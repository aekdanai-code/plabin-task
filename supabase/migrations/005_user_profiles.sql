alter table public.profiles
  add column if not exists contact_info text,
  add column if not exists password_changed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_contact_info_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_contact_info_length
      check (contact_info is null or char_length(contact_info) <= 200);
  end if;
end;
$$;

create or replace function public.update_own_profile(
  next_display_name text,
  next_contact_info text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'ACTIVE_LOGIN_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active
  ) then
    raise exception 'ACTIVE_PROFILE_REQUIRED';
  end if;

  next_display_name := nullif(trim(next_display_name), '');
  next_contact_info := nullif(trim(next_contact_info), '');

  if next_display_name is null then
    raise exception 'DISPLAY_NAME_REQUIRED';
  end if;
  if char_length(next_display_name) > 120 then
    raise exception 'DISPLAY_NAME_TOO_LONG';
  end if;
  if next_contact_info is not null and char_length(next_contact_info) > 200 then
    raise exception 'CONTACT_INFO_TOO_LONG';
  end if;

  update public.profiles
  set display_name = next_display_name,
      contact_info = next_contact_info
  where id = (select auth.uid())
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create or replace function public.set_own_avatar_url(next_avatar_url text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'ACTIVE_LOGIN_REQUIRED';
  end if;

  if next_avatar_url is null
    or char_length(next_avatar_url) > 2048
    or next_avatar_url !~ '^https://'
  then
    raise exception 'INVALID_AVATAR_URL';
  end if;

  update public.profiles
  set avatar_url = next_avatar_url
  where id = (select auth.uid()) and is_active
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'ACTIVE_PROFILE_REQUIRED';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.mark_password_changed()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_at timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'ACTIVE_LOGIN_REQUIRED';
  end if;

  update public.profiles
  set password_changed_at = changed_at
  where id = (select auth.uid()) and is_active;

  if not found then
    raise exception 'ACTIVE_PROFILE_REQUIRED';
  end if;

  return changed_at;
end;
$$;

revoke all on function public.update_own_profile(text, text) from public, anon;
revoke all on function public.set_own_avatar_url(text) from public, anon;
revoke all on function public.mark_password_changed() from public, anon;
grant execute on function public.update_own_profile(text, text) to authenticated;
grant execute on function public.set_own_avatar_url(text) to authenticated;
grant execute on function public.mark_password_changed() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_owner_select on storage.objects;
drop policy if exists avatars_owner_insert on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
drop policy if exists avatars_owner_delete on storage.objects;

create policy avatars_owner_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy avatars_owner_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy avatars_owner_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy avatars_owner_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
