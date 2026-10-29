import { useEffect, useState } from 'react';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from '../../lib/toast';
import { HanoiWardSelect } from '../locations/components/HanoiWardSelect';
import { IntakeSubmitError, PublicIntakeSubmission, publicIntakeFormSchema } from '../intake/publicIntake';
import { landlordContact, landlordServiceGroups, type LandlordRole } from './landlordContent';

type Values = { role: LandlordRole | ''; issue: string; name: string; phone: string; ward: string; propertyType: string; rooms: string; note: string };
type Errors = Partial<Record<keyof Values, string>>;

const emptyValues = (role: LandlordRole | ''): Values => ({
  role, issue: '', name: '', phone: '', ward: '', propertyType: landlordContact.propertyTypes[0], rooms: '', note: '',
});

/** Landlord intake: extra fields travel in `need`, so the existing public intake API stays unchanged. */
function intakeNeed(values: Values) {
  return [
    `Vai trò: ${values.role ? landlordContact.roles[values.role] : ''}`,
    // Service titles carry non-breaking spaces for display; store plain text.
    values.issue && `Vấn đề cần hỗ trợ: ${values.issue.replace(/ /g, ' ')}`,
    `Khu vực: ${values.ward}`,
    `Loại hình: ${values.propertyType}`,
    values.rooms && `Số lượng phòng/căn: ${values.rooms}`,
    values.note && `Ghi chú: ${values.note}`,
  ].filter(Boolean).join('\n');
}

export function LandlordConsultationForm({ role }: { role: LandlordRole | '' }) {
  const [values, setValues] = useState<Values>(() => emptyValues(role));
  const [errors, setErrors] = useState<Errors>({});
  const [submission, setSubmission] = useState(() => new PublicIntakeSubmission());
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<IntakeSubmitError | null>(null);
  const [received, setReceived] = useState(false);

  // "Tôi là chủ nhà / đơn vị thầu" buttons preselect the role.
  useEffect(() => { if (role) setValues(current => ({ ...current, role })); }, [role]);

  const set = <K extends keyof Values>(key: K) => (value: Values[K]) => {
    setValues(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  };

  const submit = async () => {
    const next: Errors = {};
    if (!values.role) next.role = 'Vui lòng chọn vai trò.';
    if (!values.ward) next.ward = 'Vui lòng chọn khu vực.';
    if (values.rooms && !/^\d{1,5}$/.test(values.rooms.trim())) next.rooms = 'Nhập số phòng/căn.';
    const parsed = publicIntakeFormSchema.safeParse({ kind: 'landlord_consultation', name: values.name, phone: values.phone, need: intakeNeed(values) });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'need' ? 'note' : issue.path[0];
        if (key === 'name' || key === 'phone' || key === 'note') next[key] ??= issue.message;
      }
    }
    setErrors(next);
    if (Object.keys(next).length || !parsed.success) return;
    setBusy(true);
    try {
      await submission.submit(parsed.data);
      setReceived(true); setFailure(null);
      toast.success('Homelax đã tiếp nhận yêu cầu của bạn.');
    } catch (error) {
      const result = error instanceof IntakeSubmitError ? error : new IntakeSubmitError('Chưa thể gửi yêu cầu. Vui lòng thử lại.', true);
      setFailure(result);
      toast.error(result.message);
    } finally { setBusy(false); }
  };

  if (received) return <Stack spacing={2} role="status" sx={{ py: 4, alignItems: 'flex-start' }}>
    <Box sx={{ color: 'success.main' }}><CheckCircle2 size={36} aria-hidden="true" /></Box>
    <Typography sx={{ fontWeight: 800, fontSize: '1.25rem' }}>Đã tiếp nhận yêu cầu của bạn</Typography>
    <Typography color="text.secondary">Homelax sẽ liên hệ theo số điện thoại bạn đã cung cấp để trao đổi phương án phù hợp.</Typography>
    <Button variant="outlined" onClick={() => {
      setSubmission(new PublicIntakeSubmission()); setValues(emptyValues(role)); setReceived(false); setFailure(null);
    }}>Gửi yêu cầu khác</Button>
  </Stack>;

  const locked = busy || Boolean(failure?.uncertain);
  const half = { gridColumn: { xs: '1 / -1', sm: 'auto' } };
  return <Box component="form" noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit(); }}
    sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
    <TextField select label="Bạn đang là" required value={values.role} onChange={event => set('role')(event.target.value as LandlordRole)}
      error={Boolean(errors.role)} helperText={errors.role} disabled={locked} sx={half}>
      <MenuItem value="" disabled>-- Chọn vai trò --</MenuItem>
      {Object.entries(landlordContact.roles).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
    </TextField>
    <TextField select label="Vấn đề cần hỗ trợ (tùy chọn)" value={values.issue} onChange={event => set('issue')(event.target.value)} disabled={locked} sx={half}>
      <MenuItem value="">-- Chọn nhu cầu chính --</MenuItem>
      {landlordServiceGroups.items.map(item => <MenuItem key={item.title} value={item.title}>{item.title}</MenuItem>)}
    </TextField>
    <TextField label="Họ và tên" required placeholder="Nguyễn Văn A" autoComplete="name" value={values.name} onChange={event => set('name')(event.target.value)}
      error={Boolean(errors.name)} helperText={errors.name} disabled={locked} slotProps={{ htmlInput: { maxLength: 160 } }} sx={half} />
    <TextField label="Số điện thoại" required type="tel" placeholder="0912 345 678" autoComplete="tel" value={values.phone} onChange={event => set('phone')(event.target.value)}
      error={Boolean(errors.phone)} helperText={errors.phone} disabled={locked} slotProps={{ htmlInput: { maxLength: 32, inputMode: 'tel' } }} sx={half} />
    <Box sx={{ gridColumn: '1 / -1' }}>
      <HanoiWardSelect label="Khu vực tòa nhà tại Hà Nội *" allLabel="-- Chọn khu vực tại Hà Nội --" value={values.ward}
        onChange={ward => set('ward')(ward === 'all' ? '' : ward)} error={Boolean(errors.ward)} helperText={errors.ward} disabled={locked} />
    </Box>
    <TextField select label="Loại hình bất động sản" value={values.propertyType} onChange={event => set('propertyType')(event.target.value)} disabled={locked} sx={half}>
      {landlordContact.propertyTypes.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
    </TextField>
    <TextField label="Số lượng phòng/căn (tùy chọn)" placeholder="Ví dụ: 12" value={values.rooms} onChange={event => set('rooms')(event.target.value)}
      error={Boolean(errors.rooms)} helperText={errors.rooms} disabled={locked} slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 5 } }} sx={half} />
    <TextField label="Ghi chú thêm (tùy chọn)" multiline minRows={3} maxRows={8} value={values.note} onChange={event => set('note')(event.target.value)}
      placeholder="Ví dụ: Đang vận hành 30 phòng đã kín khách, cần hỗ trợ CSKH, đối soát công nợ và hồ sơ thuế…"
      error={Boolean(errors.note)} helperText={errors.note} disabled={locked} slotProps={{ htmlInput: { maxLength: 3000 } }} sx={{ gridColumn: '1 / -1' }} />
    {failure && <Alert severity="warning" role="alert" sx={{ gridColumn: '1 / -1' }}>{failure.message}</Alert>}
    <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ gridColumn: '1 / -1', minHeight: 52, fontWeight: 800, fontSize: '1rem' }}>
      {busy ? 'Đang gửi…' : failure ? 'Gửi lại yêu cầu' : 'Gửi Yêu Cầu Tư Vấn'}
    </Button>
    <Stack direction="row" sx={{ gridColumn: '1 / -1', gap: 1, alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
      <ShieldCheck size={16} aria-hidden="true" />
      <Typography variant="body2">{landlordContact.privacy}</Typography>
    </Stack>
  </Box>;
}
