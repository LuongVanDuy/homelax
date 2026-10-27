import { useState } from 'react';

type OptionKey = string | number;

export function mergeStableAutocompleteOptions<T>(
  options: readonly T[],
  remembered: readonly T[],
  selectedKeys: readonly OptionKey[],
  getKey: (option: T) => OptionKey,
) {
  const selectedKeySet = new Set<OptionKey>(selectedKeys);
  const merged = [...options];
  const present = new Set<OptionKey>(merged.map(getKey));

  for (const option of remembered) {
    const key = getKey(option);
    if (!selectedKeySet.has(key) || present.has(key)) continue;
    merged.unshift(option);
    present.add(key);
  }

  return merged;
}

export function useStableAutocompleteOptions<T>(
  options: readonly T[],
  selectedKeys: readonly OptionKey[],
  getKey: (option: T) => OptionKey,
) {
  const [remembered, setRemembered] = useState<T[]>([]);
  const merged = mergeStableAutocompleteOptions(
    options,
    remembered,
    selectedKeys,
    getKey,
  );

  const rememberOption = (option: T | null | undefined) => {
    if (!option) return;
    const key = getKey(option);
    setRemembered((current) => {
      const existing = current.findIndex((item) => getKey(item) === key);
      if (existing < 0) return [...current, option];
      if (current[existing] === option) return current;
      const next = [...current];
      next[existing] = option;
      return next;
    });
  };

  return {
    options: merged,
    rememberOption,
  };
}

export function updateAutocompleteSearch(
  setSearch: (value: string) => void,
  value: string,
  reason: string,
) {
  // MUI also emits reset/selectOption/removeOption/blur when its own value changes.
  // Those internal changes must not become remote searches.
  if (reason === 'input') {
    setSearch(value);
  } else if (reason === 'clear') {
    setSearch('');
  }
}
