/**
 * 워크플로 단계 → getdesign Cursor 타임라인 파스텔
 * @see front/DESIGN.md colors.timeline-*
 * @see OBJ_CURSOR_TIMELINE
 */

import type { TEventStatus } from '../types';
import { OBJ_CURSOR_TIMELINE } from './cursorSiteTokens';

/** 이벤트 상태별 타임라인·스텝 아이콘 색 */
export function fnStatusTimelineColor(strStatus: TEventStatus): string {
  switch (strStatus) {
    case 'event_created':
    case 'confirm_requested':
      return OBJ_CURSOR_TIMELINE.thinking;
    case 'dba_confirmed':
      return OBJ_CURSOR_TIMELINE.read;
    case 'qa_requested':
    case 'qa_deployed':
      return OBJ_CURSOR_TIMELINE.grep;
    case 'qa_verified':
      return OBJ_CURSOR_TIMELINE.edit;
    case 'live_requested':
    case 'live_deployed':
      return OBJ_CURSOR_TIMELINE.edit;
    case 'live_verified':
      return OBJ_CURSOR_TIMELINE.done;
    default:
      return OBJ_CURSOR_TIMELINE.read;
  }
}
