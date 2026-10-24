-- Agency commercial profile for INDEX 2.0
-- Applied to Supabase project tjwklmqrsvtyqdmudukf on 2026-10-24.

create table if not exists public.agency_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  commercial_name text,
  advisor_name text,
  whatsapp text,
  phone text,
  email text,
  website text,
  facebook text,
  instagram text,
  logo_path text,
  show_whatsapp boolean not null default true,
  show_email boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint agency_profiles_commercial_name_len check (commercial_name is null or char_length(commercial_name) <= 120),
  constraint agency_profiles_advisor_name_len check (advisor_name is null or char_length(advisor_name) <= 120),
  constraint agency_profiles_whatsapp_len check (whatsapp is null or char_length(whatsapp) <= 40),
  constraint agency_profiles_phone_len check (phone is null or char_length(phone) <= 40),
  constraint agency_profiles_email_len check (email is null or char_length(email) <= 254),
  constraint agency_profiles_website_len check (website is null or char_length(website) <= 300),
  constraint agency_profiles_facebook_len check (facebook is null or char_length(facebook) <= 300),
  constraint agency_profiles_instagram_len check (instagram is null or char_length(instagram) <= 300),
  constraint agency_profiles_logo_path_len check (logo_path is null or char_length(logo_path) <= 500)
);

alter table public.agency_profiles enable row level security;

grant select, insert, update on public.agency_profiles to authenticated;
revoke all on public.agency_profiles from anon;

create policy agency_profiles_self_select
on public.agency_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy agency_profiles_self_insert
on public.agency_profiles
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.index_agencies ia
    where ia.user_id = (select auth.uid())
      and ia.active = true
  )
);

create policy agency_profiles_self_update
on public.agency_profiles
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.index_agencies ia
    where ia.user_id = (select auth.uid())
      and ia.active = true
  )
)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agency-branding',
  'agency-branding',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy agency_branding_self_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'agency-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy agency_branding_self_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agency-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.index_agencies ia
    where ia.user_id = (select auth.uid())
      and ia.active = true
  )
);

create policy agency_branding_self_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'agency-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'agency-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy agency_branding_self_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'agency-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
