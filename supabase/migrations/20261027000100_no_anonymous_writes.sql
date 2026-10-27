-- Signed-out visitors write nothing.
--
-- Every public table has row security, and no rule lets the anon role in, so
-- these grants did nothing. They are taken away anyway, so a rule written
-- carelessly later can never open a table to people who are not signed in.
-- Reads are untouched; signed-in users keep exactly what their rules allow.

revoke insert, update, delete on
    public.content_reports,
    public.day_cards,
    public.ember_ledger,
    public.feed_comments,
    public.feed_reactions,
    public.feedback,
    public.pacts,
    public.shared_completions,
    public.shared_tasks,
    public.user_blocks
from anon;
