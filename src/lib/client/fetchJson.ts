export const fetchJsonOrThrow = async <T>(
  input: RequestInfo | URL,
  init: RequestInit,
  defaultErrorMessage: string
): Promise<T> => {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type') ?? '';
  const isJsonResponse = contentType.includes('application/json');

  const payload = isJsonResponse ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const errorMessage =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : defaultErrorMessage;
    throw new Error(errorMessage);
  }

  if (!isJsonResponse) {
    throw new Error(defaultErrorMessage);
  }

  return payload as T;
};
