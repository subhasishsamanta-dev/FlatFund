// Flat Fund - sw.js
// This file re-exports the main service worker logic.
// The canonical service worker is firebase-messaging-sw.js
// This file exists for compatibility only.

// ─── Web Push API Handler (iOS Safari PWA + Android fallback) ─────────────────
self.addEventListener('push', (event) => {
    console.log('[sw.js] Standard push event received');

    let title = 'FlatFund';
    let body = 'You have a new notification.';
    let icon = '/logo.png';
    let data = {};
    let tag = 'flatfund-notification';

    if (event.data) {
        try {
            const payload = event.data.json();
            title = payload.notification?.title || payload.title || payload.data?.title || title;
            body = payload.notification?.body || payload.body || payload.data?.body || body;
            icon = payload.data?.icon || payload.icon || icon;
            data = payload.data || payload;
            tag = payload.data?.tag || payload.tag || tag;
        } catch (err) {
            try { body = event.data.text(); } catch (e2) { }
        }
    }

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon,
            badge: '/logo-minimal.png',
            data,
            tag,
            requireInteraction: false,
            vibrate: [200, 100, 200],
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'close') return;

    const targetUrl = event.notification.data?.click_action || event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow(targetUrl);
            })
    );
});

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });
self.addEventListener('fetch', () => { });
