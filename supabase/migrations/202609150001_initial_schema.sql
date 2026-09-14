create type public.app_role as enum ('member', 'admin');
create type public.membership_status as enum ('active', 'past_due', 'canceled', 'expired');
create type public.booking_status as enum ('confirmed', 'cancelled');
create type public.order_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded');
create type public.billing_type as enum ('subscription', 'one_time');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  billing_type public.billing_type not null,
  stripe_price_id text,
  class_credits integer,
  amount_twd_cents integer not null check (amount_twd_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (class_credits is null or class_credits > 0),
  check (
    (billing_type = 'subscription' and class_credits is null or class_credits > 0)
    or (billing_type = 'one_time' and class_credits is not null)
  )
);

create unique index plans_stripe_price_id_unique
  on public.plans (stripe_price_id)
  where stripe_price_id is not null;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.membership_status not null default 'active',
  credits_total integer,
  credits_remaining integer,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start),
  check (
    (credits_total is null and credits_remaining is null)
    or (
      credits_total is not null
      and credits_remaining is not null
      and credits_total >= 0
      and credits_remaining >= 0
      and credits_remaining <= credits_total
    )
  )
);

create unique index memberships_stripe_subscription_id_unique
  on public.memberships (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  level text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes > 0),
  instructor_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index class_sessions_public_schedule_idx
  on public.class_sessions (starts_at)
  where active = true;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  status public.order_status not null default 'pending',
  amount_twd_cents integer not null check (amount_twd_cents >= 0),
  currency text not null default 'twd' check (currency = 'twd'),
  stripe_checkout_session_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_twd_cents integer not null check (unit_amount_twd_cents >= 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  status public.order_status not null default 'pending',
  amount_twd_cents integer not null check (amount_twd_cents >= 0),
  provider_payment_reference text unique,
  provider_subscription_id text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null,
  event_type text not null,
  order_id uuid references public.orders (id) on delete set null,
  processed_at timestamptz not null default now()
);

create unique index stripe_events_provider_id
  on public.stripe_events (provider_event_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.class_sessions (id) on delete restrict,
  membership_id uuid not null references public.memberships (id) on delete restrict,
  status public.booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (
    (status = 'confirmed' and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null)
  )
);

create unique index bookings_one_active_per_user
  on public.bookings (user_id, session_id)
  where status = 'confirmed';

create view public.session_confirmed_booking_counts
with (security_invoker = false)
as
  select
    sessions.id as session_id,
    count(bookings.id) as confirmed_count
  from public.class_sessions as sessions
  inner join public.classes
    on classes.id = sessions.class_id
  left join public.bookings
    on bookings.session_id = sessions.id
   and bookings.status = 'confirmed'
  where sessions.active = true
    and sessions.starts_at > now()
    and classes.active = true
  group by sessions.id;

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and role = required_role::public.app_role
  );
$$;

create or replace function public.book_session(
  p_session_id uuid,
  p_membership_id uuid
)
returns table (booking_id uuid, credits_remaining integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  locked_session public.class_sessions%rowtype;
  locked_membership public.memberships%rowtype;
  new_booking_id uuid;
begin
  select * into locked_session
    from public.class_sessions
   where id = p_session_id and active = true
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_STARTED';
  end if;

  if locked_session.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'SESSION_STARTED';
  end if;

  select * into locked_membership
    from public.memberships
   where id = p_membership_id and user_id = auth.uid()
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if locked_membership.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_INACTIVE';
  end if;

  if locked_membership.current_period_end <= now() then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_INACTIVE';
  end if;

  if exists (
    select 1
      from public.bookings
     where user_id = auth.uid()
       and session_id = p_session_id
       and status = 'confirmed'
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_BOOKING';
  end if;

  if (
    select count(*)
      from public.bookings
     where session_id = p_session_id and status = 'confirmed'
  ) >= locked_session.capacity then
    raise exception using errcode = 'P0001', message = 'SESSION_FULL';
  end if;

  if locked_membership.credits_remaining is not null
     and locked_membership.credits_remaining <= 0 then
    raise exception using errcode = 'P0001', message = 'CREDITS_INSUFFICIENT';
  end if;

  insert into public.bookings (user_id, session_id, membership_id)
  values (auth.uid(), p_session_id, p_membership_id)
  returning id into new_booking_id;

  if locked_membership.credits_remaining is not null then
    update public.memberships as m
       set credits_remaining = m.credits_remaining - 1,
           updated_at = now()
     where m.id = locked_membership.id
     returning m.credits_remaining into credits_remaining;
  else
    credits_remaining := null;
  end if;

  booking_id := new_booking_id;
  return next;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns table (booking_id uuid, credits_remaining integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  locked_booking public.bookings%rowtype;
  locked_session public.class_sessions%rowtype;
  locked_membership public.memberships%rowtype;
begin
  select * into locked_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;

  if locked_booking.user_id <> auth.uid() and not public.has_role('admin') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if locked_booking.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'BOOKING_CANCELLED';
  end if;

  select * into locked_session
    from public.class_sessions
   where id = locked_booking.session_id
   for update;

  if locked_session.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'SESSION_STARTED';
  end if;

  select * into locked_membership
    from public.memberships
   where id = locked_booking.membership_id
   for update;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now()
   where id = locked_booking.id;

  if locked_membership.credits_remaining is not null then
    update public.memberships as m
       set credits_remaining = least(m.credits_total, m.credits_remaining + 1),
           updated_at = now()
     where m.id = locked_membership.id
     returning m.credits_remaining into credits_remaining;
  else
    credits_remaining := null;
  end if;

  booking_id := locked_booking.id;
  return next;
end;
$$;

create or replace function public.apply_stripe_event(
  p_provider_event_id text,
  p_event_type text,
  p_order_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_payment_reference text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_order public.orders%rowtype;
  target_item public.order_items%rowtype;
  target_plan public.plans%rowtype;
begin
  insert into public.stripe_events (provider_event_id, event_type, order_id)
  values (p_provider_event_id, p_event_type, p_order_id)
  on conflict (provider_event_id) do nothing;

  if not found then
    return false;
  end if;

  if p_event_type = 'checkout.session.completed' then
    select * into target_order
      from public.orders
     where id = p_order_id
     for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
    end if;

    select * into target_item
      from public.order_items
     where order_id = target_order.id
     order by created_at
     limit 1;

    if not found then
      raise exception using errcode = 'P0001', message = 'ORDER_ITEM_NOT_FOUND';
    end if;

    select * into target_plan
      from public.plans
     where id = target_item.plan_id;

    if not found or p_period_start is null or p_period_end is null then
      raise exception using errcode = 'P0001', message = 'MEMBERSHIP_PERIOD_REQUIRED';
    end if;

    update public.orders
       set status = 'paid',
           updated_at = now()
     where id = target_order.id;

    insert into public.memberships (
      user_id,
      plan_id,
      status,
      credits_total,
      credits_remaining,
      stripe_customer_id,
      stripe_subscription_id,
      current_period_start,
      current_period_end
    ) values (
      target_order.user_id,
      target_plan.id,
      'active',
      target_plan.class_credits,
      target_plan.class_credits,
      p_customer_id,
      p_subscription_id,
      p_period_start,
      p_period_end
    );

    insert into public.payments (
      order_id,
      status,
      amount_twd_cents,
      provider_payment_reference,
      provider_subscription_id,
      processed_at
    ) values (
      target_order.id,
      'paid',
      target_order.amount_twd_cents,
      p_payment_reference,
      p_subscription_id,
      now()
    ) on conflict (order_id) do update
      set status = 'paid',
          provider_payment_reference = excluded.provider_payment_reference,
          provider_subscription_id = excluded.provider_subscription_id,
          processed_at = excluded.processed_at,
          updated_at = now();

  elsif p_event_type = 'invoice.paid' then
    update public.memberships
       set status = 'active',
           credits_remaining = credits_total,
           current_period_start = p_period_start,
           current_period_end = p_period_end,
           updated_at = now()
     where stripe_subscription_id = p_subscription_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
    end if;

    update public.payments
       set status = 'paid',
           provider_payment_reference = coalesce(p_payment_reference, provider_payment_reference),
           processed_at = now(),
           updated_at = now()
     where order_id = p_order_id;

  elsif p_event_type = 'invoice.payment_failed' then
    update public.memberships
       set status = 'past_due',
           updated_at = now()
     where stripe_subscription_id = p_subscription_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
    end if;

    update public.payments
       set status = 'failed',
           provider_payment_reference = coalesce(p_payment_reference, provider_payment_reference),
           processed_at = now(),
           updated_at = now()
     where order_id = p_order_id;

  elsif p_event_type = 'customer.subscription.updated' then
    update public.memberships
       set status = 'active',
           current_period_start = p_period_start,
           current_period_end = p_period_end,
           updated_at = now()
     where stripe_subscription_id = p_subscription_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
    end if;

  elsif p_event_type = 'customer.subscription.deleted' then
    update public.memberships
       set status = 'canceled',
           updated_at = now()
     where stripe_subscription_id = p_subscription_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'MEMBERSHIP_NOT_FOUND';
    end if;

  else
    raise exception using errcode = 'P0001', message = 'UNSUPPORTED_STRIPE_EVENT';
  end if;

  return true;
end;
$$;

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.memberships enable row level security;
alter table public.classes enable row level security;
alter table public.class_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_events enable row level security;
alter table public.bookings enable row level security;

create policy "members read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "admins manage profiles" on public.profiles
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "public reads active plans" on public.plans
  for select to anon, authenticated using (active = true);
create policy "admins manage plans" on public.plans
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "members read own memberships" on public.memberships
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "admins manage memberships" on public.memberships
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "public reads active classes" on public.classes
  for select to anon, authenticated using (active = true);
create policy "admins manage classes" on public.classes
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "public reads future active sessions" on public.class_sessions
  for select to anon, authenticated using (
    active = true
    and starts_at > now()
    and exists (
      select 1 from public.classes
       where classes.id = class_sessions.class_id and classes.active = true
    )
  );
create policy "admins manage class sessions" on public.class_sessions
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "members read own orders" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "admins manage orders" on public.orders
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "members read own order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders
       where orders.id = order_items.order_id
         and orders.user_id = (select auth.uid())
    )
  );
create policy "admins manage order items" on public.order_items
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "members read own payments" on public.payments
  for select to authenticated using (
    exists (
      select 1 from public.orders
       where orders.id = payments.order_id
         and orders.user_id = (select auth.uid())
    )
  );
create policy "admins manage payments" on public.payments
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "admins manage stripe events" on public.stripe_events
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "members read own bookings" on public.bookings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "admins manage bookings" on public.bookings
  for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

revoke all on function public.has_role(text) from public;
revoke all on function public.book_session(uuid, uuid) from public;
revoke all on function public.cancel_booking(uuid) from public;
revoke all on function public.apply_stripe_event(text, text, uuid, text, text, timestamptz, timestamptz, text) from public;
revoke all on table public.session_confirmed_booking_counts from public;

grant execute on function public.has_role(text) to authenticated;
grant execute on function public.book_session(uuid, uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.apply_stripe_event(text, text, uuid, text, text, timestamptz, timestamptz, text) to service_role;
grant select on table public.session_confirmed_booking_counts to anon, authenticated;
