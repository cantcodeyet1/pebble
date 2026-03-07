import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const logoiTable = sqliteTable('logoi', {
  id:               text('id').primaryKey(),
  entry:            text('entry').notNull(),
  tier:             text('tier').notNull(),          // 'word' | 'phrase'
  definition:       text('definition').notNull(),
  example:          text('example').notNull(),
  source:           text('source'),
  register:         text('register').notNull(),
  phonetic:         text('phonetic').notNull().default(''),
  pos:              text('pos').notNull().default(''),
  synonyms:         text('synonyms').notNull().default('[]'),
  mastery_level:    integer('mastery_level').notNull().default(0),
  next_review_date: text('next_review_date').notNull(),
  date_added:       text('date_added').notNull(),
  starred:          integer('starred',  { mode: 'boolean' }).notNull().default(false),
  synced:           integer('synced',   { mode: 'boolean' }).notNull().default(false),
  updated_at:       text('updated_at').notNull(),
});

export type LogosRow    = typeof logoiTable.$inferSelect;
export type NewLogosRow = typeof logoiTable.$inferInsert;
