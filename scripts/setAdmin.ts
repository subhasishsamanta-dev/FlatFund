
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = 'flatfund-af16a';

// Initialize Firebase Admin
// We rely on Application Default Credentials (ADC) which should be available
// if the user has authenticated with gcloud or has service account env vars set.
// If running in an environment where firebase-mcp-server works, credentials should be present.
try {
    initializeApp({
        projectId: projectId,
        credential: applicationDefault()
    });
} catch (e) {
    // If already initialized
    if (!/already exists/.test((e as Error).message)) {
        console.error('Failed to initialize app', e);
        process.exit(1);
    }
}

const db = getFirestore();

const TARGET_EMAIL = 'testadmin@example.com';

async function setAdmin() {
    console.log(`Looking for user with email: ${TARGET_EMAIL}`);

    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', TARGET_EMAIL).get();

    if (snapshot.empty) {
        console.error('No matching documents.');
        return;
    }

    snapshot.forEach(async (doc) => {
        console.log(`Found user: ${doc.id} (${doc.data().name})`);
        console.log(`Current role: ${doc.data().role}`);

        if (doc.data().role === 'admin') {
            console.log('User is already an admin.');
            return;
        }

        try {
            await doc.ref.update({ role: 'admin' });
            console.log(`Successfully updated user ${doc.id} to admin.`);
        } catch (error) {
            console.error('Error updating user:', error);
        }
    });
}

setAdmin().catch(console.error);
