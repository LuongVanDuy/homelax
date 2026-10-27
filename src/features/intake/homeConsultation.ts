import { z } from 'zod';
import { publicIntakeFormSchema, type PublicIntakeValues } from './publicIntake';

export const consultationNeeds = {
  rent: 'Thuê phòng', fitout: 'Lắp phòng', management: 'Quản lý vận hành',
} as const;

export const intakeFormFieldsSchema = publicIntakeFormSchema.extend({
  address: z.string().trim().max(320).default(''),
  consultationNeed: z.enum(['', 'rent', 'fitout', 'management']).default(''),
});

export function intakeFormSchema(consultation: boolean) {
  return intakeFormFieldsSchema.superRefine((value, context) => {
    if (!consultation) return;
    if (!value.address) context.addIssue({ code: 'custom', path: ['address'], message: 'Vui lòng nhập địa chỉ hoặc khu vực.' });
    if (!value.consultationNeed) context.addIssue({ code: 'custom', path: ['consultationNeed'], message: 'Vui lòng chọn nhu cầu.' });
    if (value.need.length > 3500) context.addIssue({ code: 'custom', path: ['need'], message: 'Ghi chú tối đa 3500 ký tự.' });
  });
}

export function consultationIntake(values: z.output<typeof intakeFormFieldsSchema>, consultation: boolean): PublicIntakeValues {
  const { address, consultationNeed, ...base } = values;
  if (!consultation || !consultationNeed) return base;
  return {
    ...base,
    kind: consultationNeed === 'rent' ? 'general_contact' : 'landlord_consultation',
    need: `Nhu cầu: ${consultationNeeds[consultationNeed]}\nĐịa chỉ / khu vực: ${address}${base.need ? `\nGhi chú: ${base.need}` : ''}`,
  };
}
