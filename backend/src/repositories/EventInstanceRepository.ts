import { IEventInstance } from '../types';
import { arrEventInstances, fnGetNextInstanceId } from '../data/eventInstances';
import { TEventStatus } from '../data/eventInstances';

// 이벤트 인스턴스 Repository - 인메모리 구현체
export class EventInstanceRepository {
  async findAll(strFilter?: string, nUserId?: number, arrUserRoles?: string[]): Promise<IEventInstance[]> {
    let arrFiltered = [...arrEventInstances];

    if (strFilter === 'involved' && nUserId) {
      arrFiltered = arrFiltered.filter((e) =>
        e.objCreator?.nUserId === nUserId ||
        e.objConfirmer?.nUserId === nUserId ||
        e.objQaRequester?.nUserId === nUserId ||
        e.objQaDeployer?.nUserId === nUserId ||
        e.objQaVerifier?.nUserId === nUserId ||
        e.objLiveRequester?.nUserId === nUserId ||
        e.objLiveDeployer?.nUserId === nUserId ||
        e.objLiveVerifier?.nUserId === nUserId
      );
    } else if (strFilter === 'mine' && nUserId) {
      arrFiltered = arrFiltered.filter((e) => e.nCreatedByUserId === nUserId);
    } else if (strFilter === 'my_action' && arrUserRoles) {
      // 상태 전이 허용 역할 체크 (컨트롤러에서 전이 규칙 주입받는 방식이 더 깔끔하지만
      // 현재 인메모리 구조에서는 단순화)
      arrFiltered = arrFiltered.filter((e) => e.strStatus !== 'live_verified');
    }

    return arrFiltered.sort(
      (a, b) => new Date(b.dtCreatedAt).getTime() - new Date(a.dtCreatedAt).getTime()
    );
  }

  async findById(nId: number): Promise<IEventInstance | null> {
    return arrEventInstances.find((e) => e.nId === nId) ?? null;
  }

  // 참조를 직접 반환 (인메모리에서 객체 직접 수정용)
  findByIdRef(nId: number): IEventInstance | undefined {
    return arrEventInstances.find((e) => e.nId === nId);
  }

  async create(objData: Omit<IEventInstance, 'nId'>): Promise<IEventInstance> {
    const objNew: IEventInstance = { nId: fnGetNextInstanceId(), ...objData };
    arrEventInstances.push(objNew);
    return objNew;
  }

  async updateStatus(nId: number, strNextStatus: TEventStatus): Promise<IEventInstance | null> {
    const objInstance = arrEventInstances.find((e) => e.nId === nId);
    if (!objInstance) return null;
    objInstance.strStatus = strNextStatus;
    return objInstance;
  }

  async update(nId: number, objData: Partial<IEventInstance>): Promise<IEventInstance | null> {
    const nIdx = arrEventInstances.findIndex((e) => e.nId === nId);
    if (nIdx === -1) return null;
    Object.assign(arrEventInstances[nIdx], objData);
    return arrEventInstances[nIdx];
  }

  async delete(nId: number): Promise<boolean> {
    const nIdx = arrEventInstances.findIndex((e) => e.nId === nId);
    if (nIdx === -1) return false;
    arrEventInstances.splice(nIdx, 1);
    return true;
  }
}

export const eventInstanceRepository = new EventInstanceRepository();
