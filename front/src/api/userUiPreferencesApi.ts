import apiClient from './axiosInstance';

export const fnApiGetUiPreferences = async (): Promise<{
  bSuccess: boolean;
  objEntries?: Record<string, string>;
  strMessage?: string;
}> => {
  const res = await apiClient.get('/auth/ui-preferences');
  return res.data;
};

export const fnApiPutUiPreferences = async (
  objEntries: Record<string, string>,
): Promise<{ bSuccess: boolean; strMessage?: string }> => {
  const res = await apiClient.put('/auth/ui-preferences', { objEntries });
  return res.data;
};
