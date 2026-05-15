import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from './useAuthStore';

export type TNotificationLevel = 'success' | 'error' | 'warning' | 'info';

export interface INotification {
  strId: string;
  dtAt: string;
  strLevel: TNotificationLevel;
  strTitle: string;
  strBody?: string;
  strRoute?: string;
  objQuery?: Record<string, string | number | boolean>;
  bRead: boolean;
  strSource?: string;
}

export interface INotificationInput {
  strLevel: TNotificationLevel;
  strTitle: string;
  strBody?: string;
  strRoute?: string;
  objQuery?: Record<string, string | number | boolean>;
  strSource?: string;
}

const N_MAX_NOTIFICATIONS = 100;
const STR_PERSIST_NAME = 'db-event-manager-notifications';

const notificationPersistStorage = {
  getItem: (strName: string): string | null => {
    const nId = useAuthStore.getState().user?.nId ?? 0;
    const strKey = nId > 0 ? `dbem:u${nId}:${strName}` : `dbem:guest:${strName}`;
    return localStorage.getItem(strKey);
  },
  setItem: (strName: string, strValue: string): void => {
    const nId = useAuthStore.getState().user?.nId ?? 0;
    const strKey = nId > 0 ? `dbem:u${nId}:${strName}` : `dbem:guest:${strName}`;
    localStorage.setItem(strKey, strValue);
  },
  removeItem: (strName: string): void => {
    const nId = useAuthStore.getState().user?.nId ?? 0;
    const strKey = nId > 0 ? `dbem:u${nId}:${strName}` : `dbem:guest:${strName}`;
    localStorage.removeItem(strKey);
  },
};

interface INotificationStore {
  arrNotifications: INotification[];
  fnPush: (objInput: INotificationInput) => INotification;
  fnReplaceFromServer: (arrNotifications: INotification[]) => void;
  fnUpsertFromServer: (objNotification: INotification) => void;
  fnMarkRead: (strId: string) => void;
  fnMarkAllRead: () => void;
  fnClear: () => void;
  fnGetUnreadCount: () => number;
}

export const useNotificationStore = create<INotificationStore>()(
  persist(
    (set, get) => ({
      arrNotifications: [],

      fnPush: (objInput) => {
        const objNew: INotification = {
          strId: crypto.randomUUID(),
          dtAt: new Date().toISOString(),
          bRead: false,
          ...objInput,
        };
        set((state) => {
          const arrNext = [objNew, ...state.arrNotifications];
          if (arrNext.length > N_MAX_NOTIFICATIONS) {
            arrNext.length = N_MAX_NOTIFICATIONS;
          }
          return { arrNotifications: arrNext };
        });
        return objNew;
      },

      fnReplaceFromServer: (arrNotifications) => {
        const arrNext = [...arrNotifications]
          .sort((objA, objB) => objB.dtAt.localeCompare(objA.dtAt))
          .slice(0, N_MAX_NOTIFICATIONS);
        set({ arrNotifications: arrNext });
      },

      fnUpsertFromServer: (objNotification) => {
        set((state) => {
          const nIdx = state.arrNotifications.findIndex((objItem) => objItem.strId === objNotification.strId);
          if (nIdx >= 0) {
            const arrNext = [...state.arrNotifications];
            arrNext[nIdx] = objNotification;
            return { arrNotifications: arrNext };
          }
          const arrNext = [objNotification, ...state.arrNotifications];
          if (arrNext.length > N_MAX_NOTIFICATIONS) {
            arrNext.length = N_MAX_NOTIFICATIONS;
          }
          return { arrNotifications: arrNext };
        });
      },

      fnMarkRead: (strId) => {
        set((state) => ({
          arrNotifications: state.arrNotifications.map((objItem) => (
            objItem.strId === strId ? { ...objItem, bRead: true } : objItem
          )),
        }));
      },

      fnMarkAllRead: () => {
        set((state) => ({
          arrNotifications: state.arrNotifications.map((objItem) => (
            objItem.bRead ? objItem : { ...objItem, bRead: true }
          )),
        }));
      },

      fnClear: () => set({ arrNotifications: [] }),

      fnGetUnreadCount: () => get().arrNotifications.filter((objItem) => !objItem.bRead).length,
    }),
    {
      name: STR_PERSIST_NAME,
      storage: createJSONStorage(() => notificationPersistStorage),
      skipHydration: true,
      partialize: (state) => ({
        arrNotifications: state.arrNotifications,
      }),
    },
  ),
);
