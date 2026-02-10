import { create } from 'zustand';
import type { IEventTemplate } from '../types';

interface IEventStore {
  arrEvents: IEventTemplate[];
  fnSetEvents: (arrEvents: IEventTemplate[]) => void;
  fnAddEvent: (objEvent: Omit<IEventTemplate, 'nId' | 'dtCreatedAt'>) => void;
  fnUpdateEvent: (nId: number, objEvent: Partial<IEventTemplate>) => void;
  fnDeleteEvent: (nId: number) => void;
}

export const useEventStore = create<IEventStore>((set) => ({
  arrEvents: [],

  fnSetEvents: (arrEvents) => set({ arrEvents }),

  fnAddEvent: (objEvent) =>
    set((state) => ({
      arrEvents: [
        ...state.arrEvents,
        {
          ...objEvent,
          nId: Date.now(),
          dtCreatedAt: new Date().toISOString(),
        },
      ],
    })),

  fnUpdateEvent: (nId, objEvent) =>
    set((state) => ({
      arrEvents: state.arrEvents.map((e) =>
        e.nId === nId ? { ...e, ...objEvent } : e
      ),
    })),

  fnDeleteEvent: (nId) =>
    set((state) => ({
      arrEvents: state.arrEvents.filter((e) => e.nId !== nId),
    })),
}));
