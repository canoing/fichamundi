drop function if exists public.review_template(uuid, text, text);
drop function if exists public.review_template(uuid, text, text, text);

create function public.review_template(
    p_template_id uuid,
    p_status text,
    p_review_comment text,
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

    if p_review_comment is not null and char_length(trim(p_review_comment)) > 5000 then
        raise exception 'Review comment must not exceed 5000 characters.' using errcode = '22023';
    end if;

    update public.templates
    set status = p_status,
        reviewed_at = now(),
        reviewed_by = null,
        review_comment = nullif(trim(p_review_comment), '')
    where id = p_template_id
      and status = 'pending';

    if not found then
        raise exception 'Template not found or no longer pending.' using errcode = 'P0002';
    end if;

    return true;
end;
$$;

revoke all on function public.review_template(uuid, text, text, text) from public;
grant execute on function public.review_template(uuid, text, text, text) to anon, authenticated;
