function normalizePublicOption(value: unknown) {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export type PublicOption = { value: string; label: string; group?: string };

export function filterPublicOptions(options: PublicOption[], { inputValue }: { inputValue: string }) {
  const query = normalizePublicOption(inputValue);
  return options.filter((option) => normalizePublicOption(option.label).includes(query)
    || normalizePublicOption(option.value).includes(query));
}
