import { z } from 'zod';

export const comparisonCandidateSchema = z.object({
  candidate_id: z.string().min(1),
  dataset_version: z.string().min(1),
  pattern_type: z.literal('como_article_ground_vehicle'),
  connector_text: z.string(),
  candidate_full_text: z.string(),
  text_before: z.string(),
  tenor_text: z.string(),
  tenor_lemma: z.string(),
  tenor_confidence: z.string(),
  ground_text: z.string(),
  ground_lemma: z.string(),
  ground_type: z.enum(['quality_adjective', 'salient_verb']),
  ground_source: z.string(),
  vehicle_text_raw: z.string(),
  vehicle_text_clean: z.string(),
  vehicle_tail_text: z.string(),
  vehicle_cleaning_rule: z.string(),
  vehicle_lemma: z.string(),
  vehicle_head: z.string(),
  vehicle_head_lemma: z.string(),
  vehicle_head_clean: z.string(),
  vehicle_head_clean_lemma: z.string(),
  vehicle_phrase_length_tokens: z.number().int().nonnegative(),
  quality_label: z.enum(['keep', 'trimmed', 'review', 'reject']),
  quality_reason: z.array(z.string()),
  visualization_ready: z.boolean(),
  confidence: z.number(),
  needs_review: z.boolean(),
  source_file: z.string(),
  original_line_id: z.number().int(),
  segment_id: z.number().int(),
  char_start: z.number().int(),
  char_end: z.number().int(),
  connector_start: z.number().int(),
  connector_end: z.number().int(),
  vehicle_start: z.number().int(),
  vehicle_end: z.number().int(),
});

export const comparisonManifestSchema = z.record(z.string(), z.unknown()).and(
  z.object({
    dataset_version: z.string().optional(),
  }),
);

export const comparisonCountSchema = z.record(z.string(), z.unknown()).and(
  z.object({
    count: z.number().int().nonnegative(),
  }),
);

export const comparisonExampleSchema = z.record(z.string(), z.unknown());

export const comparisonQuerySchema = z.object({
  dataset_version: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const comparisonBooleanQuery = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .transform((value) => value === true || value === 'true');
