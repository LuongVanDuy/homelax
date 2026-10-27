export function expectArrayResponse<T>(
  value: unknown,
  label: string,
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `API contract error: ${label} must return an array.`,
    );
  }

  return value as T[];
}

export function expectObjectResponse<T>(
  value: unknown,
  label: string,
): T {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      `API contract error: ${label} must return an object.`,
    );
  }

  return value as T;
}
