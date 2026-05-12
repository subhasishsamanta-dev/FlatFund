import { Request, Response } from "express";
import admin from "firebase-admin";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccountVar) {
        try {
            const serviceAccount = JSON.parse(serviceAccountVar);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } catch (error) {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });
        }
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
    }
}

const db = admin.firestore();

/**
 * Returns the VAPID public key so the client can subscribe to push notifications.
 */
export const handleGetPushKey = (_req: Request, res: Response) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
        res.status(500).json({ error: "VAPID_PUBLIC_KEY is not configured on the server." });
        return;
    }
    res.json({ publicKey });
};

export const handleSubscribe = async (req: Request, res: Response) => {
    try {
        const { userId, token, webPushSubscription, pushType } = req.body;

        if (!userId) {
            res.status(400).json({ message: "userId is required" });
            return;
        }

        const updateData: Record<string, any> = {};

        if (token && (pushType === 'fcm' || !pushType)) {
            // Store FCM token (Android/Chrome)
            updateData.fcmTokens = admin.firestore.FieldValue.arrayUnion(token);
            updateData.pushType = 'fcm';
        }

        if (webPushSubscription && webPushSubscription.endpoint) {
            // Store Web Push subscription (iOS Safari PWA)
            updateData.webPushSubscription = webPushSubscription;
            updateData.webPushUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.pushType = 'webpush';
        }

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ message: "Either token (FCM) or webPushSubscription is required" });
            return;
        }

        await db.collection('users').doc(userId).set(updateData, { merge: true });

        res.status(201).json({ message: "Push subscription registered" });
    } catch (error) {
        console.error("Error registering push subscription:", error);
        res.status(500).json({ message: "Failed to register push subscription" });
    }
};

export const handleSendPush = async (req: Request, res: Response) => {
    const { title, body } = req.body;

    try {
        const usersSnapshot = await db.collection('users').get();
        let totalSent = 0;

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const fcmTokens: string[] = userData?.fcmTokens || [];

            if (fcmTokens.length === 0) continue;

            const message: admin.messaging.MulticastMessage = {
                tokens: fcmTokens,
                notification: {
                    title: title || "New Notification",
                    body: body || "You have a new message from FlatFund!",
                },
                android: { priority: "high" },
                webpush: { headers: { Urgency: "high" } },
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            totalSent += response.successCount;
        }

        res.status(200).json({ message: `Notification sent to ${totalSent} devices` });
    } catch (error) {
        console.error("Error sending push notification:", error);
        res.status(500).json({ message: "Failed to send notifications" });
    }
};

export const handleSendTestPush = async (req: Request, res: Response) => {
    const { userId, title, body } = req.body;

    if (!userId) {
        res.status(400).json({ message: "userId is required" });
        return;
    }

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const userData = userDoc.data();
        const fcmTokens: string[] = userData?.fcmTokens || [];
        const webPushSub = userData?.webPushSubscription;

        if (fcmTokens.length === 0 && (!webPushSub || !webPushSub.endpoint)) {
            res.status(400).json({ message: "No push tokens found for this user. Ensure notifications are allowed." });
            return;
        }

        let successCount = 0;
        if (fcmTokens.length > 0) {
            const message: admin.messaging.MulticastMessage = {
                tokens: fcmTokens,
                notification: {
                    title: title || "Test Notification",
                    body: body || "If you're reading this, push notifications are working!",
                },
                android: { priority: "high" },
                webpush: { headers: { Urgency: "high" } },
            };
            const response = await admin.messaging().sendEachForMulticast(message);
            successCount += response.successCount;
        }

        res.status(200).json({ 
            message: `Test notification sent. Success: ${successCount}`,
            tokensFound: fcmTokens.length,
            webPushSubscribed: !!webPushSub?.endpoint
        });
    } catch (error: any) {
        console.error("Error sending test push:", error);
        res.status(500).json({ message: "Failed to send test notification", error: error.message });
    }
};
