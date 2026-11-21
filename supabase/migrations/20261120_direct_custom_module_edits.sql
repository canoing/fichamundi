drop function if exists public.publish_custom_module_edit(uuid, jsonb, text, text, text);

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

revoke all on function public.review_custom_module(uuid, text, jsonb, numeric, text, text) from public;
grant execute on function public.review_custom_module(uuid, text, jsonb, numeric, text, text) to anon, authenticated;
