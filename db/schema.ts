import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const settings = sqliteTable('settings',{id:integer('id').primaryKey(),value:text('value').notNull()});
export const requests = sqliteTable('requests',{id:text('id').primaryKey(),name:text('name').notNull(),phone:text('phone').notNull(),total:integer('total').notNull(),status:text('status').notNull(),receipt:text('receipt').notNull(),mime:text('mime').notNull(),created:integer('created').notNull()});
export const tickets = sqliteTable('tickets',{number:integer('number').primaryKey(),requestId:text('request_id').notNull().references(()=>requests.id)});
