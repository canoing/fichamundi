drop policy if exists "Anyone can read current approved custom modules" on public.custom_modules;
drop policy if exists "Anyone can read approved and rejected custom modules" on public.custom_modules;

create policy "Anyone can read approved and rejected custom modules"
    on public.custom_modules for select to anon, authenticated
    using ((status = 'approved' and is_current) or status = 'rejected');
