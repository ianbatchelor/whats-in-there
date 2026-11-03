create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAILED: %', what;
  end if;
  raise notice 'ok - %', what;
end;
$$;

-- Runs sql as the current role and checks it fails with a message (or SQLSTATE) containing expected.
create function tests.fails(sql text, expected text, what text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm ilike '%' || expected || '%' or sqlstate = expected then
      raise notice 'ok - %', what;
      return;
    end if;
    raise exception 'FAILED: % (expected "%", got "%" [%])', what, expected, sqlerrm, sqlstate;
  end;
  raise exception 'FAILED: % (expected an error "%", but it succeeded)', what, expected;
end;
$$;

create function tests.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
$$;

grant execute on all functions in schema tests to anon, authenticated;
create table tests.vars (k text primary key, v text);
grant all on tests.vars to authenticated, anon;
