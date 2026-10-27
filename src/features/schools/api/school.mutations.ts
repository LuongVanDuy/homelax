import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  schoolSchema,
  schoolWriteSchema,
  type SchoolWrite,
} from '@tinyhouse/contracts';
import { ApiClient } from '../../../services/apiClient';
import { schoolKeys } from './school.keys';

function useSchoolInvalidation() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: schoolKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['rooms', 'public-search'] }),
    queryClient.invalidateQueries({ queryKey: ['buildings'] }),
  ]);
}

export function useSaveSchoolMutation() {
  const invalidate = useSchoolInvalidation();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: SchoolWrite }) => {
      const body = schoolWriteSchema.parse(data);
      const response = id
        ? await ApiClient.put(`/v2/schools/${encodeURIComponent(id)}`, body)
        : await ApiClient.post('/v2/schools', body);
      return schoolSchema.parse(response);
    },
    onSuccess: invalidate,
  });
}

export function useArchiveSchoolMutation() {
  const invalidate = useSchoolInvalidation();
  return useMutation({
    mutationFn: async (id: string) =>
      schoolSchema.parse(await ApiClient.post(
        `/v2/schools/${encodeURIComponent(id)}/archive`,
        {},
      )),
    onSuccess: invalidate,
  });
}

export function useRestoreSchoolMutation() {
  const invalidate = useSchoolInvalidation();
  return useMutation({
    mutationFn: async (id: string) =>
      schoolSchema.parse(await ApiClient.post(
        `/v2/schools/${encodeURIComponent(id)}/restore`,
        {},
      )),
    onSuccess: invalidate,
  });
}

export function useDeleteSchoolMutation() {
  const invalidate = useSchoolInvalidation();
  return useMutation({
    mutationFn: (id: string) =>
      ApiClient.delete(`/v2/schools/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}
