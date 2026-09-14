-- Forward-only hardening. No raw Stripe payload is persisted.
create or replace function public.create_member_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 200), 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_member_profile() from public, anon, authenticated, service_role;
create trigger auth_user_member_profile after insert on auth.users
  for each row execute function public.create_member_profile();
insert into public.profiles (id, full_name, role)
select id, left(coalesce(raw_user_meta_data->>'full_name', ''), 200), 'member'
from auth.users on conflict (id) do nothing;

alter table public.memberships add constraint memberships_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.bookings add constraint bookings_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.orders add constraint orders_profile_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;
-- Keep status events arriving before the first paid invoice without granting access.
alter table public.orders
  add column stripe_pending_subscription_id text,
  add column stripe_pending_status public.membership_status,
  add column stripe_pending_state_at timestamptz,
  add column stripe_pending_state_rank integer not null default 0,
  add column stripe_pending_period_start timestamptz,
  add column stripe_pending_period_end timestamptz;

alter table public.memberships
  add column source_order_id uuid unique references public.orders(id),
  add column stripe_state_at timestamptz,
  add column stripe_state_rank integer not null default 0,
  add column stripe_invoice_period_start timestamptz,
  add column stripe_invoice_period_end timestamptz;
-- Only backfill provable subscription links; never guess a one-time purchase.
update public.memberships m set source_order_id = p.order_id
from public.payments p
where p.provider_subscription_id = m.stripe_subscription_id
  and (select count(*) from public.payments p2
       where p2.provider_subscription_id = m.stripe_subscription_id) = 1;
-- Legacy rows have no provider timestamp. Older retries must not change their state.
update public.memberships set stripe_state_at = now(), stripe_state_rank = 30,
  stripe_invoice_period_start = current_period_start, stripe_invoice_period_end = current_period_end;

alter table public.bookings
  add column membership_period_start timestamptz,
  add column membership_period_end timestamptz;
-- The current period is provable only for bookings created inside that period.
-- Unknown legacy periods remain NULL and are never refunded into a new period.
update public.bookings b
set membership_period_start = m.current_period_start,
    membership_period_end = m.current_period_end
from public.memberships m
where b.membership_id = m.id and b.created_at >= m.current_period_start
  and b.created_at < m.current_period_end;
alter table public.bookings add constraint booking_period_valid check (
  (membership_period_start is null and membership_period_end is null)
  or (membership_period_start is not null and membership_period_end is not null
      and membership_period_end > membership_period_start)
);

create or replace function public.guard_session_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- UPDATE already owns this session's row lock, shared with book_session.
  if new.capacity < (select count(*) from public.bookings
                    where session_id = new.id and status = 'confirmed') then
    raise exception using errcode = 'P0001', message = 'CAPACITY_BELOW_BOOKINGS';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_session_capacity() from public, anon, authenticated, service_role;
create trigger session_capacity_guard before update of capacity on public.class_sessions
  for each row execute function public.guard_session_capacity();

create or replace function public.book_session(p_session_id uuid, p_membership_id uuid)
returns table (booking_id uuid, credits_remaining integer)
language plpgsql security definer set search_path = ''
as $$
declare
  s public.class_sessions%rowtype;
  m public.memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found or not s.active or s.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'SESSION_STARTED';
  end if;
  -- FOR SHARE serializes against a concurrent parent deactivation.
  perform 1 from public.classes where id = s.class_id and active for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_STARTED';
  end if;
  select * into m from public.memberships
  where id = p_membership_id and user_id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  if m.status <> 'active' or m.current_period_start > now() or m.current_period_end <= now() then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_INACTIVE';
  end if;
  if exists (select 1 from public.bookings
             where user_id = auth.uid() and session_id = s.id and status = 'confirmed') then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_BOOKING';
  end if;
  if (select count(*) from public.bookings where session_id = s.id and status = 'confirmed') >= s.capacity then
    raise exception using errcode = 'P0001', message = 'SESSION_FULL';
  end if;
  if m.credits_remaining <= 0 then
    raise exception using errcode = 'P0001', message = 'CREDITS_INSUFFICIENT';
  end if;
  insert into public.bookings (user_id, session_id, membership_id, membership_period_start, membership_period_end)
  values (auth.uid(), s.id, m.id, m.current_period_start, m.current_period_end)
  returning id into booking_id;
  update public.memberships set credits_remaining = m.credits_remaining - 1, updated_at = now()
  where id = m.id returning memberships.credits_remaining into credits_remaining;
  return next;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns table (booking_id uuid, credits_remaining integer)
language plpgsql security definer set search_path = ''
as $$
declare
  b public.bookings%rowtype;
  s public.class_sessions%rowtype;
  m public.memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  select * into b from public.bookings where id = p_booking_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_FOUND';
  end if;
  if b.user_id <> auth.uid() and not public.has_role('admin') then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  -- Same lock order as booking: session, membership, booking.
  select * into s from public.class_sessions where id = b.session_id for update;
  select * into m from public.memberships where id = b.membership_id for update;
  select * into b from public.bookings where id = p_booking_id for update;
  if b.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'BOOKING_CANCELLED';
  end if;
  if s.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'SESSION_STARTED';
  end if;
  update public.bookings set status = 'cancelled', cancelled_at = now() where id = b.id;
  credits_remaining := m.credits_remaining;
  if m.credits_remaining is not null
     and b.membership_period_start = m.current_period_start
     and b.membership_period_end = m.current_period_end then
    update public.memberships set credits_remaining = least(m.credits_total, m.credits_remaining + 1),
      updated_at = now() where id = m.id
    returning memberships.credits_remaining into credits_remaining;
  end if;
  booking_id := b.id;
  return next;
end;
$$;

-- v2 adds provider ordering and payment/status evidence that the original eight
-- arguments cannot express. Both entry points are service-role-only.
create function public.apply_stripe_event_v2(
  p_provider_event_id text, p_event_type text, p_order_id uuid,
  p_customer_id text, p_subscription_id text, p_period_start timestamptz,
  p_period_end timestamptz, p_payment_reference text,
  p_event_created_at timestamptz, p_membership_status public.membership_status,
  p_payment_status text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders%rowtype;
  m public.memberships%rowtype;
  plan public.plans%rowtype;
  desired public.membership_status;
  rank integer;
  fresh boolean;
  is_checkout boolean := p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded');
begin
  if exists (select 1 from public.stripe_events where provider_event_id = p_provider_event_id) then
    return false;
  end if;
  -- Resolve before inserting the FK-backed ledger, so failures are domain errors.
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if p_event_created_at is null or p_provider_event_id is null then
    raise exception using errcode = 'P0001', message = 'STRIPE_EVENT_CONTEXT_REQUIRED';
  end if;
  if not is_checkout and p_event_type not in
    ('invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted') then
    raise exception using errcode = 'P0001', message = 'UNSUPPORTED_STRIPE_EVENT';
  end if;
  insert into public.stripe_events (provider_event_id, event_type, order_id)
  values (p_provider_event_id, p_event_type, o.id)
  on conflict (provider_event_id) do nothing;
  if not found then return false; end if;

  select p.* into plan from public.plans p join public.order_items i on i.plan_id = p.id
  where i.order_id = o.id order by i.created_at, i.id limit 1;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_ITEM_NOT_FOUND';
  end if;
  if (plan.billing_type = 'subscription') <> (p_subscription_id is not null) then
    raise exception using errcode = 'P0001', message = 'SUBSCRIPTION_MISMATCH';
  end if;
  select * into m from public.memberships
  where source_order_id = o.id or (p_subscription_id is not null and stripe_subscription_id = p_subscription_id)
  for update;
  if found and (m.user_id <> o.user_id or m.plan_id <> plan.id
      or m.source_order_id is distinct from o.id
      or m.stripe_subscription_id is distinct from p_subscription_id) then
    raise exception using errcode = 'P0001', message = 'SUBSCRIPTION_MISMATCH';
  end if;
  if exists (select 1 from public.payments where order_id = o.id
             and provider_subscription_id is distinct from p_subscription_id) then
    raise exception using errcode = 'P0001', message = 'SUBSCRIPTION_MISMATCH';
  end if;
  if o.stripe_pending_subscription_id is not null
     and o.stripe_pending_subscription_id is distinct from p_subscription_id then
    raise exception using errcode = 'P0001', message = 'SUBSCRIPTION_MISMATCH';
  end if;
  if o.status in ('cancelled', 'refunded') then return true; end if;

  if is_checkout then
    if p_payment_status is distinct from 'paid' then return true; end if;
    if o.status = 'paid' then return true; end if;
    -- Recurring credits are granted exclusively by invoice.paid with its immutable
    -- line period; a completed Checkout cannot borrow a later subscription period.
    if p_subscription_id is null then
      if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
        raise exception using errcode = 'P0001', message = 'MEMBERSHIP_PERIOD_REQUIRED';
      end if;
      insert into public.memberships (user_id, plan_id, source_order_id, status, credits_total, credits_remaining,
        stripe_customer_id, current_period_start, current_period_end, stripe_state_at)
      values (o.user_id, plan.id, o.id, 'active', plan.class_credits, plan.class_credits,
        p_customer_id, p_period_start, p_period_end, p_event_created_at);
    end if;
    update public.orders set status = 'paid', updated_at = now() where id = o.id;
    insert into public.payments (order_id, status, amount_twd_cents, provider_payment_reference,
      provider_subscription_id, processed_at)
    values (o.id, 'paid', o.amount_twd_cents, p_payment_reference, p_subscription_id, now())
    on conflict (order_id) do nothing;
    return true;
  end if;

  if p_subscription_id is null then
    raise exception using errcode = 'P0001', message = 'SUBSCRIPTION_MISMATCH';
  end if;
  if p_event_type in ('invoice.paid', 'invoice.payment_failed')
     and (p_period_start is null or p_period_end is null or p_period_end <= p_period_start) then
    raise exception using errcode = 'P0001', message = 'MEMBERSHIP_PERIOD_REQUIRED';
  end if;
  if p_event_type = 'invoice.paid' and p_payment_status is distinct from 'paid' then return true; end if;
  if p_event_type = 'invoice.paid' then
    update public.orders set status = 'paid', updated_at = now() where id = o.id;
    insert into public.payments (order_id, status, amount_twd_cents, provider_subscription_id,
      provider_payment_reference, processed_at)
    values (o.id, 'paid', o.amount_twd_cents, p_subscription_id, p_payment_reference, now())
    on conflict (order_id) do nothing;
  end if;
  -- Invoice chronology is independent of event creation time. Paying an older
  -- invoice after a newer period failed must not clear that newer delinquency.
  if p_event_type in ('invoice.paid','invoice.payment_failed') then
    if m.id is null and (p_period_start < o.stripe_pending_period_start
                        or p_period_end < o.stripe_pending_period_end) then return true; end if;
    if m.id is not null and (p_period_start < m.current_period_start or p_period_end < m.current_period_end
                            or p_period_start < m.stripe_invoice_period_start
                            or p_period_end < m.stripe_invoice_period_end) then return true; end if;
    if m.id is null then
      update public.orders set stripe_pending_period_start = p_period_start,
        stripe_pending_period_end = p_period_end where id = o.id;
    else
      update public.memberships set stripe_invoice_period_start = p_period_start,
        stripe_invoice_period_end = p_period_end where id = m.id;
    end if;
  end if;

  desired := case p_event_type
    when 'invoice.paid' then 'active'::public.membership_status
    when 'invoice.payment_failed' then 'past_due'::public.membership_status
    when 'customer.subscription.deleted' then 'canceled'::public.membership_status
    else p_membership_status end;
  if desired is null then
    raise exception using errcode = 'P0001', message = 'SUBSCRIPTION_STATUS_REQUIRED';
  end if;
  -- Same-second ties fail closed: cancellation > adverse status > paid > active update.
  rank := case when desired = 'canceled' then 40 when desired <> 'active' then 30
               when p_event_type = 'invoice.paid' then 10 else 0 end;

  if m.id is null then
    if p_event_type <> 'invoice.paid' then
      if o.stripe_pending_status is distinct from 'canceled' and
         (o.stripe_pending_state_at is null or p_event_created_at > o.stripe_pending_state_at
          or (p_event_created_at = o.stripe_pending_state_at and rank > o.stripe_pending_state_rank)) then
        update public.orders set stripe_pending_subscription_id = p_subscription_id,
          stripe_pending_status = desired, stripe_pending_state_at = p_event_created_at,
          stripe_pending_state_rank = rank where id = o.id;
      end if;
      return true;
    end if;
    fresh := o.stripe_pending_status is distinct from 'canceled' and
      (o.stripe_pending_state_at is null or p_event_created_at > o.stripe_pending_state_at
       or (p_event_created_at = o.stripe_pending_state_at and rank > o.stripe_pending_state_rank));
    insert into public.memberships (user_id, plan_id, source_order_id, status, credits_total, credits_remaining,
      stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, stripe_state_at, stripe_state_rank,
      stripe_invoice_period_start, stripe_invoice_period_end)
    values (o.user_id, plan.id, o.id, case when fresh then desired else o.stripe_pending_status end,
      plan.class_credits, plan.class_credits, p_customer_id, p_subscription_id, p_period_start, p_period_end,
      case when fresh then p_event_created_at else o.stripe_pending_state_at end,
      case when fresh then rank else o.stripe_pending_state_rank end, p_period_start, p_period_end)
    returning * into m;
  end if;
  if m.status = 'canceled' then return true; end if; -- terminal for this Stripe subscription

  fresh := m.stripe_state_at is null or p_event_created_at > m.stripe_state_at
    or (p_event_created_at = m.stripe_state_at and rank > m.stripe_state_rank);
  if p_event_type = 'invoice.paid' then
    -- Only a strictly newer paid period resets credits. Same-period invoices,
    -- duplicate event IDs and checkout retries never reset spent credits.
    if p_period_start > m.current_period_start and p_period_end > m.current_period_end then
      update public.memberships set current_period_start = p_period_start,
        current_period_end = p_period_end, credits_remaining = credits_total, updated_at = now()
      where id = m.id;
    end if;
  end if;
  if fresh then
    update public.memberships set status = desired, stripe_state_at = p_event_created_at,
      stripe_state_rank = rank, updated_at = now() where id = m.id;
    -- Payment history remains the original purchase snapshot. Failed renewals
    -- change membership status, not a previously paid order/payment.
  end if;
  return true;
end;
$$;

create or replace function public.apply_stripe_event(
  p_provider_event_id text, p_event_type text, p_order_id uuid,
  p_customer_id text, p_subscription_id text, p_period_start timestamptz,
  p_period_end timestamptz, p_payment_reference text
)
returns boolean language sql security definer set search_path = ''
as $$
  -- Preserve name/signature and duplicate retry behavior. New transitions fail
  -- closed without provider ordering/payment evidence; callers must migrate to v2.
  select public.apply_stripe_event_v2(p_provider_event_id, p_event_type, p_order_id,
    p_customer_id, p_subscription_id, p_period_start, p_period_end, p_payment_reference,
    null, null, null);
$$;

revoke all on function public.apply_stripe_event(text,text,uuid,text,text,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.apply_stripe_event_v2(text,text,uuid,text,text,timestamptz,timestamptz,text,timestamptz,public.membership_status,text) from public, anon, authenticated;
grant execute on function public.apply_stripe_event(text,text,uuid,text,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.apply_stripe_event_v2(text,text,uuid,text,text,timestamptz,timestamptz,text,timestamptz,public.membership_status,text) to service_role;
revoke all on function public.book_session(uuid,uuid), public.cancel_booking(uuid) from public, anon, authenticated, service_role;
grant execute on function public.book_session(uuid,uuid), public.cancel_booking(uuid) to authenticated;
revoke all on function public.create_checkout_order(uuid), public.link_checkout_session(uuid,text),
  public.discard_checkout_order(uuid) from public, anon, service_role;
-- All payment/credit/booking writes use the guarded RPCs, including admin cancellation.
revoke insert, update, delete on public.bookings, public.memberships, public.orders,
  public.order_items, public.payments, public.stripe_events from anon, authenticated;
notify pgrst, 'reload schema';
