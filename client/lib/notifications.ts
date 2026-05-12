import { db, messaging } from '@/lib/firebase';
import { getToken, onMessage } from "firebase/messaging";

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BPu3gy5K2ZLRBOJxkzyz9DSyOC-aGm4uyojDLUxQBtumy5XhIF0i0Cu85oqtMjLI_Gm49CkV6JREeUZPExpi7fI";

// Track registered UIDs so we don't re-register on every Firestore snapshot
const _registeredUids = new Set<string>();
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    orderBy,
    limit,
    serverTimestamp,
    updateDoc,
    doc,
    deleteDoc,
    writeBatch
} from 'firebase/firestore';
import { useState, useEffect } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
    id: string;
    userId: string; // 'all' or specific uid
    title: string;
    message: string;
    type: NotificationType;
    read: boolean;
    createdAt: any;
    link?: string;
}

/**
 * Sends a notification to a specific user or everyone ('all').
 */
export const sendNotification = async (
    userId: string,
    title: string,
    message: string,
    type: NotificationType = 'info',
    link?: string
) => {
    try {
        await addDoc(collection(db, 'notifications'), {
            userId,
            title,
            message,
            type,
            read: false,
            createdAt: serverTimestamp(),
            link: link || null
        });
    } catch (error) {
        console.error("Failed to send notification:", error);
    }
};

/**
 * Hook to listen for notifications for the current user.
 */
export function useNotifications(currentUserId?: string) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!currentUserId) return;

        // Listen for notifications targeting this user OR 'all' users
        // Note: Removed orderBy from query to avoid composite index requirement
        // We sort in memory instead
        const q = query(
            collection(db, 'notifications'),
            where('userId', 'in', [currentUserId, 'all']),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AppNotification[];

            // Sort by createdAt descending, handle nulls (newly added)
            const sortedData = data.sort((a, b) => {
                const timeA = a.createdAt?.seconds ? a.createdAt.seconds : Date.now() / 1000;
                const timeB = b.createdAt?.seconds ? b.createdAt.seconds : Date.now() / 1000;
                return timeB - timeA;
            });

            setNotifications(sortedData);
            setUnreadCount(sortedData.filter(n => !n.read).length);
        }, (err) => {
            console.error("Notifications listener failed:", err);
        });

        return () => unsubscribe();
    }, [currentUserId]);

    const markAsRead = async (notificationId: string) => {
        try {
            const ref = doc(db, 'notifications', notificationId);
            await updateDoc(ref, { read: true });
        } catch (err) {
            console.error("Failed to mark read:", err);
        }
    };

    const markAllAsRead = async () => {
        const batch = writeBatch(db);
        const unread = notifications.filter(n => !n.read);
        unread.forEach(n => {
            const ref = doc(db, 'notifications', n.id);
            batch.update(ref, { read: true });
        });

        if (unread.length > 0) {
            try {
                await batch.commit();
            } catch (err) {
                console.error("Failed to mark all read:", err);
            }
        }
    };

    const clearAll = async () => {
        const batch = writeBatch(db);
        notifications.forEach(n => {
            const ref = doc(db, 'notifications', n.id);
            batch.delete(ref);
        });

        if (notifications.length > 0) {
            try {
                await batch.commit();
            } catch (err) {
                console.error("Failed to clear all:", err);
            }
        }
    };

    return { notifications, unreadCount, markAsRead, markAllAsRead, clearAll };
}

/**
 * Request browser native notification permission
 */
export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return false;

    if (Notification.permission === "granted") return true;

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;
};

/**
 * Show a browser native notification
 */
export const showBrowserNotification = (title: string, body: string) => {
    if (Notification.permission === "granted") {
        new Notification(title, { body, icon: '/icon-192.png' });
    }
};

/**
 * Register current user for push notifications.
 * ⚠️ Guarded: only runs ONCE per user session to avoid re-registering
 * on every Firestore onSnapshot update.
 */
export const registerPushNotifications = async (userId: string) => {
    // Skip if already registered in this session
    if (_registeredUids.has(userId)) return;

    try {
        if (!messaging) {
            console.warn("[notifications] FCM messaging not supported in this environment");
            return;
        }

        if (!('serviceWorker' in navigator)) {
            console.warn("[notifications] Service workers not supported");
            return;
        }

        const permission = await requestNotificationPermission();
        if (!permission) {
            console.warn("[notifications] Notification permission denied");
            return;
        }

        // Wait for service worker — required by FCM getToken on live/HTTPS
        const swRegistration = await navigator.serviceWorker.ready;

        // VAPID key is REQUIRED for getToken to work on live (HTTPS) environments
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration,
        }).catch(err => {
            console.error("[notifications] FCM Token generation failed:", err);
            return null;
        });

        if (token) {
            _registeredUids.add(userId);
            console.log("[notifications] FCM Token registered:", token.slice(0, 20) + '...');

            // Register token with our backend
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, token, pushType: 'fcm' })
            });

            // Listen for foreground messages (only set up once)
            onMessage(messaging, (payload) => {
                console.log('[notifications] Foreground message received:', payload);
                const title = payload.notification?.title || payload.data?.title || "New Notification";
                const body = payload.notification?.body || payload.data?.body || "";
                showBrowserNotification(title, body);
            });
        }
    } catch (error) {
        console.error("[notifications] Error setting up push notifications:", error);
    }
};
