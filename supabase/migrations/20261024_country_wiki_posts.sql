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
