// Flat Fund PWA Service Worker (firebase-messaging-sw.js)
// Handles: FCM background messages (Android/Chrome) + Web Push API (iOS Safari PWA)

// ─── FCM Initialization (Chrome/Android only) ─────────────────────────────────
// importScripts will fail gracefully if Firebase isn't needed (iOS),
// but we need these for Chrome/Android FCM background messages.
try {
    importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

    firebase.initializeApp({
        apiKey: "AIzaSyD5QlUmdYBiN388u2tHai6kX9SuEL_EzNg",
        authDomain: "flatfund-af16a.firebaseapp.com",
        projectId: "flatfund-af16a",
        storageBucket: "flatfund-af16a.firebasestorage.app",
        messagingSenderId: "770003269106",
        appId: "1:770003269106:web:0734829423e8d378dfa76b",
    });

    const messaging = firebase.messaging();

    // ─── FCM Background Message Handler (Android/Chrome PWA) ────────────────
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] FCM background message received:', payload);

        const notificationTitle = payload.notification?.title || payload.data?.title || 'FlatFund';
        const notificationOptions = {
            body: payload.notification?.body || payload.data?.body || 'You have a new notification.',
            icon: payload.data?.icon || '/logo.png',
            badge: '/logo-minimal.png',
            data: payload.data || {},
            tag: payload.data?.tag || 'flatfund-notification',
            requireInteraction: false,
            vibrate: [200, 100, 200],
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });

} catch (e) {
    // Firebase not available (e.g., iOS Safari) — Web Push 'push' event below handles it
    console.log('[firebase-messaging-sw.js] Firebase messaging not loaded (likely iOS), using Web Push fallback.');
}

// ─── Web Push API Handler (iOS Safari PWA + Android fallback) ─────────────────
// iOS Safari delivers push notifications as standard W3C Push API events.
// Firefox and some Chrome scenarios also use this path.
self.addEventListener('push', (event) => {
    console.log('[firebase-messaging-sw.js] Standard push event received');

    let title = 'FlatFund';
    let body = 'You have a new notification.';
    let icon = '/logo.png';
    let data = {};
    let tag = 'flatfund-notification';

    if (event.data) {
        try {
            const payload = event.data.json();
            // Support both flat payload and nested notification object
            title = payload.notification?.title || payload.title || payload.data?.title || title;
            body = payload.notification?.body || payload.body || payload.data?.body || body;
            icon = payload.data?.icon || payload.icon || icon;
            data = payload.data || payload;
            tag = payload.data?.tag || payload.tag || tag;
        } catch (err) {
            // Payload might be plain text
            try {
                body = event.data.text();
            } catch (e2) {
                console.warn('[firebase-messaging-sw.js] Could not parse push payload:', err);
            }
        }
    }

    const options = {
        body,
        icon,
        badge: '/logo-minimal.png',
        data,
        tag,
        requireInteraction: false,
        vibrate: [200, 100, 200],
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ─── Notification Click Handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification.tag);
    event.notification.close();

    if (event.action === 'close') return;

    const targetUrl = event.notification.data?.click_action || event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If the app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open a new window
                return clients.openWindow(targetUrl);
            })
    );
});

// ─── Service Worker Lifecycle ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker installing...');
    // Skip waiting so new SW activates immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker activating...');
    event.waitUntil(clients.claim());
});

// ─── Fetch Handler (Required for PWA installability) ─────────────────────────
self.addEventListener('fetch', (event) => {
    // Pass-through: let network handle all requests
    // This satisfies PWA installability requirements without breaking anything
});
