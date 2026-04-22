import { fnPersistProductCatalogToRdb } from './productCatalogPersistence';

export const fnFlushProductCatalogToRdb = async (): Promise<void> => {
  const { arrProducts } = await import('../../data/products');
  const { arrEvents } = await import('../../data/events');
  const { arrEventInstances } = await import('../../data/eventInstances');
  await fnPersistProductCatalogToRdb({ arrProducts, arrEvents, arrEventInstances });
};
