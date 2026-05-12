/**
 * Fix script: Reset activePeriodStart in Firestore back to 2026-03-01
 * Run with: node scripts/fix-period-start.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load service account from .env
const envContent = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT='(.+?)'\s*$/ms);
if (!match) {
    console.error('❌ Could not find FIREBASE_SERVICE_ACCOUNT in .env');
    process.exit(1);
}

const serviceAccount = JSON.parse(match[1]);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function fixPeriodStart() {
    const settingsRef = db.collection('settings').doc('global');
    const snap = await settingsRef.get();

    if (!snap.exists) {
        console.log('❌ settings/global document does not exist in Firestore!');
        process.exit(1);
    }

    const current = snap.data();
    console.log('📋 Current activePeriodStart:', current?.general?.activePeriodStart);

    // Set to March 1, 2026 (first of current month)
    const newPeriodStart = '2026-03-01';

    await settingsRef.set({
        general: {
            ...current?.general,
            activePeriodStart: newPeriodStart,
        }
    }, { merge: true });

    console.log('✅ activePeriodStart updated to:', newPeriodStart);
    console.log('🎉 All March 2026 transactions will now be visible!');
    process.exit(0);
}

fixPeriodStart().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
