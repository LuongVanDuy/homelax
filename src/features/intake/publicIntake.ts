import { intakeCreateSchema, intakeReceiptSchema, normalizeAccountPhone, type IntakeCreate } from '@tinyhouse/contracts';

export const publicIntakeFormSchema = intakeCreateSchema.omit({ requestKey: true });
export type PublicIntakeValues = Omit<IntakeCreate, 'requestKey'>;
type Receipt = { success: true; receiptId: string };

export class IntakeSubmitError extends Error {
  constructor(message: string, readonly uncertain = false, readonly retryAfterSeconds = 0) { super(message); }
}

export async function postPublicIntake(input: IntakeCreate): Promise<Receipt> {
  let response: Response;
  try {
    // This public write is independent of login/refresh and is never replayed automatically.
    response = await fetch('/api/v2/public/intake', {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input), signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new IntakeSubmitError('Chưa xác nhận được kết quả. Vui lòng gửi lại yêu cầu này khi kết nối ổn định.', true);
  }
  const data = await response.json().catch(() => null);
  if (response.status === 429) {
    const seconds = Number(data?.retryAfterSeconds ?? response.headers.get('Retry-After'));
    throw new IntakeSubmitError('Bạn đã gửi nhiều yêu cầu. Vui lòng chờ rồi gửi lại.', false,
      Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60);
  }
  if (!response.ok) {
    if (response.status === 400 || response.status === 422) throw new IntakeSubmitError('Thông tin chưa hợp lệ. Vui lòng kiểm tra họ tên, số điện thoại và nhu cầu.');
    if (response.status === 409) throw new IntakeSubmitError('Lần gửi chưa hợp lệ. Vui lòng nhấn gửi lại.');
    throw new IntakeSubmitError('Chưa xác nhận được kết quả. Vui lòng gửi lại yêu cầu này sau ít phút.', true);
  }
  const receipt = intakeReceiptSchema.safeParse(data);
  if (!receipt.success) throw new IntakeSubmitError('Chưa xác nhận được kết quả. Vui lòng gửi lại yêu cầu này.', true);
  return receipt.data;
}

/** One form lifetime: keep the exact request across uncertain responses and manual retries. */
export class PublicIntakeSubmission {
  private request?: IntakeCreate;
  private pending?: Promise<Receipt>;
  private receipt?: Receipt;
  private uncertain = false;
  private retryAt = 0;

  constructor(private readonly send = postPublicIntake) {}

  submit(values: PublicIntakeValues): Promise<Receipt> {
    if (this.pending) return this.pending;
    if (this.receipt) return Promise.resolve(this.receipt);
    const remaining = Math.ceil((this.retryAt - Date.now()) / 1000);
    if (remaining > 0) return Promise.reject(new IntakeSubmitError('Vui lòng chờ rồi gửi lại.', false, remaining));
    const parsed = publicIntakeFormSchema.parse(values);
    const canonical = { ...parsed, phone: normalizeAccountPhone(parsed.phone) };
    // An uncertain result must be resolved with the original payload before allowing edits.
    if (!this.uncertain && (!this.request || JSON.stringify({ ...this.request, requestKey: undefined }) !== JSON.stringify(canonical))) {
      this.request = { ...canonical, requestKey: crypto.randomUUID() };
    }
    const input = this.request!;
    this.pending = this.send(input).then(receipt => {
      this.receipt = receipt;
      this.uncertain = false;
      return receipt;
    }).catch((error: unknown) => {
      const failure = error instanceof IntakeSubmitError ? error : new IntakeSubmitError('Chưa xác nhận được kết quả. Vui lòng gửi lại yêu cầu này.', true);
      this.uncertain = failure.uncertain;
      this.retryAt = Date.now() + failure.retryAfterSeconds * 1000;
      if (!failure.uncertain && !failure.retryAfterSeconds) this.request = undefined;
      throw failure;
    }).finally(() => { this.pending = undefined; });
    return this.pending;
  }
}
