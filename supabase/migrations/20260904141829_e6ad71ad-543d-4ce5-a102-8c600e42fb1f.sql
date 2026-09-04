REVOKE EXECUTE ON FUNCTION public.enforce_catch_status_transition() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_catch_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_catch_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;