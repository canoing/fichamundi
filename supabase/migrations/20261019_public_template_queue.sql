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

revoke all on public.moderators, public.templates, public.template_comments
    from public, anon, authenticated;
revoke update (country, file_name, content, status, reviewed_at, reviewed_by, review_comment)
    on public.templates from public, anon, authenticated;

grant select on public.moderators to authenticated;
grant select, insert on public.templates to anon, authenticated;
grant update (status, reviewed_at, reviewed_by) on public.templates to authenticated;
grant select on public.template_comments to anon, authenticated;
grant insert on public.template_comments to authenticated;
grant execute on function public.is_moderator() to anon, authenticated;
