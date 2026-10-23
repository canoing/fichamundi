create extension if not exists pgcrypto;

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

drop index if exists public.custom_modules_active_catalog_idx;
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
