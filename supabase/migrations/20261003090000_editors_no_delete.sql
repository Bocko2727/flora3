-- Defense in depth: RLS already has no delete policy on editors; also remove the table privilege.
revoke delete on public.editors from authenticated;
