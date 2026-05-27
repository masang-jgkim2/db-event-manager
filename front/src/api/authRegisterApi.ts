import apiClient from './axiosInstance';

export interface ICheckRegisterResponse {
  bSuccess: boolean;
  bUserIdAvailable?: boolean | null;
  bEmailAvailable?: boolean | null;
  strEmail?: string;
  strMessage?: string;
}

export const fnApiCheckRegister = async (objParams: {
  strUserId?: string;
  strEmailLocal?: string;
}): Promise<ICheckRegisterResponse> => {
  const res = await apiClient.get<ICheckRegisterResponse>('/auth/check-register', { params: objParams });
  return res.data;
};

export const fnApiRegister = async (objBody: {
  strUserId: string;
  strEmail: string;
  strDisplayName: string;
  strPassword: string;
}): Promise<{ bSuccess: boolean; strMessage?: string; strMaskedEmail?: string }> => {
  const res = await apiClient.post('/auth/register', objBody);
  return res.data;
};
