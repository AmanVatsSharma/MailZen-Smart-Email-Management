// File:        apps/frontend/public/sw.js
// Module:      Push Notifications · ServiceWorker
// Purpose:     Handles Web Push events and shows browser notifications.
//
// Side-effects:
//   - Displays a Notification when a push event is received
//   - Focuses or opens the app window when notification is clicked
//
// Key invariants:
//   - Must stay at /sw.js (root scope) for pushManager.subscribe() to work
//   - Notification data is a JSON-encoded { title, body, url? } object in the push payload

self.addEventListener('push', (event) => {
  let title = 'MailZen';
  let body = 'You have a new notification.';
  let url = '/notifications';

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
      url = data.url || url;
    } catch {
      body = event.data.text() || body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
