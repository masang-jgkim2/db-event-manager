self.addEventListener('push', (event) => {
  let objPayload = {};
  try {
    objPayload = event.data ? event.data.json() : {};
  } catch {
    objPayload = {};
  }
  const strTitle = objPayload.strTitle || 'DQPM';
  const strBody = objPayload.strBody || '';
  const strUrl = objPayload.strUrl || '/';
  const strTag = objPayload.strTag || undefined;
  event.waitUntil(
    self.registration.showNotification(strTitle, {
      body: strBody,
      tag: strTag,
      data: { strUrl },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const strUrl = event.notification.data?.strUrl || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((arrClients) => {
      for (const objClient of arrClients) {
        if ('focus' in objClient) {
          objClient.navigate(strUrl);
          return objClient.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(strUrl);
      }
      return undefined;
    }),
  );
});
