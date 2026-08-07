PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_token_usages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_token_usages`("id", "session_id", "provider", "model", "input_tokens", "output_tokens", "cost", "created_at") SELECT "id", "session_id", "provider", "model", "input_tokens", "output_tokens", "cost", "created_at" FROM `token_usages`;--> statement-breakpoint
DROP TABLE `token_usages`;--> statement-breakpoint
ALTER TABLE `__new_token_usages` RENAME TO `token_usages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;