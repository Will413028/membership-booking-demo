begin;

select plan(16);
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
select has_column('public', 'payments', 'amount_twd_cents', 'payments retain an integer TWD snapshot');
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

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'task-2-pgtap@example.com',
  '',
  now()
);

insert into public.profiles (id, full_name)
values ('00000000-0000-0000-0000-000000000001', 'Task 2 pgTAP Member');

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

insert into public.classes (id, name, category, level, instructor_name)
values (
  '00000000-0000-0000-0000-000000000003',
  'pgTAP Class',
  'Test',
  'All levels',
  'Test Instructor'
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
select * from finish();

rollback;
