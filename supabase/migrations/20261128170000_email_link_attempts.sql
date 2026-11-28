begin;
create table roomlet_private.email_link_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  flow_id uuid not null, email text not null check(length(email)<=254),
  phase text not null default 'code' check(phase in ('code','old','merge','done')),
  kind text not null default 'change' check(kind in ('change','existing')),
  attempts integer not null default 0 check(attempts between 0 and 6),
  expires_at timestamptz not null, sent_at timestamptz not null,
  window_at timestamptz not null, send_count integer not null default 1
);
alter table roomlet_private.email_link_attempts enable row level security;
revoke all on roomlet_private.email_link_attempts from public,anon,authenticated;
create function roomlet_private.email_gate(p_user uuid,p_action text,p_flow uuid,p_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r roomlet_private.email_link_attempts; allowed boolean:=false;
begin
  if p_action='start' then
    if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid address'; end if;
    perform pg_advisory_xact_lock(hashtextextended('roomlet-email:'||p_user::text,0));
    select * into r from roomlet_private.email_link_attempts where user_id=p_user for update;
    if found and (r.sent_at>clock_timestamp()-interval '60 seconds' or (r.window_at>clock_timestamp()-interval '1 hour' and r.send_count>=5)) then
      return jsonb_build_object('allowed',false,'retry_at',greatest(r.sent_at+interval '60 seconds',case when r.send_count>=5 then r.window_at+interval '1 hour' else r.sent_at end));
    end if;
    insert into roomlet_private.email_link_attempts(user_id,flow_id,email,expires_at,sent_at,window_at)
      values(p_user,p_flow,p_email,clock_timestamp()+interval '10 minutes',clock_timestamp(),clock_timestamp())
      on conflict(user_id) do update set flow_id=p_flow,email=p_email,phase='code',kind='change',attempts=0,
        expires_at=clock_timestamp()+interval '10 minutes',sent_at=clock_timestamp(),
        window_at=case when r.window_at<clock_timestamp()-interval '1 hour' then clock_timestamp() else r.window_at end,
        send_count=case when r.window_at<clock_timestamp()-interval '1 hour' then 1 else r.send_count+1 end;
    allowed:=true;
  elsif p_action='attempt' then
    update roomlet_private.email_link_attempts set attempts=attempts+1
      where user_id=p_user and flow_id=p_flow and phase in ('code','old') and attempts<6 and expires_at>clock_timestamp();
    allowed:=found;
  elsif p_action='existing' then
    update roomlet_private.email_link_attempts set kind='existing' where user_id=p_user and flow_id=p_flow and phase='code';
    allowed:=found;
  elsif p_action in ('old','merge','finish') then
    update roomlet_private.email_link_attempts set phase=case when p_action='finish' then 'done' else p_action end
      where user_id=p_user and flow_id=p_flow and phase<>'done' and expires_at>clock_timestamp();
    allowed:=found;
  elsif p_action='read' then allowed:=true;
  else raise exception 'Invalid operation'; end if;
  select * into r from roomlet_private.email_link_attempts where user_id=p_user;
  return jsonb_build_object('allowed',allowed,'flow_id',r.flow_id,'email',r.email,'phase',r.phase,'kind',r.kind,
    'expires_at',r.expires_at,'retry_at',r.sent_at+interval '60 seconds');
end $$;
create function public.roomlet_email_gate(p_user uuid,p_action text,p_flow uuid,p_email text)
returns jsonb language sql security invoker set search_path='' as $$select roomlet_private.email_gate(p_user,p_action,p_flow,p_email)$$;
revoke all on function roomlet_private.email_gate(uuid,text,uuid,text),public.roomlet_email_gate(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function roomlet_private.email_gate(uuid,text,uuid,text),public.roomlet_email_gate(uuid,text,uuid,text) to service_role;
commit;
