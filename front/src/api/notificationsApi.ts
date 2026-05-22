import apiClient from './axiosInstance';
import type { INotification, INotificationInput } from '../stores/useNotificationStore';

export const fnApiGetNotifications = async (): Promise<{
  bSuccess: boolean;
  bPersisted?: boolean;
  arrNotifications?: INotification[];
  strMessage?: string;
}> => {
  const res = await apiClient.get('/notifications');
  return res.data;
};

export const fnApiPostNotification = async (objInput: INotificationInput): Promise<{
  bSuccess: boolean;
  objNotification?: INotification;
  strMessage?: string;
}> => {
  const res = await apiClient.post('/notifications', objInput);
  return res.data;
};

export const fnApiPatchNotificationRead = async (strId: string): Promise<{
  bSuccess: boolean;
  bUpdated?: boolean;
  strMessage?: string;
}> => {
  const res = await apiClient.patch(`/notifications/${encodeURIComponent(strId)}/read`);
  return res.data;
};

export const fnApiPatchNotificationsReadAll = async (): Promise<{
  bSuccess: boolean;
  strMessage?: string;
}> => {
  const res = await apiClient.patch('/notifications/read-all');
  return res.data;
};
