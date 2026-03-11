import { fnLoadJson, fnSaveJson } from './jsonStore';

export interface IEventTemplate {
  nId: number;
  nProductId: number;
  strProductName: string;
  strEventLabel: string;
  strDescription: string;
  strCategory: string;
  strType: string;
  strInputFormat: string;
  strDefaultItems: string;
  strQueryTemplate: string;
  dtCreatedAt: string;
}

const STR_FILE = 'events.json';

export const arrEvents: IEventTemplate[] = fnLoadJson<IEventTemplate>(STR_FILE, []);

export const fnSaveEvents = () => fnSaveJson(STR_FILE, arrEvents);

export const fnGetNextEventId = (): number =>
  arrEvents.length > 0 ? Math.max(...arrEvents.map((e) => e.nId)) + 1 : 1;
