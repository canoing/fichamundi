create or replace function public.update_investigation_category_states(
    p_country_id uuid,
    p_category text,
    p_states jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
    submitted_count integer;
    distinct_count integer;
    requested_in_progress integer;
    existing_in_progress integer;
begin
    if p_category is null
        or p_category not in ('civil', 'infanteria', 'naval', 'blindados', 'aerea') then
        raise exception 'Categoría de investigación no válida.'
            using errcode = '22023';
    end if;

    if p_states is null or jsonb_typeof(p_states) is distinct from 'array' then
        raise exception 'Los cambios de estado deben enviarse como una lista JSON.'
            using errcode = '22023';
    end if;

    select count(*), count(distinct item->>'node_id')
    into submitted_count, distinct_count
    from jsonb_array_elements(p_states) as entries(item);

    if submitted_count = 0 then
        raise exception 'No hay cambios de estado para guardar.'
            using errcode = '22023';
    end if;

    if submitted_count <> distinct_count or exists (
        select 1
        from jsonb_array_elements(p_states) as entries(item)
        where jsonb_typeof(item) is distinct from 'object'
            or jsonb_typeof(item->'node_id') is distinct from 'string'
            or char_length(trim(item->>'node_id')) not between 1 and 2000
            or jsonb_typeof(item->'status') is distinct from 'string'
            or item->>'status' not in ('not_started', 'in_progress', 'completed')
    ) then
        raise exception 'La lista contiene nodos duplicados o estados no válidos.'
            using errcode = '22023';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_country_id::text || ':' || p_category, 0)
    );

    select count(*)
    into existing_in_progress
    from public.investigation_country_states as states
    where states.country_id = p_country_id
        and states.category = p_category
        and states.status = 'in_progress'
        and not exists (
            select 1
            from jsonb_array_elements(p_states) as entries(item)
            where item->>'node_id' = states.node_id
        );

    select count(*)
    into requested_in_progress
    from jsonb_array_elements(p_states) as entries(item)
    where item->>'status' = 'in_progress';

    if existing_in_progress + requested_in_progress > 2 then
        raise exception 'Los 2 slots de investigación de esta categoría ya están ocupados para el país.'
            using errcode = '23514';
    end if;

    insert into public.investigation_country_states (
        country_id,
        node_id,
        category,
        status
    )
    select
        p_country_id,
        item->>'node_id',
        p_category,
        item->>'status'
    from jsonb_array_elements(p_states) as entries(item)
    where item->>'status' <> 'in_progress'
    on conflict (country_id, node_id)
    do update set status = excluded.status;

    insert into public.investigation_country_states (
        country_id,
        node_id,
        category,
        status
    )
    select
        p_country_id,
        item->>'node_id',
        p_category,
        item->>'status'
    from jsonb_array_elements(p_states) as entries(item)
    where item->>'status' = 'in_progress'
    on conflict (country_id, node_id)
    do update set status = excluded.status;
end;
$$;

revoke all on function public.update_investigation_category_states(uuid, text, jsonb)
    from public;
grant execute on function public.update_investigation_category_states(uuid, text, jsonb)
    to anon, authenticated;
