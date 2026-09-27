-- Remove the unused marketing_subscribers table.
-- Nothing in the codebase reads or writes it; row count at drop time is logged in the chat record.
DROP TABLE public.marketing_subscribers;
