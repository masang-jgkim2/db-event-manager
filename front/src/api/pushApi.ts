import apiClient from './axiosInstance';

export const fnApiGetPushVapidPublicKey = async (): Promise<{
  bSuccess: boolean;
  bEnabled?: boolean;
  strPublicKey?: string | null;
  strMessage?: string;
}> => {
  const res = await apiClient.get('/push/vapid-public-key');
  return res.data;
};

export const fnApiPostPushSubscribe = async (objSubscription: PushSubscriptionJSON): Promise<{
  bSuccess: boolean;
  strMessage?: string;
}> => {
  const res = await apiClient.post('/push/subscribe', { objSubscription });
  return res.data;
};

export const fnApiDeletePushSubscribe = async (strEndpoint: string): Promise<{
  bSuccess: boolean;
  bDeleted?: boolean;
  strMessage?: string;
}> => {
  const res = await apiClient.delete('/push/subscribe', { data: { strEndpoint } });
  return res.data;
};
