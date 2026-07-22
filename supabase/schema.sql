create extension if not exists pgcrypto;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null default auth.uid(),
  name text not null,
  icon_path text not null,
  is_system boolean not null default false,
  color_hex text not null default '#808080',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  sync_version integer not null default 1
);

create table if not exists task_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null default auth.uid(),
  category_id uuid not null references categories(id),
  title text not null,
  description text null,
  start_date date not null,
  due_date date null,
  start_time text not null,
  time_to_complete integer not null,
  reminder_enabled boolean not null default false,
  recurrence_type text not null default 'NONE',
  recurrence_interval text null,
  custom_days text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  sync_version integer not null default 1
);

create table if not exists task_occurrences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null default auth.uid(),
  task_template_id uuid null references task_templates(id) on delete set null,
  date date not null,
  title text not null,
  description text null,
  category_id uuid not null references categories(id),
  start_time text not null,
  time_to_complete integer not null,
  status text not null default 'TODO',
  elapsed_time integer not null default 0,
  reminder_enabled boolean not null default false,
  is_detached boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  sync_version integer not null default 1
);

create table if not exists timer_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null default auth.uid(),
  task_occurrence_id uuid not null references task_occurrences(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  sync_version integer not null default 1
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null default auth.uid(),
  task_occurrence_id uuid not null references task_occurrences(id) on delete cascade,
  scheduled_time timestamptz not null,
  status text not null default 'PENDING',
  snooze_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  sync_version integer not null default 1
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique null default auth.uid(),
  theme text not null default 'system',
  default_reminder integer not null default 10,
  week_start text not null default 'Monday',
  default_duration integer not null default 30,
  notification_sound text not null default 'default',
  language text not null default 'en',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  sync_version integer not null default 1
);

create table if not exists streaks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique null default auth.uid(),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_completed_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  sync_version integer not null default 1
);

create or replace function touch_updated_at_and_sync_version()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.sync_version = coalesce(old.sync_version, 0) + 1;
  return new;
end;
$$;

drop trigger if exists categories_touch on categories;
create trigger categories_touch before update on categories
for each row execute function touch_updated_at_and_sync_version();

drop trigger if exists task_templates_touch on task_templates;
create trigger task_templates_touch before update on task_templates
for each row execute function touch_updated_at_and_sync_version();

drop trigger if exists task_occurrences_touch on task_occurrences;
create trigger task_occurrences_touch before update on task_occurrences
for each row execute function touch_updated_at_and_sync_version();

drop trigger if exists timer_sessions_touch on timer_sessions;
create trigger timer_sessions_touch before update on timer_sessions
for each row execute function touch_updated_at_and_sync_version();

drop trigger if exists reminders_touch on reminders;
create trigger reminders_touch before update on reminders
for each row execute function touch_updated_at_and_sync_version();

drop trigger if exists settings_touch on settings;
create trigger settings_touch before update on settings
for each row execute function touch_updated_at_and_sync_version();

drop trigger if exists streaks_touch on streaks;
create trigger streaks_touch before update on streaks
for each row execute function touch_updated_at_and_sync_version();

insert into categories (id, owner_id, name, icon_path, is_system, color_hex)
values
  ('00000000-0000-0000-0000-000000000001', null, 'Work', '💼', true, '#2196F3'),
  ('00000000-0000-0000-0000-000000000002', null, 'Personal', '🏠', true, '#9C27B0'),
  ('00000000-0000-0000-0000-000000000003', null, 'Study', '📚', true, '#FF9800'),
  ('00000000-0000-0000-0000-000000000004', null, 'Health', '💪', true, '#4CAF50'),
  ('00000000-0000-0000-0000-000000000005', null, 'Life', '🌿', true, '#F44336'),
  ('00000000-0000-0000-0000-000000000006', null, 'Others', '✨', true, '#9E9E9E')
on conflict (id) do nothing;

alter table categories enable row level security;
alter table task_templates enable row level security;
alter table task_occurrences enable row level security;
alter table timer_sessions enable row level security;
alter table reminders enable row level security;
alter table settings enable row level security;
alter table streaks enable row level security;

alter table categories force row level security;
alter table task_templates force row level security;
alter table task_occurrences force row level security;
alter table timer_sessions force row level security;
alter table reminders force row level security;
alter table settings force row level security;
alter table streaks force row level security;

drop policy if exists categories_select on categories;
create policy categories_select
on categories
for select
using (deleted_at is null and (is_system = true or owner_id = auth.uid()));

drop policy if exists categories_insert on categories;
create policy categories_insert
on categories
for insert
with check (owner_id = auth.uid() and is_system = false);

drop policy if exists categories_update on categories;
create policy categories_update
on categories
for update
using (owner_id = auth.uid() and is_system = false)
with check (owner_id = auth.uid() and is_system = false);

drop policy if exists categories_delete on categories;
create policy categories_delete
on categories
for delete
using (owner_id = auth.uid() and is_system = false);

drop policy if exists task_templates_select on task_templates;
create policy task_templates_select
on task_templates
for select
using (deleted_at is null and owner_id = auth.uid());

drop policy if exists task_templates_insert on task_templates;
create policy task_templates_insert
on task_templates
for insert
with check (owner_id = auth.uid());

drop policy if exists task_templates_update on task_templates;
create policy task_templates_update
on task_templates
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists task_templates_delete on task_templates;
create policy task_templates_delete
on task_templates
for delete
using (owner_id = auth.uid());

drop policy if exists task_occurrences_select on task_occurrences;
create policy task_occurrences_select
on task_occurrences
for select
using (deleted_at is null and owner_id = auth.uid());

drop policy if exists task_occurrences_insert on task_occurrences;
create policy task_occurrences_insert
on task_occurrences
for insert
with check (owner_id = auth.uid());

drop policy if exists task_occurrences_update on task_occurrences;
create policy task_occurrences_update
on task_occurrences
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists task_occurrences_delete on task_occurrences;
create policy task_occurrences_delete
on task_occurrences
for delete
using (owner_id = auth.uid());

drop policy if exists timer_sessions_select on timer_sessions;
create policy timer_sessions_select
on timer_sessions
for select
using (deleted_at is null and owner_id = auth.uid());

drop policy if exists timer_sessions_insert on timer_sessions;
create policy timer_sessions_insert
on timer_sessions
for insert
with check (owner_id = auth.uid());

drop policy if exists timer_sessions_update on timer_sessions;
create policy timer_sessions_update
on timer_sessions
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists timer_sessions_delete on timer_sessions;
create policy timer_sessions_delete
on timer_sessions
for delete
using (owner_id = auth.uid());

drop policy if exists reminders_select on reminders;
create policy reminders_select
on reminders
for select
using (deleted_at is null and owner_id = auth.uid());

drop policy if exists reminders_insert on reminders;
create policy reminders_insert
on reminders
for insert
with check (owner_id = auth.uid());

drop policy if exists reminders_update on reminders;
create policy reminders_update
on reminders
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists reminders_delete on reminders;
create policy reminders_delete
on reminders
for delete
using (owner_id = auth.uid());

drop policy if exists settings_select on settings;
create policy settings_select
on settings
for select
using (deleted_at is null and owner_id = auth.uid());

drop policy if exists settings_insert on settings;
create policy settings_insert
on settings
for insert
with check (owner_id = auth.uid());

drop policy if exists settings_update on settings;
create policy settings_update
on settings
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists settings_delete on settings;
create policy settings_delete
on settings
for delete
using (owner_id = auth.uid());

drop policy if exists streaks_select on streaks;
create policy streaks_select
on streaks
for select
using (deleted_at is null and owner_id = auth.uid());

drop policy if exists streaks_insert on streaks;
create policy streaks_insert
on streaks
for insert
with check (owner_id = auth.uid());

drop policy if exists streaks_update on streaks;
create policy streaks_update
on streaks
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists streaks_delete on streaks;
create policy streaks_delete
on streaks
for delete
using (owner_id = auth.uid());

create or replace function public.enable_row_level_security_for_new_tables()
returns event_trigger
language plpgsql
as $$
declare
  obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
  loop
    if obj.schema_name = 'public' and obj.object_type = 'table' then
      execute format('alter table %s enable row level security', obj.object_identity);
      execute format('alter table %s force row level security', obj.object_identity);
    end if;
  end loop;
end;
$$;

drop event trigger if exists auto_enable_public_rls;
create event trigger auto_enable_public_rls
on ddl_command_end
when tag in ('CREATE TABLE')
execute function public.enable_row_level_security_for_new_tables();
