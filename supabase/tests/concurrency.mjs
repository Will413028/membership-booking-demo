import assert from "node:assert/strict";
import {execFile, spawn} from "node:child_process";
import {promisify} from "node:util";
const exec = promisify(execFile);
const container = process.argv[2];
assert.match(container ?? "", /^membership-remediation[-a-z0-9]+$/);
const inspected = await exec("docker", ["inspect", "--format", '{{index .Config.Labels "task"}}', container]);
assert.equal(inspected.stdout.trim(), "membership-remediation", "Only a task-owned disposable DB is allowed.");
const args = ["exec", "-i", container, "psql", "-At", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"];
function query(sql, onLocked = () => {}) {
  const child = spawn("docker", args);
  let output = "";
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {child.kill(); reject(new Error("Database concurrency test timed out."));}, 15000);
    child.on("error", reject);
    child.stdout.on("data", chunk => {output += chunk; if (output.includes("LOCKED")) onLocked();});
    child.stderr.on("data", chunk => {output += chunk;});
    child.on("close", code => {clearTimeout(timer); resolve({code, output});});
  });
  child.stdin.end(sql);
  return done;
}
async function race(first, second) {
  let ready;
  const locked = new Promise(resolve => {ready = resolve;});
  const a = query(first, ready);
  await Promise.race([locked, a.then(result => {if (result.code !== 0) throw new Error(result.output);})]);
  return Promise.all([a, query(second)]);
}
const created = await query(`
  insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity)
  values ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000003',
    now()+interval '2 days',now()+interval '2 days 1 hour',1);
`);
assert.equal(created.code, 0, created.output);
const booked = await race(`
  begin;
  select id from public.class_sessions where id='00000000-0000-0000-0000-000000000040' for update;
  select 'LOCKED'; select pg_sleep(1);
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  select * from public.book_session('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000031');
  commit;
`, `
  begin;
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
  select * from public.book_session('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000033');
  commit;
`);
assert.equal(booked[0].code, 0, booked[0].output);
assert.notEqual(booked[1].code, 0);
assert.match(booked[1].output, /SESSION_FULL/);
console.log("PASS: two connections competing for one seat grant exactly one booking.");

const capacity = await race(`
  begin;
  select id from public.class_sessions where id='00000000-0000-0000-0000-000000000004' for update;
  select 'LOCKED'; select pg_sleep(1);
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
  select * from public.book_session('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000033');
  commit;
`, `
  update public.class_sessions set capacity=1 where id='00000000-0000-0000-0000-000000000004';
`);
assert.equal(capacity[0].code, 0, capacity[0].output);
assert.notEqual(capacity[1].code, 0);
assert.match(capacity[1].output, /CAPACITY_BELOW_BOOKINGS/);
const invariant = await query(`
  select count(*)=2 and min(s.capacity)=2 from public.bookings b
  join public.class_sessions s on s.id=b.session_id
  where s.id='00000000-0000-0000-0000-000000000004' and b.status='confirmed';
`);
assert.equal(invariant.output.trim(), "t");
console.log("PASS: concurrent capacity reduction observes committed bookings and is rejected.");
