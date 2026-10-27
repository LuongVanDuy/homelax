import { ConflictException } from '@nestjs/common';

/** Unique indexes are the final arbiter, including concurrent and non-HTTP writes. */
export function rethrowAccountContactError(error: unknown): never {
  const failure = error as { code?: string; constraint?: string };
  const field = failure.constraint?.includes('phone') ? 'phone' : failure.constraint?.includes('email') ? 'email' : null;
  if (failure.code === '23505' && field) {
    const message = field === 'phone' ? 'Số điện thoại đã được sử dụng bởi tài khoản khác.' : 'Email đã tồn tại.';
    throw new ConflictException({ success: false, error: message, details: [{ path: field, message }] });
  }
  throw error;
}
