begin;

select no_plan();
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'class_sessions', 'class_sessions exists');
select has_table('public', 'bookings', 'bookings exists');
select has_function('public', 'book_session', array['uuid', 'uuid'], 'atomic booking RPC exists');
select has_function('public', 'cancel_booking', array['uuid'], 'atomic cancellation RPC exists');
select has_function('public', 'has_role', array['text'], 'non-recursive role helper exists');
select has_function(
  'public',
  'apply_stripe_event',
  array['text', 'text', 'uuid', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone', 'text'],
  'Stripe event RPC has the approved signature'
);
select col_type_is(
  'public',
  'payments',
  'amount_twd_cents',
  'integer',
  'payments amount snapshot uses integer cents'
);

insert into public.stripe_events (provider_event_id, event_type)
values ('evt_duplicate_is_noop', 'seeded');

select is(
  public.apply_stripe_event(
    'evt_duplicate_is_noop',
    'unsupported.event',
    gen_random_uuid(),
    null,
    null,
    null,
    null,
    null
  ),
  false,
  'a duplicate Stripe event returns without a state transition'
);
select is(
  (select count(*) from public.stripe_events where provider_event_id = 'evt_duplicate_is_noop'),
  1::bigint,
  'a duplicate Stripe event does not add another ledger row'
);

select throws_ok(
  $$
    select public.apply_stripe_event(
      'evt_missing_order_rolls_back',
      'checkout.session.completed',
      gen_random_uuid(),
      'cus_test',
      null,
      '2030-01-01T00:00:00Z'::timestamptz,
      '2030-02-01T00:00:00Z'::timestamptz,
      'pi_test'
    )
  $$,
  'P0001',
  'ORDER_NOT_FOUND',
  'a failed Stripe transition raises its domain error'
);
select is(
  (select count(*) from public.stripe_events where provider_event_id = 'evt_missing_order_rolls_back'),
  0::bigint,
  'a failed Stripe transition rolls back its ledger insertion'
);

insert into auth.users (id, aud, role, email, encrypted_password)
values (
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'task-2-pgtap@example.com',
  ''
);

select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'member', 'normal auth insertion creates a member profile');

insert into public.plans (
  id,
  code,
  name,
  billing_type,
  class_credits,
  amount_twd_cents,
  active
) values (
  '00000000-0000-0000-0000-000000000002',
  'pgtest-finite',
  'pgTAP Finite Credits',
  'one_time',
  2,
  100,
  true
);

insert into public.classes (id, name, category, level, instructor_name, duration_minutes)
values (
  '00000000-0000-0000-0000-000000000003',
  'pgTAP Class',
  'Test',
  'All levels',
  'Test Instructor', 60
);

insert into public.class_sessions (
  id,
  class_id,
  starts_at,
  ends_at,
  capacity
) values (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000003',
  now() + interval '1 day',
  now() + interval '1 day 1 hour',
  8
);

insert into public.memberships (
  id,
  user_id,
  plan_id,
  status,
  credits_total,
  credits_remaining,
  current_period_start,
  current_period_end
) values (
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'active',
  2,
  2,
  now() - interval '1 hour',
  now() + interval '1 day'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

select is(
  (
    select credits_remaining
      from public.book_session(
        '00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000005'
      )
  ),
  1,
  'finite booking decrements credits by one'
);
select is(
  (
    select credits_remaining
      from public.memberships
     where id = '00000000-0000-0000-0000-000000000005'
  ),
  1,
  'finite booking persists the one-credit decrement'
);
select is(
  (
    select credits_remaining
      from public.cancel_booking(
        (
          select id
            from public.bookings
           where user_id = '00000000-0000-0000-0000-000000000001'
             and session_id = '00000000-0000-0000-0000-000000000004'
             and status = 'confirmed'
        )
      )
  ),
  2,
  'cancelling a finite booking restores one credit'
);
select ok(
  (
    select credits_remaining <= credits_total
      from public.memberships
     where id = '00000000-0000-0000-0000-000000000005'
  ),
  'finite credits never exceed the membership total'
);
-- Role switching exercises RLS at runtime, not only catalog metadata.
insert into auth.users(id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000011', '{"role":"admin","full_name":"Untrusted"}'),
  ('00000000-0000-0000-0000-000000000012', '{}');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-000000000011'),
  'member', 'signup metadata cannot choose admin');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000012';
select ok(not has_function_privilege('anon', 'public.apply_stripe_event(text,text,uuid,text,text,timestamptz,timestamptz,text)', 'EXECUTE'), 'anon cannot execute legacy Stripe RPC');
select ok(not has_function_privilege('authenticated', 'public.apply_stripe_event(text,text,uuid,text,text,timestamptz,timestamptz,text)', 'EXECUTE'), 'authenticated cannot execute legacy Stripe RPC');
select ok(not has_function_privilege('anon', 'public.apply_stripe_event_v2(text,text,uuid,text,text,timestamptz,timestamptz,text,timestamptz,public.membership_status,text)', 'EXECUTE'), 'anon cannot execute v2');
select ok(not has_function_privilege('authenticated', 'public.apply_stripe_event_v2(text,text,uuid,text,text,timestamptz,timestamptz,text,timestamptz,public.membership_status,text)', 'EXECUTE'), 'authenticated cannot execute v2');
select ok(has_function_privilege('service_role', 'public.apply_stripe_event_v2(text,text,uuid,text,text,timestamptz,timestamptz,text,timestamptz,public.membership_status,text)', 'EXECUTE'), 'service role can execute v2');
select ok(not has_function_privilege('anon', 'public.cancel_booking(uuid)', 'EXECUTE'), 'anonymous cancellation denied');
select ok(not has_function_privilege('service_role', 'public.cancel_booking(uuid)', 'EXECUTE'), 'cancellation needs authenticated execution');
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select * from public.cancel_booking('00000000-0000-0000-0000-000000000004')$$,
  'P0001', 'UNAUTHORIZED', 'NULL auth UID is explicitly rejected even as function owner');
set local role anon;
select is((select count(*) from public.profiles), 0::bigint, 'anon cannot read profiles');
select throws_ok($$select public.apply_stripe_event('x','x',null,null,null,null,null,null)$$,
  '42501', null, 'anonymous invocation actually denied');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is((select count(*) from public.profiles), 1::bigint, 'member sees only own profile');
select throws_ok($$select public.apply_stripe_event('x','x',null,null,null,null,null,null)$$,
  '42501', null, 'member invocation actually denied');
select throws_ok($$insert into public.memberships(user_id) values(auth.uid())$$,
  '42501', null, 'member cannot mint membership via table writes');
select is((select count(*) from public.profiles where role = 'admin'), 0::bigint, 'member cannot read admin profile');
select is((select count(*) from public.book_session('00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005')), 1::bigint, 'authenticated member can book');
select throws_ok($$select * from public.book_session('00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005')$$, 'P0001', 'DUPLICATE_BOOKING', 'duplicate does not spend another credit');
reset role;
select is((select credits_remaining from public.memberships where id = '00000000-0000-0000-0000-000000000005'),
  1, 'duplicate left credits unchanged');
select ok((select membership_period_start is not null from public.bookings where status = 'confirmed'),
  'booking captures charged membership period');
update public.memberships set current_period_start = now(), current_period_end = now() + interval '30 days'
where id = '00000000-0000-0000-0000-000000000005';
select is((select credits_remaining from public.cancel_booking((select id from public.bookings where status = 'confirmed'))),
  1, 'old-period cancellation cannot refund into renewed period');
update public.classes set active = false where id = '00000000-0000-0000-0000-000000000003';
select throws_ok($$select * from public.book_session('00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005')$$, 'P0001', 'SESSION_STARTED', 'inactive parent prevents booking');
update public.classes set active = true where id = '00000000-0000-0000-0000-000000000003';
select lives_ok($$select * from public.book_session('00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005')$$, 'active parent accepts booking');
insert into public.memberships(id,user_id,plan_id,credits_total,credits_remaining,current_period_start,current_period_end)
values ('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000002',2,2,now(),now()+interval '30 days');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select lives_ok($$select * from public.book_session('00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000015')$$, 'second member books');
set local role authenticated;
select is((select count(*) from public.bookings), 1::bigint, 'second member sees only own booking');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
set local role authenticated;
select is((select count(*) from public.profiles), 3::bigint, 'admin sees operational profiles');
select is((select count(*) from public.bookings where status = 'confirmed'), 2::bigint, 'admin sees both member bookings');
select throws_ok($$update public.class_sessions set capacity = 1 where id = '00000000-0000-0000-0000-000000000004'$$,
  'P0001', 'CAPACITY_BELOW_BOOKINGS', 'admin capacity reduction below confirmed seats is rejected');
select lives_ok($$update public.class_sessions set capacity = 2 where id = '00000000-0000-0000-0000-000000000004'$$,
  'capacity equal to confirmed count is valid');
select throws_ok($$select public.apply_stripe_event('x','x',null,null,null,null,null,null)$$,
  '42501', null, 'even admin cannot execute webhook RPC');
select lives_ok($$select * from public.cancel_booking((select id from public.bookings
  where user_id = '00000000-0000-0000-0000-000000000011' and status = 'confirmed'))$$,
  'authenticated admin cancels through atomic RPC');
reset role;
select is((select count(*) from pg_constraint where conname in
 ('memberships_profile_fkey','bookings_profile_fkey','orders_profile_fkey') and contype = 'f'),
  3::bigint, 'PostgREST profile relationships are backed by real foreign keys');

insert into public.plans(id,code,name,billing_type,class_credits,amount_twd_cents)
values ('00000000-0000-0000-0000-000000000020','pgtap-sub','Monthly','subscription',8,288000);
insert into public.orders(id,user_id,amount_twd_cents) values
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001',288000),
 ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',100);
insert into public.order_items(order_id,plan_id,unit_amount_twd_cents) values
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000020',288000),
 ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002',100);
-- A test-only helper supplies literal provider timestamps and periods.
create function pg_temp.event(e text, t text, at_time timestamptz, ps timestamptz,
 pe timestamptz, state public.membership_status default null, paid text default null)
returns boolean language sql as $$
 select public.apply_stripe_event_v2(e,t,'00000000-0000-0000-0000-000000000021',
 'cus_test','sub_test',ps,pe,null,at_time,state,paid);
$$;
select lives_ok($$select pg_temp.event('unpaid','checkout.session.completed','2030-01-01',null,null,null,'unpaid')$$,
 'unpaid checkout is safely deferred');
select is((select status::text from public.orders where id = '00000000-0000-0000-0000-000000000021'), 'pending', 'unpaid order stays pending');
select is((select count(*) from public.memberships where source_order_id = '00000000-0000-0000-0000-000000000021'), 0::bigint, 'unpaid grants nothing');
select lives_ok($$select pg_temp.event('early_status','customer.subscription.updated','2030-01-01',null,null,'past_due')$$,
 'status before initial invoice is retained without granting');
select is((select count(*) from public.stripe_events where provider_event_id = 'early_status'),1::bigint,'early adverse event is recorded atomically');
select lives_ok($$select pg_temp.event('initial','invoice.paid','2030-01-01','2030-01-01','2030-02-01',null,'paid')$$,
 'initial invoice can arrive before checkout');
update public.memberships set credits_remaining = 5 where stripe_subscription_id = 'sub_test';
select lives_ok($$select pg_temp.event('checkout_late','checkout.session.completed','2030-01-01',null,null,null,'paid')$$,
 'later checkout is a no-op for the already paid order');
select lives_ok($$select pg_temp.event('same_invoice_other_event','invoice.paid','2030-01-02','2030-01-01','2030-02-01',null,'paid')$$,
 'same paid period under another event is accepted without resetting credits');
select is((select credits_remaining from public.memberships where stripe_subscription_id = 'sub_test'),5,'initial invoice retry preserves spent credits');
select is((select count(*) from public.memberships where source_order_id = '00000000-0000-0000-0000-000000000021'),1::bigint,'one membership per order');
select lives_ok($$select pg_temp.event('renew','invoice.paid','2030-02-01','2030-02-01','2030-03-01',null,'paid')$$,'new paid period resets credits');
select is((select credits_remaining from public.memberships where stripe_subscription_id = 'sub_test'),8,'renewal gives eight credits');
update public.memberships set credits_remaining = 4 where stripe_subscription_id = 'sub_test';
select is(pg_temp.event('renew','invoice.paid','2030-02-01','2030-02-01','2030-03-01',null,'paid'),false,'event ID retry is a no-op');
select lives_ok($$select pg_temp.event('old_invoice','invoice.paid','2030-02-02','2030-01-01','2030-02-01',null,'paid')$$,'late old-period invoice is ignored');
select is((select credits_remaining from public.memberships where stripe_subscription_id = 'sub_test'),4,'old invoice does not reset current credits');
select lives_ok($$select pg_temp.event('failed','invoice.payment_failed','2030-03-01','2030-03-01','2030-04-01')$$,'failed renewal marks past_due');
select lives_ok($$select pg_temp.event('stale_active','customer.subscription.updated','2030-02-20',null,null,'active')$$,'stale active update ignored');
select lives_ok($$select pg_temp.event('tie_active','customer.subscription.updated','2030-03-01',null,null,'active')$$,'same-second active update loses to failure');
select lives_ok($$select pg_temp.event('late_paid','invoice.paid','2030-02-28','2030-02-01','2030-03-01',null,'paid')$$,'older paid event cannot override failure');
select is((select status::text from public.memberships where stripe_subscription_id = 'sub_test'),'past_due','out-of-order events cannot reactivate past_due');
select lives_ok($$select pg_temp.event('old_period_paid_later','invoice.paid','2030-03-01 12:00:00','2030-02-01','2030-03-01',null,'paid')$$,
 'older invoice period is ignored even if payment event was created after the new-period failure');
select is((select status::text from public.memberships where stripe_subscription_id = 'sub_test'),'past_due',
 'paying an old invoice cannot clear a newer failed invoice');
select lives_ok($$select pg_temp.event('recovered','invoice.paid','2030-03-02','2030-03-01','2030-04-01',null,'paid')$$,'later successful renewal recovers access');
select is((select status::text from public.memberships where stripe_subscription_id = 'sub_test'),'active','new paid period is active');
select lives_ok($$select pg_temp.event('unpaid_status','customer.subscription.updated','2030-03-03',null,null,'past_due')$$,'mapped unpaid status revokes access');
select lives_ok($$select pg_temp.event('deleted','customer.subscription.deleted','2030-03-04',null,null,'canceled')$$,'subscription deletion cancels membership');
select lives_ok($$select pg_temp.event('after_cancel','invoice.paid','2030-04-01','2030-04-01','2030-05-01',null,'paid')$$,'canceled subscription cannot be reactivated by invoice');
select is((select status::text from public.memberships where stripe_subscription_id = 'sub_test'),'canceled','cancellation terminal');
select lives_ok($$select public.apply_stripe_event_v2('single_1','checkout.session.completed',
 '00000000-0000-0000-0000-000000000022',null,null,'2030-01-01','2030-01-31','pi_single','2030-01-01',null,'paid')$$,'one-time paid checkout grants membership');
update public.memberships set credits_remaining = 1 where source_order_id = '00000000-0000-0000-0000-000000000022';
select lives_ok($$select public.apply_stripe_event_v2('single_2','checkout.session.completed',
 '00000000-0000-0000-0000-000000000022',null,null,'2030-01-01','2030-01-31','pi_single','2030-01-02',null,'paid')$$,'same one-time order under another event is idempotent');
select is((select count(*) from public.memberships where source_order_id = '00000000-0000-0000-0000-000000000022'),1::bigint,'one-time grants only once');
select is((select credits_remaining from public.memberships where source_order_id = '00000000-0000-0000-0000-000000000022'),1,'repeat one-time checkout preserves credits');
select throws_ok($$insert into public.memberships(user_id,plan_id,source_order_id,current_period_start,current_period_end)
 values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
 '00000000-0000-0000-0000-000000000022','2030-01-01','2030-01-31')$$,
 '23505',null,'database uniqueness independently prevents duplicate order grant');
insert into public.orders(id,user_id,amount_twd_cents)
values ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000001',288000);
insert into public.order_items(order_id,plan_id,unit_amount_twd_cents)
values ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000020',288000);
select lives_ok($$select public.apply_stripe_event_v2('early_deleted','customer.subscription.deleted',
 '00000000-0000-0000-0000-000000000023',null,'sub_early',null,null,null,'2030-01-02','canceled',null)$$,
 'deletion before any paid invoice is retained');
select is((select count(*) from public.memberships where source_order_id = '00000000-0000-0000-0000-000000000023'),
 0::bigint,'early subscription status cannot create a membership');
select lives_ok($$select public.apply_stripe_event_v2('delayed_initial_invoice','invoice.paid',
 '00000000-0000-0000-0000-000000000023',null,'sub_early','2030-01-01','2030-02-01',null,'2030-01-01',null,'paid')$$,
 'initial invoice after deletion records payment without restoring access');
select is((select status::text from public.memberships where stripe_subscription_id = 'sub_early'),
 'canceled','early terminal cancellation survives late first invoice');
select is((select status::text from public.orders where id = '00000000-0000-0000-0000-000000000023'),
 'paid','purchase history still records actual payment');
select throws_ok($$update public.bookings set membership_period_end = null where membership_period_start is not null$$,
 '23514', null, 'booking period cannot be half-null');
select throws_ok($$select public.apply_stripe_event('new_legacy','invoice.paid',
 '00000000-0000-0000-0000-000000000023',null,'sub_early','2030-01-01','2030-02-01',null)$$,
 'P0001','STRIPE_EVENT_CONTEXT_REQUIRED','legacy contract fails closed for new transitions lacking evidence');
select * from finish();

rollback;
