create table if not exists public.investigation_countries (
    id uuid primary key default gen_random_uuid(),
    country text not null check (char_length(trim(country)) between 1 and 100),
    created_at timestamptz not null default now()
);

create unique index if not exists investigation_countries_name_unique_idx
    on public.investigation_countries (lower(trim(country)));

create index if not exists investigation_countries_created_idx
    on public.investigation_countries (created_at desc);

create table if not exists public.investigation_country_states (
    country_id uuid not null
        references public.investigation_countries (id) on delete cascade,
    node_id text not null check (char_length(trim(node_id)) between 1 and 2000),
    category text not null
        check (category in ('civil', 'infanteria', 'naval', 'blindados', 'aerea')),
    status text not null default 'not_started'
        check (status in ('not_started', 'in_progress', 'completed')),
    updated_at timestamptz not null default now(),
    primary key (country_id, node_id)
);

create index if not exists investigation_country_states_category_status_idx
    on public.investigation_country_states (country_id, category, status);

create or replace function public.enforce_investigation_slot_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    active_count integer;
begin
    if tg_op = 'UPDATE'
        and (
            old.country_id is distinct from new.country_id
            or old.node_id is distinct from new.node_id
            or old.category is distinct from new.category
        ) then
        raise exception 'No se permite mover una investigación a otra rama o categoría.'
            using errcode = '23514';
    end if;

    if new.status = 'in_progress' then
        perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(new.country_id::text || ':' || new.category, 0)
        );

        select count(*)
        into active_count
        from public.investigation_country_states
        where country_id = new.country_id
            and category = new.category
            and status = 'in_progress'
            and node_id <> new.node_id;

        if active_count >= 2 then
            raise exception 'Los 2 slots de investigación de esta categoría ya están ocupados para el país.'
                using errcode = '23514';
        end if;
    end if;

    new.updated_at := now();
    return new;
end;
$$;

revoke all on function public.enforce_investigation_slot_limit()
    from public, anon, authenticated;

drop trigger if exists enforce_investigation_slot_limit
    on public.investigation_country_states;
create trigger enforce_investigation_slot_limit
    before insert or update on public.investigation_country_states
    for each row execute function public.enforce_investigation_slot_limit();

alter table public.investigation_countries enable row level security;
alter table public.investigation_country_states enable row level security;

drop policy if exists "Anyone can read investigation countries"
    on public.investigation_countries;
drop policy if exists "Anyone can add investigation countries"
    on public.investigation_countries;
drop policy if exists "Anyone can read investigation country states"
    on public.investigation_country_states;
drop policy if exists "Anyone can add investigation country states"
    on public.investigation_country_states;
drop policy if exists "Anyone can update investigation country states"
    on public.investigation_country_states;

create policy "Anyone can read investigation countries"
    on public.investigation_countries for select to anon, authenticated
    using (true);

create policy "Anyone can add investigation countries"
    on public.investigation_countries for insert to anon, authenticated
    with check (true);

create policy "Anyone can read investigation country states"
    on public.investigation_country_states for select to anon, authenticated
    using (true);

create policy "Anyone can add investigation country states"
    on public.investigation_country_states for insert to anon, authenticated
    with check (true);

create policy "Anyone can update investigation country states"
    on public.investigation_country_states for update to anon, authenticated
    using (true)
    with check (true);

revoke all on public.investigation_countries, public.investigation_country_states
    from public, anon, authenticated;
grant select, insert on public.investigation_countries to anon, authenticated;
grant select, insert on public.investigation_country_states to anon, authenticated;
grant update (country_id, node_id, category, status)
    on public.investigation_country_states to anon, authenticated;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
                and schemaname = 'public'
                and tablename = 'investigation_countries'
        ) then
            execute 'alter publication supabase_realtime add table public.investigation_countries';
        end if;

        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
                and schemaname = 'public'
                and tablename = 'investigation_country_states'
        ) then
            execute 'alter publication supabase_realtime add table public.investigation_country_states';
        end if;
    end if;
end;
$$;
