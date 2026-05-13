CREATE TABLE "api_key_usage_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"api_key_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"method" text NOT NULL,
	"status_code" integer,
	"response_ms" integer,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"website" text,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"daily_limit" integer DEFAULT 1000 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key_usage_logs" ADD CONSTRAINT "api_key_usage_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_usage_api_key_idx" ON "api_key_usage_logs" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "api_key_usage_created_at_idx" ON "api_key_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_key_usage_endpoint_idx" ON "api_key_usage_logs" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "api_key_usage_key_date_idx" ON "api_key_usage_logs" USING btree ("api_key_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_prefix_idx" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "api_keys_email_idx" ON "api_keys" USING btree ("email");--> statement-breakpoint
CREATE INDEX "api_keys_tier_idx" ON "api_keys" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "api_keys_is_active_idx" ON "api_keys" USING btree ("is_active");