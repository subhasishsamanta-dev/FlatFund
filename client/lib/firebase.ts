import { initializeApp, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, setPersistence, inMemoryPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD5QlUmdYBiN388u2tHai6kX9SuEL_EzNg",
    authDomain: "flatfund-af16a.firebaseapp.com",
    projectId: "flatfund-af16a",
    storageBucket: "flatfund-af16a.firebasestorage.app",
    messagingSenderId: "770003269106",
    appId: "1:770003269106:web:0734829423e8d378dfa76b",
    measurementId: "G-D5W0439KTG"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Analytics can fail on localhost or with ad-blockers — wrap defensively
export const analytics = (() => {
    try {
        return typeof window !== 'undefined' ? getAnalytics(app) : null;
    } catch (e) {
        console.warn('Firebase Analytics not available:', e);
        return null;
    }
})();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = (() => {
    try {
        return typeof window !== 'undefined' ? getMessaging(app) : null;
    } catch (e) {
        console.warn('Firebase Messaging not available:', e);
        return null;
    }
})();

// Helper to get specific auth instance for creating users without logging out
export const getSecondaryAuth = async () => {
    let secondaryApp;
    try {
        secondaryApp = getApp('SecondaryApp');
    } catch (e) {
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
    }
    const secondaryAuth = getAuth(secondaryApp);
    await setPersistence(secondaryAuth, inMemoryPersistence);
    return secondaryAuth;
};
