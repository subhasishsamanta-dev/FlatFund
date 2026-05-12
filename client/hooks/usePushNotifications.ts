import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const usePushNotifications = () => {
    const { currentUser } = useAuth();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [error, setError] = useState<string | null>(null);

    const subscribeUser = useCallback(async () => {
        if (!currentUser) {
            setError('User must be logged in to subscribe to push notifications');
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Get the VAPID public key from our server
            const response = await fetch('/api/push/key');
            const { publicKey } = await response.json();

            const convertedVapidKey = urlBase64ToUint8Array(publicKey);

            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // Store the subscription in Firestore under the user's document
            const subscriptionData = sub.toJSON();
            await setDoc(doc(db, 'users', currentUser.uid), {
                pushSubscription: subscriptionData,
                pushSubscriptionUpdatedAt: new Date()
            }, { merge: true });

            setSubscription(sub);
            setIsSubscribed(true);
            return sub;
        } catch (err: any) {
            console.error('Failed to subscribe user: ', err);
            setError(err.message);
            return null;
        }
    }, [currentUser]);

    const unsubscribeUser = useCallback(async () => {
        if (!currentUser) return;

        try {
            if (subscription) {
                await subscription.unsubscribe();
            }

            // Remove subscription from Firestore
            await setDoc(doc(db, 'users', currentUser.uid), {
                pushSubscription: null,
                pushSubscriptionUpdatedAt: new Date()
            }, { merge: true });

            setSubscription(null);
            setIsSubscribed(false);
        } catch (err: any) {
            console.error('Failed to unsubscribe user: ', err);
            setError(err.message);
        }
    }, [currentUser, subscription]);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.pushManager.getSubscription().then((sub) => {
                    if (sub) {
                        setSubscription(sub);
                        setIsSubscribed(true);
                    }
                });
            });
        }
    }, []);

    return { isSubscribed, subscription, error, subscribeUser, unsubscribeUser };
};
