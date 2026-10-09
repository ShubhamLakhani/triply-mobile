export type PhotoErrorCode =
  | 'not_authenticated'
  | 'invalid_input'
  | 'not_found'
  | 'limit_reached'
  | 'not_allowed'
  | 'upload_failed'
  | 'unexpected_response'
  | 'unknown';

/** Typed error for the profile photos data layer. `message` is safe to log. */
export class PhotoError extends Error {
  readonly code: PhotoErrorCode;

  constructor(code: PhotoErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PhotoError';
    this.code = code;
  }
}

export function toPhotoError(error: { code?: string }): PhotoError {
  switch (error.code) {
    case '22023':
      return new PhotoError('invalid_input', 'Photo was rejected.', { cause: error });
    case 'P0002':
      return new PhotoError('not_found', 'Photo not found.', { cause: error });
    case '54000':
      return new PhotoError('limit_reached', 'You can add up to 6 photos.', { cause: error });
    case '42501':
      return new PhotoError('not_allowed', 'Not allowed.', { cause: error });
    default:
      return new PhotoError('unknown', 'Photo request failed.', { cause: error });
  }
}
