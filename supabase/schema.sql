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

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.moderator_settings (
    setting_id boolean primary key default true check (setting_id),
    moderator_key text not null check (char_length(moderator_key) >= 16),
    updated_at timestamptz not null default now()
);
revoke all on private.moderator_settings from public, anon, authenticated;

create or replace function public.update_pending_template_content(
    p_template_id uuid,
    p_content jsonb,
    p_moderator_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_moderator_key is null or not exists (
        select 1
        from private.moderator_settings
        where setting_id and moderator_key = p_moderator_key
    ) then
        raise exception 'Invalid moderator key.' using errcode = '42501';
    end if;

    if p_content is null or jsonb_typeof(p_content) not in ('object', 'array') then
        raise exception 'Template content must be a JSON object or array.' using errcode = '22023';
    end if;

    update public.templates
    set content = p_content
    where id = p_template_id
      and status = 'pending';

    if not found then
        raise exception 'Template not found or no longer pending.' using errcode = 'P0002';
    end if;

    return true;
end;
$$;

revoke all on function public.update_pending_template_content(uuid, jsonb, text) from public;
grant execute on function public.update_pending_template_content(uuid, jsonb, text) to anon, authenticated;

create table if not exists public.custom_modules (
    id uuid primary key default gen_random_uuid(),
    revision_of uuid references public.custom_modules (id) on delete restrict,
    vehicle text not null constraint custom_modules_vehicle_check
        check (vehicle in ('tank', 'aircraft', 'naval', 'infantry')),
    module_type text not null constraint custom_modules_module_type_check check (
        (vehicle = 'tank' and module_type in ('chassis', 'traccion', 'motor', 'comunicacion', 'blindaje', 'armamento'))
        or (vehicle = 'aircraft' and module_type in ('fuselaje', 'motores', 'armamento', 'bombas', 'torpedos', 'alas'))
        or (vehicle = 'naval' and module_type in (
            'hull_destructores', 'hull_fragatas', 'hull_cruceros_ligeros',
            'hull_cruceros_pesados', 'hull_cruceros_de_batalla',
            'hull_acorazados_dreadnoughts', 'hull_submarinos',
            'propulsion', 'armamento', 'blindaje'
        ))
        or (vehicle = 'infantry' and module_type = 'weapon')
    ),
    country text not null constraint custom_modules_country_check
        check (char_length(trim(country)) between 1 and 100),
    content jsonb not null check (jsonb_typeof(content) = 'object'),
    price numeric(12, 2) check (price is null or price >= 0),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    is_current boolean not null default true,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    review_comment text,
    constraint custom_modules_review_fields_consistent check (
        (status = 'pending' and reviewed_at is null and review_comment is null)
        or (status in ('approved', 'rejected') and reviewed_at is not null)
    ),
    constraint custom_modules_approved_price_required check (
        status != 'approved' or price is not null
    )
);

alter table public.custom_modules
    add column if not exists country text;
alter table public.custom_modules
    drop constraint if exists custom_modules_vehicle_check,
    drop constraint if exists custom_modules_module_type_check,
    drop constraint if exists custom_modules_country_check,
    drop constraint if exists custom_modules_check;
update public.custom_modules
set country = 'GLOBAL'
where country is null;
update public.custom_modules
set module_type = 'armamento'
where vehicle = 'tank' and module_type = 'armament';
alter table public.custom_modules
    alter column country set not null;
alter table public.custom_modules
    add constraint custom_modules_vehicle_check
        check (vehicle in ('tank', 'aircraft', 'naval', 'infantry')),
    add constraint custom_modules_module_type_check check (
        (vehicle = 'tank' and module_type in ('chassis', 'traccion', 'motor', 'comunicacion', 'blindaje', 'armamento'))
        or (vehicle = 'aircraft' and module_type in ('fuselaje', 'motores', 'armamento', 'bombas', 'torpedos', 'alas'))
        or (vehicle = 'naval' and module_type in (
            'hull_destructores', 'hull_fragatas', 'hull_cruceros_ligeros',
            'hull_cruceros_pesados', 'hull_cruceros_de_batalla',
            'hull_acorazados_dreadnoughts', 'hull_submarinos',
            'propulsion', 'armamento', 'blindaje'
        ))
        or (vehicle = 'infantry' and module_type = 'weapon')
    ),
    add constraint custom_modules_country_check
        check (char_length(trim(country)) between 1 and 100);

create index if not exists custom_modules_active_catalog_idx
    on public.custom_modules (vehicle, module_type, country, created_at desc)
    where status = 'approved' and is_current;
create unique index if not exists custom_modules_one_pending_revision_idx
    on public.custom_modules (revision_of)
    where revision_of is not null and status = 'pending';

alter table public.custom_modules enable row level security;
revoke all on public.custom_modules from public, anon, authenticated;
drop policy if exists "Anyone can read current approved custom modules" on public.custom_modules;
create policy "Anyone can read current approved custom modules"
    on public.custom_modules for select to anon, authenticated
    using (status = 'approved' and is_current);
drop policy if exists "Anyone can submit custom modules for review" on public.custom_modules;
create policy "Anyone can submit custom modules for review"
    on public.custom_modules for insert to anon, authenticated
    with check (
        status = 'pending'
        and price is null
        and char_length(trim(country)) between 1 and 100
        and reviewed_at is null
        and review_comment is null
        and is_current
        and (
            revision_of is null
            or exists (
                select 1
                from public.custom_modules previous
                where previous.id = revision_of
                  and previous.vehicle = custom_modules.vehicle
                  and previous.module_type = custom_modules.module_type
                  and previous.country = custom_modules.country
                  and previous.status = 'approved'
                  and previous.is_current
            )
        )
    );
grant select, insert on public.custom_modules to anon, authenticated;

create or replace function public.check_moderator_key(p_moderator_key text)
returns boolean
language sql
security definer
set search_path = ''
as $$
    select p_moderator_key is not null and exists (
        select 1
        from private.moderator_settings
        where setting_id and moderator_key = p_moderator_key
    );
$$;

revoke all on function public.check_moderator_key(text) from public;
grant execute on function public.check_moderator_key(text) to anon, authenticated;

create or replace function public.get_pending_custom_modules(p_moderator_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    pending_modules jsonb;
begin
    if p_moderator_key is null or not exists (
        select 1
        from private.moderator_settings
        where setting_id and moderator_key = p_moderator_key
    ) then
        raise exception 'Invalid moderator key.' using errcode = '42501';
    end if;

    select coalesce(jsonb_agg(to_jsonb(module_row) order by module_row.created_at), '[]'::jsonb)
    into pending_modules
    from public.custom_modules module_row
    where module_row.status = 'pending';

    return pending_modules;
end;
$$;

create or replace function public.review_custom_module(
    p_module_id uuid,
    p_status text,
    p_content jsonb,
    p_price numeric,
    p_review_comment text,
    p_moderator_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    pending_module public.custom_modules%rowtype;
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

    if p_content is null or jsonb_typeof(p_content) != 'object'
       or (p_price is not null and p_price < 0)
       or (p_status = 'approved' and p_price is null)
       or (p_review_comment is not null and char_length(trim(p_review_comment)) > 5000) then
        raise exception 'Invalid module content, price, or review comment.' using errcode = '22023';
    end if;

    select *
    into pending_module
    from public.custom_modules
    where id = p_module_id and status = 'pending'
    for update;

    if not found then
        raise exception 'Module not found or no longer pending.' using errcode = 'P0002';
    end if;

    if p_status = 'approved' and pending_module.revision_of is not null then
        update public.custom_modules
        set is_current = false
        where id = pending_module.revision_of
          and status = 'approved'
          and is_current;

        if not found then
            raise exception 'The approved module revision is no longer current.' using errcode = '40001';
        end if;
    end if;

    update public.custom_modules
    set content = p_content,
        price = p_price,
        status = p_status,
        reviewed_at = now(),
        review_comment = nullif(trim(p_review_comment), '')
    where id = p_module_id;

    return true;
end;
$$;

revoke all on function public.get_pending_custom_modules(text) from public;
revoke all on function public.review_custom_module(uuid, text, jsonb, numeric, text, text) from public;
grant execute on function public.get_pending_custom_modules(text) to anon, authenticated;
grant execute on function public.review_custom_module(uuid, text, jsonb, numeric, text, text) to anon, authenticated;

create table if not exists public.country_wiki_posts (
    id uuid primary key default gen_random_uuid(),
    country text not null check (char_length(trim(country)) between 1 and 100),
    content text not null check (char_length(trim(content)) between 1 and 10000),
    economy jsonb not null default '{}'::jsonb check (jsonb_typeof(economy) = 'object'),
    weapons jsonb not null default '[]'::jsonb check (jsonb_typeof(weapons) = 'array'),
    approved_modules jsonb not null default '[]'::jsonb check (jsonb_typeof(approved_modules) = 'array'),
    investigations jsonb not null default '[]'::jsonb check (jsonb_typeof(investigations) = 'array'),
    created_at timestamptz not null default now()
);

create index if not exists country_wiki_posts_created_idx
    on public.country_wiki_posts (created_at desc);
create index if not exists country_wiki_posts_country_created_idx
    on public.country_wiki_posts (lower(trim(country)), created_at desc);

alter table public.country_wiki_posts enable row level security;
revoke all on public.country_wiki_posts from public, anon, authenticated;

drop policy if exists "Anyone can read country wiki posts"
    on public.country_wiki_posts;
create policy "Anyone can read country wiki posts"
    on public.country_wiki_posts for select to anon, authenticated
    using (true);

drop policy if exists "Anyone can publish country wiki posts"
    on public.country_wiki_posts;
create policy "Anyone can publish country wiki posts"
    on public.country_wiki_posts for insert to anon, authenticated
    with check (
        char_length(trim(country)) between 1 and 100
        and char_length(trim(content)) between 1 and 10000
        and jsonb_typeof(weapons) = 'array'
        and jsonb_typeof(approved_modules) = 'array'
        and jsonb_typeof(investigations) = 'array'
    );

grant select, insert on public.country_wiki_posts to anon, authenticated;
grant update (content, economy) on public.country_wiki_posts to anon, authenticated;

drop policy if exists "Anyone can edit country wiki posts"
    on public.country_wiki_posts;
create policy "Anyone can edit country wiki posts"
    on public.country_wiki_posts for update to anon, authenticated
    using (true)
    with check (
        char_length(trim(country)) between 1 and 100
        and char_length(trim(content)) between 1 and 10000
        and jsonb_typeof(economy) = 'object'
    );
