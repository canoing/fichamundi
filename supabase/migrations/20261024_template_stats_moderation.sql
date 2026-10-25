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
