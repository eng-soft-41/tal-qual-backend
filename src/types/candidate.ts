import { ObjectId } from 'mongodb';

export interface Candidate {
  _id?: ObjectId;
  candidate_id: string;
  candidate_full_text: string;
  context?: {
    before?: string;
    connector?: string;
    after?: string;
  };
  connector_family?: string;
  vehicle?: {
    lemma?: string;
  };
  label: string;
  createdAt?: Date;
}