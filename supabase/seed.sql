-- Stripe Price IDs are intentionally null in local seed data. Configure them per environment.
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
select id, '2030-01-07 09:00:00+08'::timestamptz, '2030-01-07 10:00:00+08'::timestamptz, 10, true from public.classes where name = 'Morning Flow Yoga'
union all
select id, '2030-01-08 18:30:00+08'::timestamptz, '2030-01-08 19:30:00+08'::timestamptz, 12, true from public.classes where name = 'Power Vinyasa'
union all
select id, '2030-01-09 10:00:00+08'::timestamptz, '2030-01-09 10:50:00+08'::timestamptz, 8, true from public.classes where name = 'Reformer Foundations'
union all
select id, '2030-01-10 19:00:00+08'::timestamptz, '2030-01-10 19:50:00+08'::timestamptz, 10, true from public.classes where name = 'Core Pilates'
union all
select id, '2030-01-11 11:00:00+08'::timestamptz, '2030-01-11 11:45:00+08'::timestamptz, 9, true from public.classes where name = 'Mobility Reset'
union all
select id, '2030-01-12 18:00:00+08'::timestamptz, '2030-01-12 19:00:00+08'::timestamptz, 12, true from public.classes where name = 'Evening Stretch'
union all
select id, '2030-01-14 09:00:00+08'::timestamptz, '2030-01-14 10:00:00+08'::timestamptz, 10, true from public.classes where name = 'Morning Flow Yoga'
union all
select id, '2030-01-15 18:30:00+08'::timestamptz, '2030-01-15 19:30:00+08'::timestamptz, 12, true from public.classes where name = 'Power Vinyasa'
union all
select id, '2030-01-16 10:00:00+08'::timestamptz, '2030-01-16 10:50:00+08'::timestamptz, 8, true from public.classes where name = 'Reformer Foundations'
union all
select id, '2030-01-17 19:00:00+08'::timestamptz, '2030-01-17 19:50:00+08'::timestamptz, 10, true from public.classes where name = 'Core Pilates'
union all
select id, '2030-01-18 11:00:00+08'::timestamptz, '2030-01-18 11:45:00+08'::timestamptz, 9, true from public.classes where name = 'Mobility Reset'
union all
select id, '2030-01-19 18:00:00+08'::timestamptz, '2030-01-19 19:00:00+08'::timestamptz, 12, true from public.classes where name = 'Evening Stretch';
