
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

async function diagnose() {
    console.log('--- DEPOSITS COLLECTION ---');
    const deposits = await db.collection('deposits').get();
    deposits.forEach(d => {
        const data = d.data();
        console.log(`[DEPOSIT] ID: ${d.id}, Amount: ${data.amount}, Type: ${data.type || 'N/A'}, Status: ${data.status}`);
    });

    console.log('\n--- EXPENSES COLLECTION ---');
    const expenses = await db.collection('expenses').get();
    expenses.forEach(e => {
        const data = e.data();
        console.log(`[EXPENSE] ID: ${e.id}, Amount: ${data.amount}, Type: ${data.type || 'N/A'}, Status: ${data.status}`);
    });
}

diagnose().catch(console.error);
