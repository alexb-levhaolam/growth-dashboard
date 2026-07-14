-- ============================================
-- Growth Dashboard — Supabase Schema
-- Скопируй ВСЁ в SQL Editor → Run
-- ============================================

-- Profiles (linked to Supabase Auth)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text not null default '',
  role text not null default 'viewer' check (role in ('admin','editor','viewer')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, name, role)
  values (new.id, new.email, split_part(new.email, '@', 1), 'viewer');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Projects
create table if not exists projects (
  id text primary key,
  name text not null,
  owner text not null,
  priority text not null default 'current' check (priority in ('key','current')),
  status text not null default 'progress' check (status in ('done','progress','test','risk','wait','blocked')),
  last_update text default '',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Project comments
create table if not exists project_comments (
  id bigint generated always as identity primary key,
  project_id text references projects(id) on delete cascade,
  author text not null,
  full_text text not null,
  summary text not null default '',
  week_start date not null,
  created_at timestamptz default now()
);

-- Weekly reports
create table if not exists weekly_reports (
  id text primary key, -- e.g. "2026-W28"
  week_label text not null,
  week_start date not null,
  status text not null default 'yellow',
  status_note text default '',
  metrics jsonb not null default '{}',
  channels jsonb not null default '[]',
  improved text[] default '{}',
  worsened text[] default '{}',
  focus text[] default '{}',
  asks text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Team responses (from Slack bot)
create table if not exists team_responses (
  id bigint generated always as identity primary key,
  week_start date not null,
  person text not null,
  raw_text text not null default '',
  summary text not null default '',
  responded_at timestamptz default now()
);

-- ============================================
-- Row Level Security
-- ============================================
alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_comments enable row level security;
alter table weekly_reports enable row level security;
alter table team_responses enable row level security;

-- Everyone can read
create policy "read_all" on profiles for select using (true);
create policy "read_all" on projects for select using (true);
create policy "read_all" on project_comments for select using (true);
create policy "read_all" on weekly_reports for select using (true);
create policy "read_all" on team_responses for select using (true);

-- Admins and editors can insert/update
create policy "write_projects" on projects for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','editor'))
);
create policy "write_comments" on project_comments for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','editor'))
);
create policy "write_reports" on weekly_reports for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','editor'))
);
create policy "write_responses" on team_responses for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin','editor'))
);
create policy "admin_profiles" on profiles for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ============================================
-- Seed: Projects from Dashboard
-- ============================================
insert into projects (id, name, owner, priority, status, last_update, sort_order) values
  ('ST14', 'Переход 99→119 (+евро)', 'Sasha B / Ivan', 'key', 'done', 'Запущен 07.07, следим за конверсией', 1),
  ('P06-M', 'Meta стабилизация + новые креативы', 'Julia / Nikita', 'key', 'progress', 'CPO $357, креативы с Ави запущены', 2),
  ('P06-G', 'Google стабилизация', 'Julia', 'key', 'risk', 'CPO $407 — вырос после $119', 3),
  ('BA01', 'DG масштабирование + Brand Search', 'Julia / Nikita', 'key', 'progress', '96 продаж текущий факт', 4),
  ('BA02', '5 воронок по пилларам', 'Julia / Nikita / Sasha B', 'key', 'progress', 'A/B тест лендинга запущен 15.06', 5),
  ('E01', 'Onboarding flow 0-3 мес', 'Vlada / Alex E', 'key', 'test', 'Churn 5.9% vs baseline 13.3%', 6),
  ('E02', 'Active Audience lifecycle 4+', 'Vlada / Alex E / Sasha B', 'key', 'progress', 'Кампании запущены, сбор результатов', 7),
  ('ST17', 'Annual subscription (рисковые группы)', 'Sasha B / Vlada', 'key', 'wait', 'Сдвинуто из-за $119, дизайн лендингов готов', 8),
  ('checkout', 'Новый чекаут (+35% CR)', 'Sasha B', 'key', 'progress', 'Дизайн готов, в IT, дата TBD 17.07', 9),
  ('P08', 'Apple Pay / Google Pay', 'IT', 'key', 'risk', 'Рекуррент из Израиля не работает, ищут провайдера', 10),
  ('NC01', 'Новые страны (SG/UK/DE)', 'Olga / Ivan / Julia', 'key', 'wait', 'Подготовка завершена, ждём IT + Стас', 11),
  ('SEO01', 'SEO + GEO контент', 'Sasha B', 'key', 'progress', 'Бриф на 12 статей, 3 Пр.1 в производстве', 12),
  ('I365', 'Israel 365 (WhatsApp + ILTV)', 'Julia', 'key', 'progress', 'Тексты финализируются, бюджет $30K', 13),
  ('Taboola', 'Taboola Native Ads', 'Julia / Nikita', 'current', 'progress', 'Запущена 07.07 на малых бюджетах', 14),
  ('E05', 'Win-Back Email + LP', 'Vlada / Marina', 'current', 'progress', 'Лендинг в работе, задача на копи 23.06', 15),
  ('E13', 'Referral Ambassador', 'Vlada', 'current', 'wait', 'Механика готова, ждём IT', 16),
  ('S11', 'Амбассадор Ави (новый)', 'Julia / Rivki', 'current', 'progress', 'Креативы запущены в Meta и Google', 17),
  ('S03', 'Churn prevention контент', 'Dasha / Vlada', 'current', 'progress', 'План на год создан', 18),
  ('ST07', 'Deep Interviews', 'Sasha B', 'current', 'done', '46 интервью завершены, итоги подведены', 19),
  ('S02', 'SMM Growth Plan', 'Dasha', 'current', 'progress', 'Коммуникация разделена по площадкам', 20),
  ('E18', 'IsraelCart → LH Box cross-sell', 'Vlada / David G', 'current', 'wait', 'План работ на 15 июля', 21),
  ('ST09', '1st box from USA', 'Vlada / Dasha', 'current', 'test', 'Тест запущен с 1 июня', 22)
on conflict (id) do nothing;

-- ============================================
-- Seed: Weekly Reports
-- ============================================
insert into weekly_reports (id, week_label, week_start, status, status_note, metrics, channels, improved, worsened, focus, asks) values
(
  '2026-W27', '30.06 – 06.07', '2026-06-30', 'yellow',
  'Первая неделя на $119, конверсия адаптируется',
  '{"totalSales":268,"planSales":288,"cpoAds":252,"cpoCeiling":350,"budgetSpent":55891,"budgetPlan":77000}',
  '[{"name":"Meta (Nikita)","sales":65,"prevSales":56,"cpo":366,"prevCpo":403},{"name":"Google (Julia)","sales":80,"prevSales":79,"cpo":293,"prevCpo":290},{"name":"Email (Vlada)","sales":67,"prevSales":67,"cpo":0,"prevCpo":0},{"name":"Direct","sales":48,"prevSales":52,"cpo":0,"prevCpo":0},{"name":"SEO","sales":27,"prevSales":25,"cpo":0,"prevCpo":0},{"name":"SMM (Darya)","sales":8,"prevSales":8,"cpo":0,"prevCpo":0},{"name":"Influencers (Natiia)","sales":0,"prevSales":0,"cpo":null,"prevCpo":null}]',
  '{"$119 + евро запущен в срок (07.07)","CPO $252 — в рамках потолка","Email стабилен — 67 продаж","Deep interviews завершены (46 шт)","Meta CPO снизился $403→$366"}',
  '{"Объём ниже плана (268 vs 288)","TikTok: $4K потрачено, 0 продаж — остановлен","Apple Pay: рекуррент из Израиля не работает","Бюджет недовыкупается"}',
  '{"Мониторинг конверсии после $119","Старт Israel 365","Taboola на малых бюджетах","Чекаут: дата от IT"}',
  '{"Israel 365 бюджет $30K — стартуем?","Apple Pay: альтернативный провайдер?"}'
),
(
  '2026-W28', '07.07 – 13.07', '2026-07-07', 'yellow',
  'Вторая неделя $119, объём ниже плана, CPO в рамках',
  '{"totalSales":160,"planSales":200,"cpoAds":299,"cpoCeiling":350,"budgetSpent":38433,"budgetPlan":55000}',
  '[{"name":"Meta (Nikita)","sales":46,"prevSales":65,"cpo":357,"prevCpo":366},{"name":"Google (Julia)","sales":54,"prevSales":80,"cpo":407,"prevCpo":293},{"name":"Email (Vlada)","sales":15,"prevSales":67,"cpo":0,"prevCpo":0},{"name":"Direct","sales":26,"prevSales":48,"cpo":0,"prevCpo":0},{"name":"SEO","sales":14,"prevSales":27,"cpo":0,"prevCpo":0},{"name":"SMM (Darya)","sales":5,"prevSales":8,"cpo":0,"prevCpo":0},{"name":"Influencers (Natiia)","sales":0,"prevSales":0,"cpo":null,"prevCpo":null}]',
  '{"$119 работает без технических сбоев","CPO $299 — в рамках потолка $350","Meta CPO $357 — снизился с $366","Reactivation CR 0.13% — выше плана"}',
  '{"Темп 30.7/день vs нужно 40.7","Google CPO $407 — вырос с $293 ⚠️","Email: 15 за 5 дн vs 67 за 7 дн","Бюджет недовыкупается","New Channels: 0 продаж"}',
  '{"Стабилизация Google CPO","Разобраться с падением Email","Israel 365 запуск","Taboola первые результаты","Чекаут: дата от IT"}',
  '{"Israel 365 бюджет — стартуем?","Apple Pay альтернативный провайдер?"}'
)
on conflict (id) do nothing;
