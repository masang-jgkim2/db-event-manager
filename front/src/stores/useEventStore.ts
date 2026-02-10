import { create } from 'zustand';
import type { IEventTemplate } from '../types';

// 이벤트 템플릿 관리 스토어
interface IEventStore {
  arrEvents: IEventTemplate[];
  fnAddEvent: (objEvent: Omit<IEventTemplate, 'nId' | 'dtCreatedAt'>) => void;
  fnUpdateEvent: (nId: number, objEvent: Partial<IEventTemplate>) => void;
  fnDeleteEvent: (nId: number) => void;
}

export const useEventStore = create<IEventStore>((set) => ({
  arrEvents: [],

  // 이벤트 추가
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

  // 이벤트 수정
  fnUpdateEvent: (nId, objEvent) =>
    set((state) => ({
      arrEvents: state.arrEvents.map((e) =>
        e.nId === nId ? { ...e, ...objEvent } : e
      ),
    })),

  // 이벤트 삭제
  fnDeleteEvent: (nId) =>
    set((state) => ({
      arrEvents: state.arrEvents.filter((e) => e.nId !== nId),
    })),
}));
