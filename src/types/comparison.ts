import { ObjectId } from 'mongodb';

export const COMPARISON_DATASET_VERSION = 'v1';

export const comparisonCollections = {
  manifests: 'comparison_manifests',
  candidates: 'comparison_candidates',
  groundVehicleCounts: 'comparison_ground_vehicle_counts',
  vehicleGroundCounts: 'comparison_vehicle_ground_counts',
  groundCounts: 'comparison_ground_counts',
  vehicleCounts: 'comparison_vehicle_counts',
  examples: 'comparison_examples',
} as const;

export interface ComparisonCandidate {
  _id?: ObjectId;
  candidate_id: string;
  dataset_version: string;
  pattern_type: 'como_article_ground_vehicle';
  connector_text: string;
  candidate_full_text: string;
  text_before: string;
  tenor_text: string;
  tenor_lemma: string;
  tenor_confidence: string;
  ground_text: string;
  ground_lemma: string;
  ground_type: 'quality_adjective' | 'salient_verb';
  ground_source: string;
  vehicle_text_raw: string;
  vehicle_text_clean: string;
  vehicle_tail_text: string;
  vehicle_cleaning_rule: string;
  vehicle_lemma: string;
  vehicle_head: string;
  vehicle_head_lemma: string;
  vehicle_head_clean: string;
  vehicle_head_clean_lemma: string;
  vehicle_phrase_length_tokens: number;
  quality_label: 'keep' | 'trimmed' | 'review' | 'reject';
  quality_reason: string[];
  visualization_ready: boolean;
  confidence: number;
  needs_review: boolean;
  source_file: string;
  original_line_id: number;
  segment_id: number;
  char_start: number;
  char_end: number;
  connector_start: number;
  connector_end: number;
  vehicle_start: number;
  vehicle_end: number;
  importedAt?: Date;
}

export interface ComparisonManifest {
  _id?: ObjectId;
  dataset_version: string;
  importedAt?: Date;
  [key: string]: unknown;
}

export interface ComparisonGroundVehicleCount {
  _id?: ObjectId;
  dataset_version: string;
  ground_lemma: string;
  vehicle_head_clean_lemma: string;
  count: number;
  visualization_ready?: boolean;
  importedAt?: Date;
  [key: string]: unknown;
}

export interface ComparisonVehicleGroundCount {
  _id?: ObjectId;
  dataset_version: string;
  vehicle_head_clean_lemma: string;
  ground_lemma: string;
  count: number;
  visualization_ready?: boolean;
  importedAt?: Date;
  [key: string]: unknown;
}

export interface ComparisonSummaryCount {
  _id?: ObjectId;
  dataset_version: string;
  count: number;
  importedAt?: Date;
  [key: string]: unknown;
}

export interface ComparisonExample {
  _id?: ObjectId;
  dataset_version: string;
  candidate_id?: string;
  ground_lemma?: string;
  vehicle_head_clean_lemma?: string;
  quality_label?: string;
  visualization_ready?: boolean;
  confidence?: number;
  importedAt?: Date;
  [key: string]: unknown;
}
