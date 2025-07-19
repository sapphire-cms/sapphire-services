import { OuterError } from '@sapphire-cms/core';
import { failure, success, SyncOutcome } from 'defectless';
import { Base64 } from 'js-base64';

export class DecodingError extends OuterError {
  public readonly _tag = 'DecodingError';

  constructor(cause?: unknown) {
    super('Failed to decode content from base64', cause);
  }
}

export class JsonParsingError extends OuterError {
  public readonly _tag = 'JsonParsingError';

  constructor(cause?: unknown) {
    super('Failed to parse JSON', cause);
  }
}

export function decodeBase64(encoded: string): SyncOutcome<string, DecodingError> {
  try {
    return success(Base64.decode(encoded));
  } catch (decodingError) {
    return failure(new DecodingError(decodingError));
  }
}

export function parseJson<T>(raw: string): SyncOutcome<T, JsonParsingError> {
  try {
    const parsed = JSON.parse(raw) as T;
    return success(parsed);
  } catch (parsingError) {
    return failure(new JsonParsingError(parsingError));
  }
}
