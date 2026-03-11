import { createContext, useContext } from 'react';
import type { IDesignSystem } from './design-system';
import { fnBuildDesignSystem } from './design-system';

// 기본값 — 실제로는 App에서 항상 주입되므로 fallback용
const OBJ_DEFAULT_DS = fnBuildDesignSystem('#667eea', false, 14);

export const DesignSystemContext = createContext<IDesignSystem>(OBJ_DEFAULT_DS);

export function useDesignSystem(): IDesignSystem {
  return useContext(DesignSystemContext);
}
