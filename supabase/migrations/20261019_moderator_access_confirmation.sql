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
