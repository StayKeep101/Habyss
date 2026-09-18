#!/bin/sh
W="$(dirname "$0")"; : "${Q:?run through run.sh}"; PASS=0; FAIL=0
A=aaaaaaaa-0000-4000-8000-000000000001; B=bbbbbbbb-0000-4000-8000-000000000002
as() { # as <role> <uid|-> <sql>
  pre="set role $1;"; [ "$2" != "-" ] && pre="$pre set request.jwt.claim.sub = '$2';"
  "$Q" -d replica -tAc "$pre $3" 2>&1
}
ok()   { out=$(as "$2" "$3" "$4"); if echo "$out" | grep -qiE "error|denied|violat"; then echo "  FAIL  $1  ->  $out"; FAIL=$((FAIL+1)); else echo "  pass  $1"; PASS=$((PASS+1)); fi; }
deny() { out=$(as "$2" "$3" "$4"); if echo "$out" | grep -qiE "does not exist|syntax error"; then echo "  FAIL  $1  (setup problem: $out)"; FAIL=$((FAIL+1)); return; fi; if echo "$out" | grep -qiE "permission denied|row-level security|violates|not signed in"; then echo "  pass  $1"; PASS=$((PASS+1)); else echo "  FAIL  $1  (was allowed: $out)"; FAIL=$((FAIL+1)); fi; }
is()   { out=$(as "$2" "$3" "$4"); if [ "$out" = "$5" ]; then echo "  pass  $1"; PASS=$((PASS+1)); else echo "  FAIL  $1  (got '$out', want '$5')"; FAIL=$((FAIL+1)); fi; }

echo "-- the email leak"
deny "anonymous cannot read profiles at all"      anon -  "select * from public.profiles"
deny "signed-in user cannot read anyone's email"  authenticated $A "select email from public.profiles"
deny "signed-in user cannot read push tokens"     authenticated $A "select push_token from public.profiles"
is   "signed-in user can find people by username" authenticated $A "select count(*) from public.profiles where username='bob'" "1"

echo "-- privacy between users"
is   "alice sees only her own habits"             authenticated $A "select count(*) from public.habits" "2"
is   "bob cannot see alice's habits"              authenticated $B "select count(*) from public.habits where user_id='$A'" "0"
is   "bob cannot see alice's completions"         authenticated $B "select count(*) from public.habit_completions where user_id='$A'" "0"
deny "alice cannot create a habit as bob"          authenticated $A "insert into public.habits (user_id,name,category) values ('$B','x','body')"
deny "alice cannot log a completion on bob's habit" authenticated $A "insert into public.habit_completions (user_id,habit_id,date) values ('$A','22222222-0000-4000-8000-000000000001','2026-09-18')"
is   "alice cannot change bob's profile"           authenticated $A "update public.profiles set username='hacked' where id='$B' returning 1" ""

echo "-- the app's real data now fits"
ok   "a numeric habit with a decimal target saves" authenticated $A "insert into public.habits (user_id,name,category,tracking_method,goal_value,unit) values ('$A','Run','body','numeric',3.6,'km')"
ok   "a decimal completion value saves"            authenticated $A "insert into public.habit_completions (user_id,habit_id,date,value) values ('$A','11111111-0000-4000-8000-000000000002','2026-09-18',3.6)"
deny "a second completion for the same day is refused" authenticated $A "insert into public.habit_completions (user_id,habit_id,date,value) values ('$A','11111111-0000-4000-8000-000000000002','2026-09-18',1)"
ok   "goal_spec is stored"                          authenticated $A "update public.habits set goal_spec='{\"type\":\"volume\",\"target\":50}' where id='11111111-0000-4000-8000-000000000001'"

echo "-- tasks"
ok   "alice adds a task"                            authenticated $A "insert into public.tasks (title,due_date,priority) values ('Buy running shoes','2026-09-20',1)"
is   "the task is owned by alice automatically"      authenticated $A "select count(*) from public.tasks where user_id='$A'" "1"
is   "bob cannot see alice's task"                  authenticated $B "select count(*) from public.tasks" "0"
deny "a malformed due time is refused"              authenticated $A "insert into public.tasks (title,due_time) values ('x','25:99')"

echo "-- sharing works only when accepted"
ok   "alice shares her habit with bob"              authenticated $A "insert into public.shared_habits (habit_id,owner_id,shared_with_id,status) values ('11111111-0000-4000-8000-000000000002','$A','$B','pending')"
is   "bob cannot see it while pending"              authenticated $B "select count(*) from public.habits where id='11111111-0000-4000-8000-000000000002'" "0"
ok   "bob accepts"                                  authenticated $B "update public.shared_habits set status='accepted' where shared_with_id='$B'"
is   "bob now sees the shared habit"                authenticated $B "select count(*) from public.habits where id='11111111-0000-4000-8000-000000000002'" "1"
is   "bob sees its completions too"                 authenticated $B "select count(*) from public.habit_completions where habit_id='11111111-0000-4000-8000-000000000002'" "2"
deny "bob cannot share alice's habit onward"        authenticated $B "insert into public.shared_habits (habit_id,owner_id,shared_with_id) values ('11111111-0000-4000-8000-000000000002','$B','$A')"

echo "-- notifications"
ok   "alice can notify her friend bob"              authenticated $A "insert into public.notifications (user_id,from_user_id,title) values ('$B','$A','Nice run')"
is   "bob can read it"                              authenticated $B "select count(*) from public.notifications" "1"
is   "alice cannot read bob's inbox"                authenticated $A "select count(*) from public.notifications where user_id='$B'" "0"

echo "-- what friends can see of each other"
CAROL=cccccccc-0000-4000-8000-000000000003
# The sign-up trigger creates the profile without a username, as a real
# sign-up would; carol then picks one.
"$Q" -d replica -tAc "insert into auth.users (id,email) values ('$CAROL','carol@example.com') on conflict do nothing; update public.profiles set username='carol' where id='$CAROL';" >/dev/null
is   "a new sign-up gets a profile automatically"    postgres - "select count(*) from public.profiles where id='$CAROL'" "1"
"$Q" -d replica -tAc "insert into public.habit_completions (user_id,habit_id,date,value) values ('$B','22222222-0000-4000-8000-000000000001','2026-09-16',1),('$B','22222222-0000-4000-8000-000000000001','2026-09-18',1) on conflict do nothing;" >/dev/null
is   "alice sees herself and her friend bob"          authenticated $A "select string_agg(username, ',' order by username) from public.friend_stats('2026-09-18')" "alice,bob"
is   "a stranger does not appear"                    authenticated $A "select count(*) from public.friend_stats('2026-09-18') where username='carol'" "0"
is   "bob's day is counted from his own completions" authenticated $A "select today_done from public.friend_stats('2026-09-18') where username='bob'" "1"
is   "a streak counts back from today"               authenticated $A "select current_streak from public.friend_stats('2026-09-18') where username='bob'" "3"
is   "the week is seven days, oldest first"          authenticated $A "select array_length(week_done,1) from public.friend_stats('2026-09-18') where username='bob'" "7"
is   "carol, with no friends, sees only herself"     authenticated $CAROL "select string_agg(username, ',') from public.friend_stats('2026-09-18')" "carol"
deny "anonymous cannot call friend_stats"            anon - "select * from public.friend_stats('2026-09-18')"
is   "friends get numbers only, never habit details" postgres - "select count(*) from unnest((select proargnames from pg_proc where proname='friend_stats')) n where n in ('name','description','goal_value','unit','memo','goal_spec')" "0"

echo "-- account deletion"
deny "anonymous cannot call delete_my_account"      anon - "select public.delete_my_account()"
ok   "alice deletes her own account"                authenticated $A "select public.delete_my_account()"
is   "alice is gone from auth"                       postgres - "select count(*) from auth.users where id='$A'" "0"
is   "everything she owned went with her"           postgres - "select (select count(*) from public.habits where user_id='$A')+(select count(*) from public.habit_completions where user_id='$A')+(select count(*) from public.tasks where user_id='$A')+(select count(*) from public.profiles where id='$A')" "0"
is   "bob's own data is untouched"                  postgres - "select count(*) from public.habits where user_id='$B'" "1"

echo; echo "RESULT: $PASS passed, $FAIL failed"
