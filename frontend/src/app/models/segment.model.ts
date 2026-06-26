export interface Segment {
  id: number;
  name: string;
  label_fr: string;
  label_translations?: Record<string, string>;
}

export interface SegmentCreate {
  name: string;
  label_fr: string;
  label_translations?: Record<string, string>;
}
