import { useEffect, useState } from 'react';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { db, messaging } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

// VAPID key for Web Push API (iOS Safari PWA)
const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BPu3gy5K2ZLRBOJxkzyz9DSyOC-aGm4uyojDLUxQBtumy5XhIF0i0Cu85oqtMjLI_Gm49CkV6JREeUZPExpi7fI";

/**
 * Detect if running as an iOS PWA (installed to home screen).
 * iOS Safari does NOT support FCM — only Web Push API (since iOS 16.4).
 */
function isIOSPWA(): boolean {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;
    return isIOS && isStandalone;
}

/**
 * Detect if iOS, regardless of PWA mode.
 */
function isIOS(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Convert a base64-encoded VAPID public key to a Uint8Array,
 * required for the Web Push subscribe API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function useFCM() {
    const { userProfile } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userProfile) return;
        if (!('serviceWorker' in navigator)) return;
        if (!('Notification' in window)) return;

        const setup = async () => {
            try {
                // ─── Step 1: Request notification permission ───────────────────
                let permission = Notification.permission;
                if (permission === 'default') {
                    permission = await Notification.requestPermission();
                }

                if (permission !== 'granted') {
                    console.warn('[useFCM] Notification permission not granted:', permission);
                    return;
                }

                // ─── Step 2: Wait for service worker to be ready ──────────────
                const swRegistration = await navigator.serviceWorker.ready;

                // ─── Step 3: Route by platform ────────────────────────────────
                if (isIOS()) {
                    // iOS Safari PWA: Use Web Push API (VAPID), NOT FCM
                    await setupWebPush(swRegistration, userProfile.uid);
                } else {
                    // Android / Chrome / Desktop: Use FCM
                    await setupFCM(swRegistration, userProfile.uid);
                }
            } catch (err: any) {
                console.error('[useFCM] Error during push setup:', err);
                setError(err.message || 'Unknown push setup error');
            }
        };

        setup();
    }, [userProfile]);

    /**
     * FCM path — for Android Chrome / Desktop Chrome PWA.
     */
    const setupFCM = async (swRegistration: ServiceWorkerRegistration, uid: string) => {
        if (!messaging) {
            console.warn('[useFCM] Firebase messaging not available in this environment.');
            return;
        }

        try {
            const { getToken, onMessage } = await import('firebase/messaging');

            const currentToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: swRegistration,
            });

            if (currentToken) {
                setToken(currentToken);
                console.log('[useFCM] FCM token obtained:', currentToken.slice(0, 20) + '...');

                // Save FCM token to Firestore
                const userRef = doc(db, 'users', uid);
                await updateDoc(userRef, {
                    fcmTokens: arrayUnion(currentToken),
                    pushType: 'fcm',
                });
            }

            // Handle foreground messages
            onMessage(messaging, (payload) => {
                const data = payload.data || {};
                const title = data.title || payload.notification?.title || 'New Notification';
                const body = data.body || payload.notification?.body || '';
                console.log('[useFCM] Foreground message:', title);

                if (Notification.permission === 'granted') {
                    swRegistration.showNotification(title, {
                        body,
                        icon: data.icon || '/logo.png',
                        data: data,
                    });
                }
            });
        } catch (err: any) {
            console.error('[useFCM] FCM setup failed:', err);
            setError(err.message);
        }
    };

    /**
     * Web Push path — for iOS Safari PWA (16.4+).
     * iOS doesn't support FCM, but DOES support the standard VAPID Web Push API.
     */
    const setupWebPush = async (swRegistration: ServiceWorkerRegistration, uid: string) => {
        try {
            const pushManager = swRegistration.pushManager;

            // Check if already subscribed
            let subscription = await pushManager.getSubscription();

            if (!subscription) {
                // Subscribe with VAPID key
                const vapidKey = urlBase64ToUint8Array(VAPID_KEY);
                subscription = await pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: vapidKey.buffer.slice(vapidKey.byteOffset, vapidKey.byteOffset + vapidKey.byteLength) as ArrayBuffer,
                });
                console.log('[useFCM] iOS Web Push subscription created');
            } else {
                console.log('[useFCM] iOS Web Push already subscribed');
            }

            // Save the Web Push subscription endpoint to Firestore
            const subscriptionJSON = subscription.toJSON();
            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, {
                webPushSubscription: subscriptionJSON,
                pushType: 'webpush',
                webPushUpdatedAt: new Date(),
            }, { merge: true });

            // Use the endpoint as a "token"-like identifier for the UI
            setToken(subscriptionJSON.endpoint || 'webpush-subscribed');
            console.log('[useFCM] iOS Web Push subscription saved to Firestore.');
        } catch (err: any) {
            console.error('[useFCM] Web Push setup failed:', err);
            setError(err.message);
        }
    };

    return { token, error };
}
