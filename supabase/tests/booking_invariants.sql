begin;

select plan(10);
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'class_sessions', 'class_sessions exists');
select has_table('public', 'bookings', 'bookings exists');
select has_function('public', 'book_session', array['uuid', 'uuid'], 'atomic booking RPC exists');
select has_function(
  'public',
  'apply_stripe_event',
  array['text', 'text', 'uuid', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone', 'text'],
  'Stripe event RPC has the approved signature'
);
select has_column('public', 'payments', 'amount_twd_cents', 'payments retain an integer TWD snapshot');

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
select * from finish();

rollback;
