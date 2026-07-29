import { arrDbConnections, fnCommitDbConnectionsDataStore, fnSaveDbConnections } from '../data/dbConnections';
import { arrEvents, fnSaveEvents } from '../data/events';
import { arrEventInstances, fnCommitEventInstancesToStore } from '../data/eventInstances';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnMirrorJsonToDisk } from '../data/jsonStore';

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
