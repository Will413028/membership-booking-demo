-- Stripe Price IDs are intentionally null in local seed data. Configure them per environment.
-- Session times are relative to the seed time so reset data remains visible as future sessions.
insert into public.plans (code, name, billing_type, class_credits, amount_twd_cents, active)
values
  ('starter-monthly', 'Starter 8', 'subscription', 8, 288000, true),
  ('unlimited-monthly', 'Unlimited', 'subscription', null, 468000, true),
  ('single-class', 'Single Class', 'one_time', 1, 68000, true);

insert into public.classes (name, category, level, description, duration_minutes, instructor_name, active)
values
  ('Morning Flow Yoga', 'Yoga', 'Beginner', 'A calm morning flow for all bodies.', 60, 'Mia Chen', true),
  ('Power Vinyasa', 'Yoga', 'Intermediate', 'A dynamic, strength-building vinyasa practice.', 60, 'Mia Chen', true),
  ('Reformer Foundations', 'Pilates', 'Beginner', 'Learn foundational reformer movements.', 50, 'Leo Wang', true),
  ('Core Pilates', 'Pilates', 'Intermediate', 'Focused core stability and control.', 50, 'Leo Wang', true),
  ('Mobility Reset', 'Mobility', 'All levels', 'Restore range of motion with guided mobility work.', 45, 'Iris Lin', true),
  ('Evening Stretch', 'Yoga', 'All levels', 'A slower class to unwind at the end of the day.', 60, 'Iris Lin', true);

insert into public.class_sessions (class_id, starts_at, ends_at, capacity, active)
select id, now() + interval '7 days', now() + interval '7 days 1 hour', 10, true from public.classes where name = 'Morning Flow Yoga'
union all
select id, now() + interval '8 days 9 hours', now() + interval '8 days 10 hours', 12, true from public.classes where name = 'Power Vinyasa'
union all
select id, now() + interval '9 days', now() + interval '9 days 50 minutes', 8, true from public.classes where name = 'Reformer Foundations'
union all
select id, now() + interval '10 days 9 hours', now() + interval '10 days 9 hours 50 minutes', 10, true from public.classes where name = 'Core Pilates'
union all
select id, now() + interval '11 days', now() + interval '11 days 45 minutes', 9, true from public.classes where name = 'Mobility Reset'
union all
select id, now() + interval '12 days 6 hours', now() + interval '12 days 7 hours', 12, true from public.classes where name = 'Evening Stretch'
union all
select id, now() + interval '14 days', now() + interval '14 days 1 hour', 10, true from public.classes where name = 'Morning Flow Yoga'
union all
select id, now() + interval '15 days 9 hours', now() + interval '15 days 10 hours', 12, true from public.classes where name = 'Power Vinyasa'
union all
select id, now() + interval '16 days', now() + interval '16 days 50 minutes', 8, true from public.classes where name = 'Reformer Foundations'
union all
select id, now() + interval '17 days 9 hours', now() + interval '17 days 9 hours 50 minutes', 10, true from public.classes where name = 'Core Pilates'
union all
select id, now() + interval '18 days', now() + interval '18 days 45 minutes', 9, true from public.classes where name = 'Mobility Reset'
union all
select id, now() + interval '19 days 6 hours', now() + interval '19 days 7 hours', 12, true from public.classes where name = 'Evening Stretch';
