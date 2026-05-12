
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = 'flatfund-af16a';

try {
    initializeApp({
        projectId: projectId,
        credential: applicationDefault()
    });
} catch (e) {
    if (!/already exists/.test((e as Error).message)) {
        process.exit(1);
    }
}

const db = getFirestore();

async function listUsers() {
    console.log('Listing all users:');
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
        console.log('No users found.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}, Name: ${data.name}, Email: ${data.email}, Role: ${data.role}`);
    });
}

listUsers().catch(console.error);
