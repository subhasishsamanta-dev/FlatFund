const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

// Set global options to use the closest region if not specified
setGlobalOptions({ region: "us-central1" });

/**
 * Triggers when a new document is created in the 'notifications' collection.
 * Sends a push notification to the target user(s) using their FCM tokens.
 */
exports.sendPushNotification = onDocumentCreated("notifications/{notificationId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }

    const notification = snapshot.data();
    const { userId, title, message, type } = notification;

    const db = admin.firestore();
    const messaging = admin.messaging();

    let tokens = [];

    try {
        if (userId === "all") {
            // Fetch all active users with FCM tokens
            const usersSnapshot = await db.collection("users")
                .where("isActive", "==", true)
                .get();

            usersSnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                    tokens.push(...userData.fcmTokens);
                }
            });
        } else {
            // Fetch specific user's tokens
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                    tokens.push(...userData.fcmTokens);
                }
            }
        }

        // Filter out duplicate tokens and empty values
        const uniqueTokens = [...new Set(tokens)].filter(t => !!t);

        if (uniqueTokens.length === 0) {
            console.log("No valid FCM tokens found for target:", userId);
            return;
        }

        // Construct the push notification message
        const payload = {
            notification: {
                title: title || "Flat Fund Update",
                body: message || "You have a new update.",
            },
            data: {
                type: type || "info",
                click_action: "FLUTTER_NOTIFICATION_CLICK", // Standard for some SDKs, useful for routing
            },
            tokens: uniqueTokens,
        };

        // Send multicast message
        const response = await messaging.sendEachForMulticast(payload);

        console.log(`${response.successCount} messages were sent successfully out of ${uniqueTokens.length}`);

        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Failure sending to token ${uniqueTokens[idx]}:`, resp.error);
                    failedTokens.push(uniqueTokens[idx]);
                }
            });
            console.log(`Failed tokens summary: ${failedTokens.length} tokens failed.`);
        }

    } catch (error) {
        console.error("Error in sendPushNotification function:", error);
    }
});
