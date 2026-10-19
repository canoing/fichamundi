create extension if not exists pgcrypto;

create table if not exists public.moderators (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.templates (
    id uuid primary key default gen_random_uuid(),
    country text not null check (char_length(trim(country)) between 1 and 100),
    file_name text not null check (char_length(trim(file_name)) between 1 and 255),
    content jsonb not null check (jsonb_typeof(content) in ('object', 'array')),
    status text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users (id) on delete set null,
    review_comment text,
    constraint templates_review_fields_consistent check (
        (status = 'pending' and reviewed_at is null and reviewed_by is null)
        or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
    )
);

create index if not exists templates_status_country_created_idx
    on public.templates (status, country, created_at desc);

create table if not exists public.template_comments (
    id uuid primary key default gen_random_uuid(),
    template_id uuid not null references public.templates (id) on delete cascade,
    json_path text not null check (char_length(trim(json_path)) between 1 and 500),
    comment text not null check (char_length(trim(comment)) between 1 and 5000),
    created_at timestamptz not null default now(),
    created_by uuid not null references auth.users (id) on delete restrict
);

create index if not exists template_comments_template_created_idx
    on public.template_comments (template_id, created_at);

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.moderators
        where user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_moderator() from public;

alter table public.moderators enable row level security;
alter table public.templates enable row level security;
alter table public.template_comments enable row level security;

drop policy if exists "Moderators can read their own role" on public.moderators;
drop policy if exists "Anyone can read approved templates" on public.templates;
drop policy if exists "Anyone can read all templates" on public.templates;
drop policy if exists "Anyone can submit pending templates" on public.templates;
drop policy if exists "Moderators can update templates" on public.templates;
drop policy if exists "Moderators can delete templates" on public.templates;
drop policy if exists "Anyone can read comments on approved templates" on public.template_comments;
drop policy if exists "Anyone can read all template comments" on public.template_comments;
drop policy if exists "Moderators can add template comments" on public.template_comments;
drop policy if exists "Moderators can update template comments" on public.template_comments;
drop policy if exists "Moderators can delete template comments" on public.template_comments;

create policy "Moderators can read their own role"
    on public.moderators for select to authenticated
    using (user_id = (select auth.uid()));

create policy "Anyone can read all templates"
    on public.templates for select to anon, authenticated
    using (true);

create policy "Anyone can submit pending templates"
    on public.templates for insert to anon, authenticated
    with check (
        status = 'pending'
        and reviewed_at is null
        and reviewed_by is null
        and review_comment is null
    );

create policy "Moderators can update templates"
    on public.templates for update to authenticated
    using ((select public.is_moderator()) and status = 'pending')
    with check (
        (select public.is_moderator())
        and status in ('approved', 'rejected')
        and reviewed_at is not null
        and reviewed_by = (select auth.uid())
    );

create policy "Anyone can read all template comments"
    on public.template_comments for select to anon, authenticated
    using (true);

create policy "Moderators can add template comments"
    on public.template_comments for insert to authenticated
    with check (
        (select public.is_moderator())
        and created_by = (select auth.uid())
    );

revoke all on public.moderators, public.templates, public.template_comments from public, anon, authenticated;
revoke update (country, file_name, content, status, reviewed_at, reviewed_by, review_comment)
    on public.templates from public, anon, authenticated;
grant select on public.moderators to authenticated;
grant select, insert on public.templates to anon, authenticated;
grant update (status, reviewed_at, reviewed_by) on public.templates to authenticated;
grant select on public.template_comments to anon, authenticated;
grant insert on public.template_comments to authenticated;
grant execute on function public.is_moderator() to anon, authenticated;
