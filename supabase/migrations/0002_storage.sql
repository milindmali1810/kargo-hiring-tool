-- Private storage bucket for original resume files (PDF/DOCX).
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "authenticated read resumes"
  on storage.objects for select
  using (bucket_id = 'resumes' and auth.role() = 'authenticated');

create policy "authenticated upload resumes"
  on storage.objects for insert
  with check (bucket_id = 'resumes' and auth.role() = 'authenticated');

create policy "authenticated delete resumes"
  on storage.objects for delete
  using (bucket_id = 'resumes' and auth.role() = 'authenticated');
