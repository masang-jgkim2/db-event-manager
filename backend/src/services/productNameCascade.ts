import { arrDbConnections, fnCommitDbConnectionsDataStore, fnSaveDbConnections } from '../data/dbConnections';
import { arrEvents, fnSaveEvents } from '../data/events';
import { arrEventInstances, fnCommitEventInstancesToStore } from '../data/eventInstances';
import type { IService } from '../data/products';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnMirrorJsonToDisk } from '../data/jsonStore';

/**
 * 서비스 약자만 바꾼 경우(nServiceId 유지) DB 접속 denormalized strServiceAbbr 갱신.
 * 인스턴스 스냅샷(strServiceAbbr)은 생성 시점 값으로 유지.
 */
export const fnCascadeProductServiceAbbr = async (
  nProductId: number,
  arrBefore: IService[],
  arrAfter: IService[],
): Promise<number> => {
  const mapAbbrById = new Map<number, string>();
  for (const objAfter of arrAfter) {
    const nSvcId = Number(objAfter.nServiceId);
    if (!(nSvcId > 0)) continue;
    const objBefore = arrBefore.find((s) => Number(s.nServiceId) === nSvcId);
    if (!objBefore) continue;
    if ((objBefore.strAbbr ?? '').trim() === (objAfter.strAbbr ?? '').trim()) continue;
    mapAbbrById.set(nSvcId, objAfter.strAbbr);
  }
  if (mapAbbrById.size === 0) return 0;

  let nDbConnections = 0;
  for (const objConn of arrDbConnections) {
    if (objConn.nProductId !== nProductId) continue;
    const nConnSvc = Number(objConn.nServiceId);
    if (!(nConnSvc > 0) || !mapAbbrById.has(nConnSvc)) continue;
    const strNewAbbr = mapAbbrById.get(nConnSvc)!;
    if ((objConn.strServiceAbbr ?? '').trim() === strNewAbbr.trim()) continue;
    objConn.strServiceAbbr = strNewAbbr;
    nDbConnections += 1;
  }

  if (nDbConnections > 0) {
    fnSaveDbConnections();
    if (fnIsMysqlStore()) {
      await fnCommitDbConnectionsDataStore();
    }
    console.log(
      `[products] 서비스 약자 연쇄 반영 | nProductId=${nProductId} | db=${nDbConnections} | ` +
        `ids=${[...mapAbbrById.keys()].join(',')}`,
    );
  }
  return nDbConnections;
};

/** 프로덕트명 변경 시 nProductId 기준 denormalized strProductName 연쇄 반영 */
export const fnCascadeProductDisplayName = async (
  nProductId: number,
  strNewName: string,
): Promise<{ nDbConnections: number; nEvents: number; nInstances: number }> => {
  let nDbConnections = 0;
  for (const objConn of arrDbConnections) {
    if (objConn.nProductId === nProductId && objConn.strProductName !== strNewName) {
      objConn.strProductName = strNewName;
      nDbConnections += 1;
    }
  }

  let nEvents = 0;
  for (const objEv of arrEvents) {
    if (objEv.nProductId === nProductId && objEv.strProductName !== strNewName) {
      objEv.strProductName = strNewName;
      nEvents += 1;
    }
  }

  let nInstances = 0;
  for (const objInst of arrEventInstances) {
    if (objInst.nProductId === nProductId && objInst.strProductName !== strNewName) {
      objInst.strProductName = strNewName;
      nInstances += 1;
    }
  }

  if (nDbConnections > 0) {
    fnSaveDbConnections();
    if (fnIsMysqlStore()) {
      await fnCommitDbConnectionsDataStore();
    }
  }

  if (nEvents > 0) {
    if (fnIsMysqlStore()) {
      const pool = fnGetMysqlAppPool();
      await pool.execute('UPDATE event_template SET str_product_name = ? WHERE n_product_id = ?', [
        strNewName,
        nProductId,
      ]);
      fnMirrorJsonToDisk('events.json', arrEvents);
    } else {
      fnSaveEvents();
    }
  }

  if (nInstances > 0) {
    if (fnIsMysqlStore()) {
      const pool = fnGetMysqlAppPool();
      await pool.execute('UPDATE event_instance SET str_product_name = ? WHERE n_product_id = ?', [
        strNewName,
        nProductId,
      ]);
    }
    await fnCommitEventInstancesToStore();
  }

  if (nDbConnections > 0 || nEvents > 0 || nInstances > 0) {
    console.log(
      `[products] 프로덕트명 연쇄 반영 | nProductId=${nProductId} | name=${strNewName} | ` +
        `db=${nDbConnections} template=${nEvents} instance=${nInstances}`,
    );
  }

  return { nDbConnections, nEvents, nInstances };
};
