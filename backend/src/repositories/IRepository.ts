// 공통 Repository 인터페이스
// 인메모리 구현체와 DB 구현체가 동일한 인터페이스를 구현하게 함으로써
// 향후 DB 전환 시 컨트롤러 코드 변경 없이 교체 가능

export interface IRepository<T, TCreate = Omit<T, 'nId'>> {
  findAll(): Promise<T[]>;
  findById(nId: number): Promise<T | null>;
  create(objData: TCreate): Promise<T>;
  update(nId: number, objData: Partial<T>): Promise<T | null>;
  delete(nId: number): Promise<boolean>;
}
