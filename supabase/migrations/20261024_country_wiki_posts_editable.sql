alter table public.country_wiki_posts
    add column if not exists economy jsonb not null default '{}'::jsonb
        check (jsonb_typeof(economy) = 'object');

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

grant update (content, economy) on public.country_wiki_posts to anon, authenticated;
