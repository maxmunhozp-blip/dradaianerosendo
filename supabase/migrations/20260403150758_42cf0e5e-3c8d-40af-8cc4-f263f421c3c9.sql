
create table if not exists public.feature_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  user_email text,
  type text not null,
  title text not null,
  description text not null,
  ai_interpretation text,
  image_urls text[] default '{}',
  status text not null default 'pendente',
  admin_response text,
  priority text default 'normal',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.feature_requests enable row level security;

create policy "Users can insert their own requests"
  on public.feature_requests for insert with check (auth.uid() = user_id);

create policy "Users can view their own requests"
  on public.feature_requests for select using (auth.uid() = user_id);

create policy "Admins can view all requests"
  on public.feature_requests for select using (
    public.has_role(auth.uid(), 'admin')
  );

create policy "Admins can update all requests"
  on public.feature_requests for update using (
    public.has_role(auth.uid(), 'admin')
  );

-- Trigger for updated_at
create trigger update_feature_requests_updated_at
  before update on public.feature_requests
  for each row execute function public.update_updated_at_column();

-- Validation triggers instead of check constraints
create or replace function public.validate_feature_request_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.type not in ('bug', 'feature', 'ajuste') then
    raise exception 'Invalid type: %', NEW.type;
  end if;
  return NEW;
end;
$$;

create trigger validate_feature_request_type_trigger
  before insert or update on public.feature_requests
  for each row execute function public.validate_feature_request_type();

create or replace function public.validate_feature_request_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status not in ('pendente', 'em_analise', 'em_desenvolvimento', 'concluido', 'recusado') then
    raise exception 'Invalid status: %', NEW.status;
  end if;
  return NEW;
end;
$$;

create trigger validate_feature_request_status_trigger
  before insert or update on public.feature_requests
  for each row execute function public.validate_feature_request_status();

create or replace function public.validate_feature_request_priority()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.priority not in ('baixa', 'normal', 'alta', 'critica') then
    raise exception 'Invalid priority: %', NEW.priority;
  end if;
  return NEW;
end;
$$;

create trigger validate_feature_request_priority_trigger
  before insert or update on public.feature_requests
  for each row execute function public.validate_feature_request_priority();

-- Storage bucket
insert into storage.buckets (id, name, public) values ('request-images', 'request-images', true);

create policy "Authenticated users can upload request images"
  on storage.objects for insert with check (
    bucket_id = 'request-images' and auth.role() = 'authenticated'
  );

create policy "Public read request images"
  on storage.objects for select using (bucket_id = 'request-images');
