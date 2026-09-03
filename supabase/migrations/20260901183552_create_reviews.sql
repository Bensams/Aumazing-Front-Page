create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references auth.users (id),
  display_name text,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (
    btrim(comment) <> ''
    and char_length(comment) <= 1000
  ),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected')
  ),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint reviews_reviewer_id_key unique (reviewer_id),
  constraint reviews_approved_at_matches_status check (
    (status = 'approved') = (approved_at is not null)
  )
);

create function public.sync_review_approved_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' then
    if tg_op = 'INSERT' then
      new.approved_at := now();
    elsif old.status is distinct from 'approved' then
      new.approved_at := now();
    else
      new.approved_at := old.approved_at;
    end if;
  else
    new.approved_at := null;
  end if;

  return new;
end;
$$;

create trigger reviews_sync_approved_at
before insert or update of status, approved_at on public.reviews
for each row
execute function public.sync_review_approved_at();

alter table public.reviews enable row level security;

revoke all on table public.reviews from public;
revoke all on table public.reviews from anon;
revoke all on table public.reviews from authenticated;

revoke execute on function public.sync_review_approved_at() from public;
revoke execute on function public.sync_review_approved_at() from anon;
revoke execute on function public.sync_review_approved_at() from authenticated;

grant select on table public.reviews to anon, authenticated;
grant insert (reviewer_id, display_name, rating, comment)
on table public.reviews
to authenticated;

create policy "Approved reviews are publicly readable"
on public.reviews
for select
to anon, authenticated
using (status = 'approved');

create policy "Authenticated users can submit one pending review"
on public.reviews
for insert
to authenticated
with check (
  reviewer_id = (select auth.uid())
  and status = 'pending'
  and approved_at is null
  and rating between 1 and 5
  and btrim(comment) <> ''
  and char_length(comment) <= 1000
);
