-- A task's steps: "Write, edit and publish the blog post" is one task with
-- three steps, ticked one by one. [{ "id": "…", "title": "…", "done": false }]
alter table public.tasks add column if not exists subtasks jsonb
    check (subtasks is null or jsonb_typeof(subtasks) = 'array');

notify pgrst, 'reload schema';
