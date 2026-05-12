import { useEffect, useState } from "react";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

export const PushHandler = () => {
    const { currentUser } = useAuth();
    const { isSubscribed, subscribeUser, error } = usePushNotifications();
    const [permissionRequested, setPermissionRequested] = useState(false);

    useEffect(() => {
        // Only try to subscribe if user is logged in and we haven't already requested
        if (!currentUser || permissionRequested || isSubscribed) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        // Check current notification permission
        const requestNotificationPermission = async () => {
            const permission = Notification.permission;

            if (permission === 'default') {
                // Request permission
                const result = await Notification.requestPermission();

                if (result === 'granted') {
                    await subscribeUser();
                    toast.success('Push notifications enabled!');
                } else if (result === 'denied') {
                    toast.error('Push notifications are blocked. Please enable them in your browser settings.');
                }
            } else if (permission === 'granted' && !isSubscribed) {
                // Permission already granted, just subscribe
                await subscribeUser();
            }

            setPermissionRequested(true);
        };

        // Wait a bit after login before requesting permissions (better UX)
        const timer = setTimeout(() => {
            requestNotificationPermission();
        }, 2000);

        return () => clearTimeout(timer);
    }, [currentUser, isSubscribed, subscribeUser, permissionRequested]);

    useEffect(() => {
        if (error) {
            toast.error(`Push Notification Error: ${error}`);
        }
    }, [error]);

    return null;
};
