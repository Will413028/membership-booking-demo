create or replace function public.create_checkout_order(p_plan_id uuid)
returns table (
  order_id uuid,
  plan_id uuid,
  stripe_price_id text,
  billing_type public.billing_type,
  amount_twd_cents integer,
  class_credits integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  target_plan public.plans%rowtype;
  created_order_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  select * into target_plan
    from public.plans
   where id = p_plan_id
     and active = true
   for share;

  if not found then
    raise exception using errcode = 'P0001', message = 'PLAN_NOT_FOUND';
  end if;

  if target_plan.stripe_price_id is null
     or btrim(target_plan.stripe_price_id) = '' then
    raise exception using errcode = 'P0001', message = 'STRIPE_PRICE_NOT_CONFIGURED';
  end if;

  insert into public.orders (user_id, status, amount_twd_cents, currency)
  values (current_user_id, 'pending', target_plan.amount_twd_cents, 'twd')
  returning id into created_order_id;

  insert into public.order_items (
    order_id,
    plan_id,
    quantity,
    unit_amount_twd_cents
  ) values (
    created_order_id,
    target_plan.id,
    1,
    target_plan.amount_twd_cents
  );

  return query
    select
      created_order_id,
      target_plan.id,
      target_plan.stripe_price_id,
      target_plan.billing_type,
      target_plan.amount_twd_cents,
      target_plan.class_credits;
end;
$$;

create or replace function public.link_checkout_session(
  p_order_id uuid,
  p_stripe_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  if p_stripe_checkout_session_id is null
     or btrim(p_stripe_checkout_session_id) = '' then
    raise exception using errcode = 'P0001', message = 'STRIPE_SESSION_REQUIRED';
  end if;

  update public.orders
     set stripe_checkout_session_id = p_stripe_checkout_session_id,
         updated_at = now()
   where id = p_order_id
     and user_id = auth.uid()
     and status = 'pending'
     and (
       stripe_checkout_session_id is null
       or stripe_checkout_session_id = p_stripe_checkout_session_id
     );

  return found;
end;
$$;

create or replace function public.discard_checkout_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  delete from public.orders
   where id = p_order_id
     and user_id = auth.uid()
     and status = 'pending'
     and stripe_checkout_session_id is null;

  return found;
end;
$$;

revoke all on function public.create_checkout_order(uuid) from public;
revoke all on function public.link_checkout_session(uuid, text) from public;
revoke all on function public.discard_checkout_order(uuid) from public;

grant execute on function public.create_checkout_order(uuid) to authenticated;
grant execute on function public.link_checkout_session(uuid, text) to authenticated;
grant execute on function public.discard_checkout_order(uuid) to authenticated;
