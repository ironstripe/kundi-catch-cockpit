ALTER TABLE public.audit_events DROP CONSTRAINT IF EXISTS audit_events_action_valid;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_valid CHECK (action = ANY (ARRAY[
  'created','updated','status_changed','published','deleted',
  'closed','reconciliation_changed','reopened','cancelled',
  'calculation_decision','critical_calculation_confirmed'
]));