CREATE TABLE `approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`message_id` text,
	`permission_id` text NOT NULL,
	`type` text NOT NULL,
	`path` text,
	`command` text,
	`description` text DEFAULT '' NOT NULL,
	`policy` text NOT NULL,
	`policy_reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`decided_at` integer
);
