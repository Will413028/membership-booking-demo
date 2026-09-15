-- Standalone PostgREST harness helper; intentionally outside supabase/tests so
-- `supabase test db` does not discover it. Apply only after retaining the
-- booking_invariants.sql fixtures in a task-owned disposable database.
insert into public.memberships(id,user_id,plan_id,status,credits_total,credits_remaining,current_period_start,current_period_end)
values
 ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',2,0,now()-interval '1 day',now()+interval '60 days'),
 ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',2,1,now()-interval '1 day',now()+interval '10 days'),
 ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active',null,null,now()-interval '1 day',now()+interval '20 days'),
 ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000002','active',null,null,now()-interval '1 day',now()+interval '20 days');
