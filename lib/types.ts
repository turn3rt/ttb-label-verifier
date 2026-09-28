export type ApplicationFields = {
  brand: string;
  classType: string;
  abv: string;
  netContents: string;
  governmentWarning: string;
};

export type ExtractedFields = ApplicationFields & {
  /** Whether the GOVERNMENT WARNING: header appears bold on the label. */
  warningHeaderBold?: boolean;
};

export type FieldKey = keyof ApplicationFields;

export type FieldResult = {
  field: FieldKey;
  rule: "fuzzy" | "exact";
  pass: boolean;
  application: string;
  extracted: string;
  detail?: string;
};

export type FileVerifyResult = {
  fileName: string;
  overallPass: boolean;
  fields: FieldResult[];
  extracted: ExtractedFields;
  error?: string;
  elapsedMs: number;
};

export type VerifyResponse = {
  results: FileVerifyResult[];
  elapsedMs: number;
  provider: string;
};
