import { useEffect, useId, useState } from 'react';
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { toast } from '../../lib/toast';
import { IntakeSubmitError, PublicIntakeSubmission, type PublicIntakeValues } from './publicIntake';
import { consultationIntake, consultationNeeds, intakeFormFieldsSchema, intakeFormSchema } from './homeConsultation';

const headings = {
  landlord_consultation: 'Đăng ký tư vấn miễn phí', collaborator_registration: 'Đăng ký làm CTV',
  collaborator_consultation: 'Tư vấn cộng tác viên', general_contact: 'Liên hệ Homelax',
};

export function PublicIntakeForm({ kind, consultation = false }: { kind: PublicIntakeValues['kind']; consultation?: boolean }) {
  const titleId = useId();
  const [submission, setSubmission] = useState(() => new PublicIntakeSubmission());
  const [failure, setFailure] = useState<IntakeSubmitError | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [received, setReceived] = useState(false);
  const { register, control, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof intakeFormFieldsSchema>, unknown, z.output<typeof intakeFormFieldsSchema>>({
    resolver: zodResolver(intakeFormSchema(consultation)), defaultValues: { kind, name: '', phone: '', need: '', address: '', consultationNeed: '' },
  });
  const locked = isSubmitting || Boolean(failure?.uncertain);

  useEffect(() => {
    if (!retryAt) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  return <Paper component="section" variant="outlined" aria-labelledby={titleId} sx={{ p: consultation ? 0 : { xs: 2.5, sm: 3 }, border: consultation ? 0 : undefined, minWidth: 0, color: 'text.primary' }}>
    <Stack spacing={2.5}>
      <Box>
        <Typography id={titleId} component="h2" variant="h5" sx={{ fontWeight: 800 }}>{consultation ? 'Homelax tư vấn cho bạn' : headings[kind]}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Để lại thông tin để Homelax liên hệ với bạn.</Typography>
      </Box>
      {received ? <Stack spacing={2} role="status">
        <Box sx={{ color: 'success.main' }}><CheckCircle2 size={32} aria-hidden="true" /></Box>
        <Typography sx={{ fontWeight: 700 }}>Đã tiếp nhận yêu cầu của bạn</Typography>
        <Typography variant="body2" color="text.secondary">{kind === 'collaborator_registration'
          ? 'Homelax sẽ xem xét đăng ký và liên hệ với bạn. Tài khoản CTV cần được quản trị viên duyệt.'
          : 'Homelax sẽ liên hệ với bạn theo số điện thoại đã cung cấp.'}</Typography>
        <Button variant="outlined" onClick={() => {
          setSubmission(new PublicIntakeSubmission()); setReceived(false); setFailure(null); setRetryAt(0); setRemaining(0);
          reset({ kind, name: '', phone: '', need: '', address: '', consultationNeed: '' });
        }}>Gửi yêu cầu khác</Button>
      </Stack> : <Box component="form" noValidate aria-labelledby={titleId} aria-busy={isSubmitting}
        onSubmit={event => { void handleSubmit(async values => {
          try {
            await submission.submit(consultationIntake(values, consultation));
            setReceived(true); setFailure(null);
            toast.success('Homelax đã tiếp nhận yêu cầu của bạn.');
          } catch (error) {
            const result = error instanceof IntakeSubmitError ? error : new IntakeSubmitError('Chưa thể gửi yêu cầu. Vui lòng thử lại.', true);
            setFailure(result); setRemaining(result.retryAfterSeconds); setRetryAt(result.retryAfterSeconds ? Date.now() + result.retryAfterSeconds * 1000 : 0);
            toast.error(result.message);
          }
        })(event); }}>
        <Stack spacing={2}>
          <TextField {...register('name')} label="Họ và tên" required fullWidth autoComplete="name"
            error={Boolean(errors.name)} helperText={errors.name?.message} slotProps={{ input: { readOnly: locked }, htmlInput: { maxLength: 160 } }} />
          <TextField {...register('phone')} label="Số điện thoại" type="tel" required fullWidth autoComplete="tel"
            error={Boolean(errors.phone)} helperText={errors.phone?.message} slotProps={{ input: { readOnly: locked }, htmlInput: { maxLength: 32 } }} />
          {consultation && <>
            <TextField {...register('address')} label="Địa chỉ / khu vực" required fullWidth autoComplete="street-address"
              error={Boolean(errors.address)} helperText={errors.address?.message} slotProps={{ input: { readOnly: locked }, htmlInput: { maxLength: 320 } }} />
            <Controller name="consultationNeed" control={control} render={({ field }) => <TextField {...field} value={field.value ?? ''} select label="Bạn cần tư vấn về" required fullWidth
              error={Boolean(errors.consultationNeed)} helperText={errors.consultationNeed?.message} slotProps={{ input: { readOnly: locked } }}>
              {Object.entries(consultationNeeds).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>} />
          </>}
          <TextField {...register('need')} label={consultation ? 'Ghi chú (không bắt buộc)' : 'Nhu cầu (không bắt buộc)'} multiline minRows={consultation ? 2 : 3} maxRows={6} fullWidth
            error={Boolean(errors.need)} helperText={errors.need?.message} slotProps={{ input: { readOnly: locked }, htmlInput: { maxLength: consultation ? 3500 : 4000 } }} />
          {failure && <Alert severity="warning" role="alert">{failure.message}{remaining > 0 && ` Có thể gửi lại sau ${remaining} giây.`}</Alert>}
          <Button type="submit" variant="contained" fullWidth disabled={isSubmitting || remaining > 0} sx={{ minHeight: 44 }}
            startIcon={<Send size={17} />} endIcon={!isSubmitting && <ArrowRight size={17} />}>
            {isSubmitting ? 'Đang gửi…' : remaining > 0 ? `Vui lòng chờ ${remaining} giây` : failure ? 'Gửi lại yêu cầu' : 'Gửi yêu cầu'}
          </Button>
        </Stack>
      </Box>}
    </Stack>
  </Paper>;
}
