import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(), value: text('value').notNull(),
});
export const requests = sqliteTable('requests', {
  id: text('id').primaryKey(), name: text('name').notNull(), phone: text('phone').notNull(),
  total: integer('total').notNull(), status: text('status').notNull(),
  receipt: text('receipt').notNull(), mime: text('mime').notNull(), created: integer('created').notNull(),
  tokenHash: text('token_hash'), fingerprint: text('fingerprint'),
  numbers: text('numbers').notNull().default('[]'), expires: integer('expires').notNull().default(0),
}, table => [
  uniqueIndex('requests_token').on(table.tokenHash).where(sql`${table.tokenHash} IS NOT NULL`),
  index('requests_status_expires').on(table.status, table.expires),
  index('requests_created').on(table.created),
]);
export const tickets = sqliteTable('tickets', {
  number: integer('number').primaryKey(),
  requestId: text('request_id').notNull().references(() => requests.id),
}, table => [index('tickets_request').on(table.requestId)]);
export const adminSessions = sqliteTable('admin_sessions', {
  tokenHash: text('token_hash').primaryKey(), expires: integer('expires').notNull(),
});
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(), count: integer('count').notNull(), resetAt: integer('reset_at').notNull(),
}, table => [index('rate_limits_expiry').on(table.resetAt)]);