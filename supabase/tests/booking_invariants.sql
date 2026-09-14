begin;

select plan(4);
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'class_sessions', 'class_sessions exists');
select has_table('public', 'bookings', 'bookings exists');
select has_function('public', 'book_session', array['uuid', 'uuid'], 'atomic booking RPC exists');
select * from finish();

rollback;
