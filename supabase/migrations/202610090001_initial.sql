-- All household writes go through authenticated application services.
-- JSON payloads preserve the versioned TypeScript aggregate; indexed/generated
-- relational columns enforce identity, ownership and domain constraints.
create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text check(length(display_name)<=80)
);
create table public.households (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 2 and 80),
 created_at timestamptz not null default now()
);
create table public.household_memberships (
 household_id uuid not null references public.households on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 role text not null check(role in ('owner','editor','viewer')),
 primary key(household_id,user_id), unique(user_id)
);
create table public.household_workspaces (
 household_id uuid primary key references public.households on delete cascade,
 state jsonb not null check(jsonb_typeof(state)='object' and state->>'schemaVersion'='1'),
 revision integer not null default 0 check(revision>=0),
 updated_at timestamptz not null default now()
);
create table public.ingredients (
 id text primary key, name text not null unique,
 base_unit text not null check(base_unit in ('g','kg','ml','l','count','pack')),
 category text not null, allergens text[] not null default '{}', payload jsonb not null
);
create table public.ingredient_aliases (
 normalized_name text primary key,
 ingredient_id text not null references public.ingredients on delete cascade
);
create table public.recipes (id text primary key, created_at timestamptz not null default now());
create table public.recipe_versions (
 recipe_id text not null references public.recipes on delete cascade,
 version integer not null check(version>0),
 is_current boolean not null default true,
 published boolean not null default false,
 payload jsonb not null,
 primary key(recipe_id,version)
);
create unique index recipe_current on public.recipe_versions(recipe_id) where is_current;
create table public.recipe_ingredients (
 recipe_id text not null, version integer not null, position integer not null,
 ingredient_id text not null references public.ingredients,
 quantity numeric not null check(quantity>0), unit text not null,
 optional boolean not null default false, estimated boolean not null default false,
 primary key(recipe_id,version,position),
 foreign key(recipe_id,version) references public.recipe_versions on delete cascade
);
create table public.catalog_admins (user_id uuid primary key references auth.users on delete cascade);
create table public.catalog_audit (
 id bigint generated always as identity primary key,
 actor uuid references auth.users on delete set null,
 recipe_id text not null, version integer not null, at timestamptz not null default now()
);
create table public.household_members (
 household_id uuid not null references public.households on delete cascade,
 id text not null, payload jsonb not null,
 primary key(household_id,id)
);
create table public.dietary_restrictions (
 household_id uuid not null, member_id text not null, allergen text not null,
 primary key(household_id,member_id,allergen),
 foreign key(household_id,member_id) references public.household_members on delete cascade
);
create table public.food_preferences (
 household_id uuid not null references public.households on delete cascade,
 subject_id text not null, target_id text not null,
 kind text not null check(kind in ('favorite','dislike')),
 primary key(household_id,subject_id,target_id,kind)
);
create table public.pantry_items (
 household_id uuid not null references public.households on delete cascade,
 id text not null, payload jsonb not null,
 ingredient_id text generated always as (payload->>'ingredientId') stored references public.ingredients,
 quantity numeric generated always as ((payload->>'quantity')::numeric) stored check(quantity>=0),
 expires_at text generated always as (nullif(payload->>'expiresAt','')) stored,
 primary key(household_id,id)
);
create table public.meal_plans (
 household_id uuid not null references public.households on delete cascade,
 id text not null, payload jsonb not null,
 recipe_id text generated always as (payload->'recipe'->>'id') stored,
 recipe_version integer generated always as ((payload->'recipe'->>'version')::integer) stored,
 meal_date text generated always as (payload->>'date') stored,
 slot text generated always as (payload->>'slot') stored check(slot in ('breakfast','lunch','dinner')),
 servings integer generated always as ((payload->>'servings')::integer) stored check(servings>0),
 primary key(household_id,id), unique(household_id,meal_date,slot),
 foreign key(recipe_id,recipe_version) references public.recipe_versions
);
create table public.pantry_transactions (
 household_id uuid not null references public.households on delete cascade,
 id text not null, payload jsonb not null,
 pantry_item_id text generated always as (payload->>'pantryItemId') stored,
 ingredient_id text generated always as (payload->>'ingredientId') stored references public.ingredients,
 delta numeric generated always as ((payload->>'delta')::numeric) stored,
 primary key(household_id,id),
 foreign key(household_id,pantry_item_id) references public.pantry_items
);
create table public.shopping_lists (
 household_id uuid primary key references public.households on delete cascade,
 next_shopping_date date not null
);
create table public.shopping_list_items (
 household_id uuid not null references public.shopping_lists on delete cascade,
 id text not null, payload jsonb not null,
 ingredient_id text generated always as (payload->>'ingredientId') stored references public.ingredients,
 quantity numeric generated always as ((payload->>'quantity')::numeric) stored check(quantity>=0),
 purchased boolean generated always as ((payload->>'purchased')::boolean) stored,
 primary key(household_id,id)
);
create unique index shopping_active_ingredient on public.shopping_list_items(household_id,ingredient_id) where purchased=false;
create table public.notification_preferences (
 household_id uuid not null references public.households on delete cascade,
 id text not null, payload jsonb not null,
 primary key(household_id,id)
);
create table public.notifications (
 id text primary key, household_id uuid not null references public.households on delete cascade,
 dedupe_key text not null, payload jsonb not null,
 created_at timestamptz not null default now(), unique(household_id,dedupe_key)
);
create table public.notification_deliveries (
 id bigint generated always as identity primary key,
 notification_id text not null references public.notifications on delete cascade,
 endpoint text not null, status text not null check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0, last_error text, updated_at timestamptz not null default now(),
 unique(notification_id,endpoint)
);
create table public.push_subscriptions (
 user_id uuid not null references auth.users on delete cascade,
 household_id uuid not null references public.households on delete cascade,
 endpoint text not null, payload jsonb not null,
 primary key(user_id,endpoint)
);
-- A security-invoker view inherits RLS from the underlying transaction table.
create view public.consumption_history with (security_invoker=true) as
 select household_id,id,ingredient_id,payload from public.pantry_transactions
 where payload->>'kind'='consume';
create index pantry_lookup on public.pantry_items(household_id,ingredient_id);
create index meal_lookup on public.meal_plans(household_id,meal_date);
create index transaction_lookup on public.pantry_transactions(household_id,ingredient_id);

create function public.is_household_member(p_household_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.household_memberships m where m.household_id=p_household_id and m.user_id=(select auth.uid()));
$$;
revoke all on function public.is_household_member(uuid) from public,anon;
grant execute on function public.is_household_member(uuid) to authenticated;

do $$ declare t text; begin
 foreach t in array array['profiles','households','household_memberships','household_workspaces','ingredients','ingredient_aliases','recipes','recipe_versions','recipe_ingredients','catalog_admins','catalog_audit','household_members','dietary_restrictions','food_preferences','pantry_items','meal_plans','pantry_transactions','shopping_lists','shopping_list_items','notification_preferences','notifications','notification_deliveries','push_subscriptions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['household_workspaces','household_members','dietary_restrictions','food_preferences','pantry_items','meal_plans','pantry_transactions','shopping_lists','shopping_list_items','notification_preferences','notifications'] loop
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy household_read on public.%I for select to authenticated using (public.is_household_member(household_id))',t);
 end loop;
 foreach t in array array['ingredients','ingredient_aliases','recipes','recipe_versions','recipe_ingredients'] loop
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
grant select on public.profiles,public.households,public.household_memberships,public.catalog_admins,public.push_subscriptions,public.consumption_history to authenticated;
grant insert,update,delete on public.push_subscriptions to authenticated;
create policy profile_self on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy household_read on public.households for select to authenticated using(public.is_household_member(id));
create policy membership_self on public.household_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy admin_self on public.catalog_admins for select to authenticated using(user_id=(select auth.uid()));
create policy ingredient_read on public.ingredients for select to authenticated using(true);
create policy aliases_read on public.ingredient_aliases for select to authenticated using(true);
create policy recipes_read on public.recipes for select to authenticated using(true);
create policy versions_read on public.recipe_versions for select to authenticated using(published or exists(select 1 from public.catalog_admins a where a.user_id=(select auth.uid())));
create policy recipe_ingredients_read on public.recipe_ingredients for select to authenticated using(exists(select 1 from public.recipe_versions v where v.recipe_id=recipe_ingredients.recipe_id and v.version=recipe_ingredients.version));
create policy push_self on public.push_subscriptions for all to authenticated using(user_id=(select auth.uid()) and public.is_household_member(household_id)) with check(user_id=(select auth.uid()) and public.is_household_member(household_id));

create function public.project_workspace(p_household_id uuid,p_state jsonb) returns void
 language plpgsql security definer set search_path='' as $$
begin
 update public.households set name=p_state->'household'->>'name' where id=p_household_id;
 delete from public.dietary_restrictions where household_id=p_household_id;
 delete from public.household_members where household_id=p_household_id;
 insert into public.household_members select p_household_id,x->>'id',x from jsonb_array_elements(p_state->'household'->'members') x;
 insert into public.dietary_restrictions select distinct p_household_id,m->>'id',a from jsonb_array_elements(p_state->'household'->'members') m cross join lateral jsonb_array_elements_text(m->'allergens') a;
 delete from public.food_preferences where household_id=p_household_id;
 insert into public.food_preferences select distinct p_household_id,'household',f,'favorite' from jsonb_array_elements_text(p_state->'household'->'favorites') f;
 insert into public.food_preferences select distinct p_household_id,m->>'id',d,'dislike' from jsonb_array_elements(p_state->'household'->'members') m cross join lateral jsonb_array_elements_text(m->'dislikes') d;
 delete from public.pantry_transactions where household_id=p_household_id;
 delete from public.pantry_items where household_id=p_household_id;
 insert into public.pantry_items(household_id,id,payload) select p_household_id,x->>'id',x from jsonb_array_elements(p_state->'pantry') x;
 insert into public.pantry_transactions(household_id,id,payload) select p_household_id,x->>'id',x from jsonb_array_elements(p_state->'transactions') x;
 delete from public.meal_plans where household_id=p_household_id;
 insert into public.meal_plans(household_id,id,payload) select p_household_id,x->>'id',x from jsonb_array_elements(p_state->'meals') x;
 insert into public.shopping_lists values(p_household_id,(p_state->'household'->>'nextShoppingDate')::date) on conflict(household_id) do update set next_shopping_date=excluded.next_shopping_date;
 delete from public.shopping_list_items where household_id=p_household_id;
 insert into public.shopping_list_items(household_id,id,payload) select p_household_id,x->>'id',x from jsonb_array_elements(p_state->'shopping') x;
 delete from public.notification_preferences where household_id=p_household_id;
 insert into public.notification_preferences select p_household_id,x->>'id',x from jsonb_array_elements(p_state->'reminders') x;
 insert into public.notifications(id,household_id,dedupe_key,payload) select x->>'id',p_household_id,x->>'key',x from jsonb_array_elements(p_state->'notices') x on conflict(household_id,dedupe_key) do update set payload=excluded.payload;
end $$;
revoke all on function public.project_workspace(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.project_workspace(uuid,jsonb) to service_role;

create function public.create_household(p_initial jsonb) returns uuid
 language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_household uuid;
begin
 if v_user is null then raise exception 'UNAUTHORIZED';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 select household_id into v_household from public.household_memberships where user_id=v_user;
 if v_household is not null then return v_household;end if;
 if p_initial->>'schemaVersion'<>'1' or jsonb_array_length(p_initial->'pantry')<>0 or jsonb_array_length(p_initial->'meals')<>0 or jsonb_array_length(p_initial->'transactions')<>0 then raise exception 'Initial household must be empty';end if;
 insert into public.profiles(id) values(v_user) on conflict do nothing;
 insert into public.households(owner_id,name) values(v_user,p_initial->'household'->>'name') returning id into v_household;
 insert into public.household_memberships values(v_household,v_user,'owner');
 insert into public.household_workspaces values(v_household,jsonb_set(p_initial,'{revision}','0'),0,now());
 perform public.project_workspace(v_household,p_initial);
 return v_household;
end $$;
revoke all on function public.create_household(jsonb) from public,anon;
grant execute on function public.create_household(jsonb) to authenticated;

create function public.save_workspace(p_household_id uuid,p_state jsonb,p_expected integer) returns void
 language plpgsql security definer set search_path='' as $$
declare v_revision integer;
begin
 select revision into v_revision from public.household_workspaces where household_id=p_household_id for update;
 if v_revision is null or v_revision<>p_expected then raise exception 'REVISION_CONFLICT';end if;
 perform public.project_workspace(p_household_id,p_state);
 update public.household_workspaces set state=jsonb_set(p_state,'{revision}',to_jsonb(p_expected+1)),revision=p_expected+1,updated_at=now() where household_id=p_household_id;
end $$;
revoke all on function public.save_workspace(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.save_workspace(uuid,jsonb,integer) to service_role;

create function public.publish_recipe(p_recipe jsonb,p_expected integer,p_actor uuid) returns void
 language plpgsql security definer set search_path='' as $$
declare v_current integer; v_id text:=p_recipe->>'id'; v_version integer:=(p_recipe->>'version')::integer;
begin
 if not exists(select 1 from public.catalog_admins where user_id=p_actor) then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id,1));
 select version into v_current from public.recipe_versions where recipe_id=v_id and is_current;
 if coalesce(v_current,0)<>p_expected or v_version<>p_expected+1 then raise exception 'REVISION_CONFLICT';end if;
 insert into public.recipes(id) values(v_id) on conflict do nothing;
 update public.recipe_versions set is_current=false where recipe_id=v_id;
 insert into public.recipe_versions values(v_id,v_version,true,(p_recipe->>'published')::boolean,p_recipe);
 insert into public.recipe_ingredients(recipe_id,version,position,ingredient_id,quantity,unit,optional,estimated)
 select v_id,v_version,ordinality::integer,x->>'ingredientId',(x->>'quantity')::numeric,x->>'unit',coalesce((x->>'optional')::boolean,false),coalesce((x->>'estimated')::boolean,false) from jsonb_array_elements(p_recipe->'ingredients') with ordinality as t(x,ordinality);
 insert into public.catalog_audit(actor,recipe_id,version) values(p_actor,v_id,v_version);
end $$;
revoke all on function public.publish_recipe(jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.publish_recipe(jsonb,integer,uuid) to service_role;

create function public.queue_push_deliveries() returns void
 language sql security definer set search_path='' as $$
 insert into public.notification_deliveries(notification_id,endpoint,status)
 select n.id,s.endpoint,'pending' from public.notifications n join public.push_subscriptions s using(household_id)
 where n.created_at>now()-interval '1 day' and coalesce((n.payload->>'read')::boolean,false)=false
 on conflict(notification_id,endpoint) do nothing;
$$;
create function public.claim_push_deliveries(p_limit integer default 50)
 returns table(delivery_id bigint,notification_id text,endpoint text,subscription jsonb,notification jsonb)
 language sql security definer set search_path='' as $$
 with candidates as (
 select d.id from public.notification_deliveries d
 where d.attempts<3 and (d.status='pending' or d.status in ('failed','sending') and d.updated_at<now()-interval '5 minutes')
 order by d.id limit least(greatest(p_limit,1),100) for update skip locked
 ), claimed as (
 update public.notification_deliveries d set status='sending',attempts=attempts+1,updated_at=now()
 from candidates c where d.id=c.id returning d.*
 ) select c.id,c.notification_id,c.endpoint,s.payload,n.payload from claimed c
 join public.notifications n on n.id=c.notification_id
 join lateral (select ps.payload from public.push_subscriptions ps where ps.endpoint=c.endpoint and ps.household_id=n.household_id limit 1) s on true;
$$;
revoke all on function public.queue_push_deliveries() from public,anon,authenticated;
revoke all on function public.claim_push_deliveries(integer) from public,anon,authenticated;
grant execute on function public.queue_push_deliveries(),public.claim_push_deliveries(integer) to service_role;
