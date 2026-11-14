import { Schema, Document, Types } from 'mongoose';

export type SourceType =
  | 'osm'
  | 'google_maps'
  | 'searxng'
  | 'website_about'
  | 'website_contact'
  | 'website_team'
  | 'website_home'
  | 'website_services'
  | 'website_products'
  | 'website_leadership'
  | 'website_management'
  | 'gemini_analysis'
  | 'manual_entry'
  | 'other';

export interface ISource {
  companyId?: Types.ObjectId;
  sourceUrl: string;
  sourceType: SourceType;
  extractedField?: string;
  supportingText?: string;
  fetchedAt: Date;
}

export const SourceSchema = new Schema<ISource>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    sourceUrl: {
      type: String,
      required: true,
      trim: true,
    },
    sourceType: {
      type: String,
      enum: [
        'osm',
        'google_maps',
        'searxng',
        'website_about',
        'website_contact',
        'website_team',
        'website_home',
        'website_services',
        'website_products',
        'website_leadership',
        'website_management',
        'gemini_analysis',
        'manual_entry',
        'other',
      ],
      default: 'other',
    },
    extractedField: {
      type: String,
      trim: true,
    },
    supportingText: {
      type: String,
      trim: true,
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);
