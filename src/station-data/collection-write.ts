export class CollectionLeaseLostError extends Error {
  constructor() {
    super('Collection lease lost');
  }
}

export type CollectionWriteOptions = Readonly<{
  holderId: string;
  canCommit?: () => boolean;
  checkpoint?: Readonly<{
    resumeAt?: Date;
    nextAttemptAt: Date;
    outcome:
      | 'success'
      | 'upstream_error'
      | 'source_error'
      | 'database_error'
      | 'invalid'
      | 'saturated'
      | 'budget'
      | 'storage_limit';
    failed?: boolean;
    successfulFetchAt?: Date;
  }>;
}>;
