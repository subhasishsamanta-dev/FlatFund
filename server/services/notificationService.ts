import admin from "firebase-admin";
import webpush from "web-push";

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
            console.error("Error parsing service account, falling back to applicationDefault");
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

// Configure web-push VAPID keys for iOS Web Push (and any standard Web Push clients)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@flatfund.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
    console.warn("[notificationService] VAPID keys not set — iOS Web Push will not work.");
}

const db = admin.firestore();

/**
 * Removes stale/expired FCM tokens from a user's Firestore document.
 */
async function cleanupStaleTokens(userId: string, staleTokens: string[]): Promise<void> {
    if (staleTokens.length === 0) return;
    try {
        await db.collection('users').doc(userId).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...staleTokens),
        });
        console.log(`[notificationService] Removed ${staleTokens.length} stale token(s) for user ${userId}`);
    } catch (err) {
        console.error('[notificationService] Failed to cleanup stale tokens:', err);
    }
}

/**
 * Sends a Web Push notification to an iOS (or any W3C Web Push) subscriber.
 * @param subscription - The PushSubscription JSON stored in Firestore
 * @param payload - The notification payload object
 */
async function sendWebPushNotification(
    subscription: webpush.PushSubscription,
    payload: { title: string; body: string; icon?: string; url?: string; tag?: string }
): Promise<void> {
    try {
        await webpush.sendNotification(
            subscription,
            JSON.stringify({
                notification: {
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || "/logo.png",
                    badge: "/logo-minimal.png",
                    tag: payload.tag || "flatfund-notification",
                },
                data: {
                    url: payload.url || "/",
                    click_action: payload.url || "/",
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || "/logo.png",
                }
            })
        );
    } catch (err: any) {
        // 410 Gone = subscription expired, should be cleaned up
        // 404 Not Found = invalid subscription
        if (err.statusCode === 410 || err.statusCode === 404) {
            console.warn("[notificationService] Web Push subscription expired or invalid, skipping.");
        } else {
            console.error("[notificationService] Web Push send error:", err.message);
        }
    }
}

/**
 * Sends notifications to ALL users — both FCM (Android/Chrome) and Web Push (iOS Safari PWA).
 */
async function sendToAllUsers(notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
    clickUrl?: string;
    icon?: string;
    tag?: string;
}): Promise<void> {
    const usersSnapshot = await db.collection("users").get();

    const fcmTokens: string[] = [];
    const webPushSubscriptions: webpush.PushSubscription[] = [];

    usersSnapshot.forEach((doc) => {
        const userData = doc.data();

        // Collect FCM tokens (Android/Chrome PWA)
        if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
            fcmTokens.push(...userData.fcmTokens);
        }

        // Collect Web Push subscriptions (iOS Safari PWA)
        if (userData.webPushSubscription && userData.webPushSubscription.endpoint) {
            try {
                webPushSubscriptions.push(userData.webPushSubscription as webpush.PushSubscription);
            } catch (e) {
                console.warn("[notificationService] Invalid webPushSubscription for user:", doc.id);
            }
        }
    });

    // ─── Send FCM (Android / Chrome) ────────────────────────────────────────
    if (fcmTokens.length > 0) {
        // Track which token belongs to which user for cleanup
        const tokenToUserMap = new Map<string, string>();
        usersSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                data.fcmTokens.forEach((t: string) => tokenToUserMap.set(t, doc.id));
            }
        });

        try {
            const message: admin.messaging.MulticastMessage = {
                tokens: fcmTokens,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: {
                    ...(notification.data || {}),
                    icon: notification.icon || "/logo.png",
                    click_action: notification.clickUrl || "/",
                    tag: notification.tag || "flatfund-notification",
                },
                android: {
                    priority: "high",
                    notification: { color: "#0DA9AF", icon: "ic_notification" },
                },
                webpush: {
                    headers: { Urgency: "high" },
                    notification: {
                        icon: notification.icon || "/logo.png",
                        badge: "/logo-minimal.png",
                    },
                    fcmOptions: {
                        link: notification.clickUrl || "/",
                    },
                },
            };

            const result = await admin.messaging().sendEachForMulticast(message);
            console.log(`[notificationService] FCM sent: ${result.successCount}/${fcmTokens.length} delivered`);

            // Cleanup stale tokens (error code UNREGISTERED or INVALID_ARGUMENT)
            if (result.failureCount > 0) {
                const staleByUser = new Map<string, string[]>();
                result.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const code = resp.error?.code || '';
                        if (code.includes('UNREGISTERED') || code.includes('INVALID_ARGUMENT') || code.includes('NOT_FOUND')) {
                            const staleToken = fcmTokens[idx];
                            const userId = tokenToUserMap.get(staleToken);
                            if (userId) {
                                if (!staleByUser.has(userId)) staleByUser.set(userId, []);
                                staleByUser.get(userId)!.push(staleToken);
                            }
                        }
                    }
                });
                await Promise.allSettled(
                    Array.from(staleByUser.entries()).map(([uid, tokens]) => cleanupStaleTokens(uid, tokens))
                );
            }
        } catch (err) {
            console.error("[notificationService] FCM multicast error:", err);
        }
    }

    // ─── Send Web Push (iOS Safari PWA) ─────────────────────────────────────
    if (webPushSubscriptions.length > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const webPushPayload = {
            title: notification.title,
            body: notification.body,
            icon: notification.icon || "/logo.png",
            url: notification.clickUrl || "/",
            tag: notification.tag || "flatfund-notification",
        };

        const results = await Promise.allSettled(
            webPushSubscriptions.map((sub) => sendWebPushNotification(sub, webPushPayload))
        );
        const successCount = results.filter((r) => r.status === "fulfilled").length;
        console.log(`[notificationService] Web Push sent: ${successCount}/${webPushSubscriptions.length} delivered`);
    } else if (webPushSubscriptions.length > 0) {
        console.warn("[notificationService] Web Push subscriptions found but VAPID keys not configured.");
    }
}

/**
 * Sends a notification to a SINGLE user (by userId) — FCM + Web Push.
 */
async function sendToUser(
    userId: string,
    notification: {
        title: string;
        body: string;
        data?: Record<string, string>;
        clickUrl?: string;
        icon?: string;
        tag?: string;
    }
): Promise<void> {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data()!;
    const fcmTokens: string[] = userData.fcmTokens || [];
    const webPushSub = userData.webPushSubscription;

    // Send FCM
    if (fcmTokens.length > 0) {
        try {
            const message: admin.messaging.MulticastMessage = {
                tokens: fcmTokens,
                notification: { title: notification.title, body: notification.body },
                data: {
                    ...(notification.data || {}),
                    click_action: notification.clickUrl || "/",
                },
                android: { priority: "high" },
                webpush: { headers: { Urgency: "high" } },
            };
            await admin.messaging().sendEachForMulticast(message);
        } catch (err) {
            console.error("[notificationService] FCM to user error:", err);
        }
    }

    // Send Web Push (iOS)
    if (webPushSub?.endpoint && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        await sendWebPushNotification(webPushSub as webpush.PushSubscription, {
            title: notification.title,
            body: notification.body,
            icon: notification.icon || "/logo.png",
            url: notification.clickUrl || "/",
            tag: notification.tag || "flatfund-notification",
        });
    }
}

// ─── Public Notification Functions ─────────────────────────────────────────────

export const sendDepositNotification = async (
    userId: string,
    userName: string,
    amount: number
): Promise<void> => {
    await sendToAllUsers({
        title: "💰 New Deposit",
        body: `${userName} deposited ₹${amount}`,
        data: { type: "deposit", userId },
        clickUrl: "/deposits",
        tag: "deposit-notification",
    });
};

export const sendExpenseNotification = async (
    userId: string,
    userName: string,
    amount: number,
    category: string,
    type: string
): Promise<void> => {
    await sendToAllUsers({
        title: "🧾 New Expense",
        body: `${userName} spent ₹${amount} on ${category} (${type})`,
        data: { type: "expense", userId, category },
        clickUrl: "/expenses",
        tag: "expense-notification",
    });
};

export const sendSharedBillNotification = async (
    userId: string,
    userName: string,
    billTitle: string,
    totalAmount: number,
    perMemberShare: number
): Promise<void> => {
    await sendToAllUsers({
        title: "📋 New Shared Bill",
        body: `${userName} created "${billTitle}": ₹${totalAmount} (₹${perMemberShare} each)`,
        data: { type: "bill", userId },
        clickUrl: "/bills",
        tag: "bill-notification",
    });
};

export const sendReimbursementRequestNotification = async (
    userId: string,
    userName: string,
    amount: number
): Promise<void> => {
    // Send only to admins
    const adminsSnapshot = await db.collection("users").where("role", "==", "admin").get();

    const adminPromises = adminsSnapshot.docs.map((adminDoc) => {
        const adminId = adminDoc.id;
        return sendToUser(adminId, {
            title: "💸 Reimbursement Request",
            body: `${userName} requested ₹${amount} reimbursement`,
            data: { type: "reimbursement_request", userId },
            clickUrl: "/admin",
            tag: "reimbursement-notification",
        });
    });

    await Promise.allSettled(adminPromises);
};

export const sendReimbursementApprovalNotification = async (
    userId: string,
    amount: number,
    approved: boolean,
    adminName: string
): Promise<void> => {
    const status = approved ? "Approved ✅" : "Rejected ❌";
    await sendToUser(userId, {
        title: `Reimbursement ${status}`,
        body: `Your reimbursement of ₹${amount} was ${approved ? "approved" : "rejected"} by ${adminName}`,
        data: { type: "reimbursement_approval", approved: String(approved) },
        clickUrl: "/",
        tag: "reimbursement-approval-notification",
    });
};
