create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.moderator_settings (
    setting_id boolean primary key default true check (setting_id),
    moderator_key text not null check (char_length(moderator_key) >= 16),
    updated_at timestamptz not null default now()
);

revoke all on private.moderator_settings from public, anon, authenticated;

alter table public.templates
    drop constraint if exists templates_review_fields_consistent;
alter table public.templates
    add constraint templates_review_fields_consistent check (
        (status = 'pending' and reviewed_at is null and reviewed_by is null)
        or (status in ('approved', 'rejected') and reviewed_at is not null)
    );
alter table public.template_comments
    alter column created_by drop not null;
alter table public.moderators enable row level security;
alter table public.templates enable row level security;
alter table public.template_comments enable row level security;

drop policy if exists "Moderators can update templates" on public.templates;
drop policy if exists "Moderators can delete templates" on public.templates;
drop policy if exists "Anyone can read approved templates" on public.templates;
drop policy if exists "Anyone can read all templates" on public.templates;
drop policy if exists "Anyone can submit pending templates" on public.templates;
drop policy if exists "Moderators can read their own role" on public.moderators;
drop policy if exists "Anyone can read comments on approved templates" on public.template_comments;
drop policy if exists "Anyone can read all template comments" on public.template_comments;
drop policy if exists "Moderators can add template comments" on public.template_comments;
drop policy if exists "Moderators can update template comments" on public.template_comments;
drop policy if exists "Moderators can delete template comments" on public.template_comments;

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

create policy "Anyone can read all template comments"
    on public.template_comments for select to anon, authenticated
    using (true);

revoke all on public.templates, public.template_comments from public, anon, authenticated;
revoke update (country, file_name, content, status, reviewed_at, reviewed_by, review_comment)
    on public.templates from public, anon, authenticated;
revoke insert, update, delete on public.template_comments from public, anon, authenticated;
grant select, insert on public.templates to anon, authenticated;
grant select on public.template_comments to anon, authenticated;
revoke all on public.moderators from public, anon, authenticated;
revoke all on function public.is_moderator() from public, anon, authenticated;

create or replace function public.review_template(
    p_template_id uuid,
    p_status text,
    p_moderator_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_status is null or p_status not in ('approved', 'rejected') then
        raise exception 'Invalid review status.' using errcode = '22023';
    end if;

    if p_moderator_key is null or not exists (
        select 1
        from private.moderator_settings
        where setting_id and moderator_key = p_moderator_key
    ) then
        raise exception 'Invalid moderator key.' using errcode = '42501';
    end if;

    update public.templates
    set status = p_status,
        reviewed_at = now(),
        reviewed_by = null
    where id = p_template_id
      and status = 'pending';

    if not found then
        raise exception 'Template not found or no longer pending.' using errcode = 'P0002';
    end if;

    return true;
end;
$$;

create or replace function public.add_template_comment(
    p_template_id uuid,
    p_json_path text,
    p_comment text,
    p_moderator_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_comment_id uuid;
begin
    if p_moderator_key is null or not exists (
        select 1
        from private.moderator_settings
        where setting_id and moderator_key = p_moderator_key
    ) then
        raise exception 'Invalid moderator key.' using errcode = '42501';
    end if;

    if p_json_path is null or char_length(trim(p_json_path)) not between 1 and 500
       or p_comment is null or char_length(trim(p_comment)) not between 1 and 5000 then
        raise exception 'Invalid comment or JSON path.' using errcode = '22023';
    end if;

    insert into public.template_comments (template_id, json_path, comment, created_by)
    values (p_template_id, trim(p_json_path), trim(p_comment), null)
    returning id into new_comment_id;

    return new_comment_id;
end;
$$;

revoke all on function public.review_template(uuid, text, text) from public;
revoke all on function public.add_template_comment(uuid, text, text, text) from public;
grant execute on function public.review_template(uuid, text, text) to anon, authenticated;
grant execute on function public.add_template_comment(uuid, text, text, text) to anon, authenticated;
