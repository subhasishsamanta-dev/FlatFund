import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { registerPushNotifications } from '@/lib/notifications';
import { SplashScreen } from '@/components/SplashScreen';
import { SkeletonLoader } from '@/components/SkeletonLoader';


interface UserProfile {
    uid: string;
    email: string;
    name: string;
    role: 'admin' | 'member';
    isActive: boolean;
    monthlyTarget: number;
    phone?: string;
    avatar?: string;
    joinedAt: string;
    createdAt: string;
    twoFactorEnabled: boolean;
}

interface AuthContextType {
    currentUser: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signup: (email: string, password: string, name: string) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
    sendPasswordReset: (email: string) => Promise<void>;
    refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [splashDone, setSplashDone] = useState(false);
    const [showSplash, setShowSplash] = useState(() => {
        return !sessionStorage.getItem('has_shown_splash');
    });

    useEffect(() => {
        if (showSplash) {
            const timer = setTimeout(() => {
                setSplashDone(true);
                sessionStorage.setItem('has_shown_splash', 'true');
            }, 3000);
            return () => clearTimeout(timer);
        } else {
            setSplashDone(true);
        }
    }, [showSplash]);

    const loading = authLoading || (showSplash && !splashDone);


    // Signup function
    async function signup(email: string, password: string, name: string) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile in Firestore
        const userProfile: UserProfile = {
            uid: user.uid,
            email: user.email || email,
            name: name,
            role: 'member', // Default role
            isActive: true,
            monthlyTarget: 1500,
            joinedAt: new Date().toISOString().slice(0, 7), // YYYY-MM
            createdAt: new Date().toISOString(),
            twoFactorEnabled: false,
        };

        await setDoc(doc(db, 'users', user.uid), userProfile);
    }

    // Login function
    async function login(email: string, password: string) {
        await signInWithEmailAndPassword(auth, email, password);
    }

    // Logout function
    async function logout() {
        await signOut(auth);
    }

    // Update Password function
    async function updateUserPassword(currentPassword: string, newPassword: string) {
        if (!auth.currentUser || !auth.currentUser.email) {
            throw new Error('No user logged in');
        }

        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);

        // Re-authenticate user
        await reauthenticateWithCredential(auth.currentUser, credential);

        // Update password
        await updatePassword(auth.currentUser, newPassword);
    }

    // Send Password Reset Email
    async function sendPasswordReset(email: string) {
        await sendPasswordResetEmail(auth, email);
    }

    // Refresh user profile from Firestore
    async function refreshUserProfile() {
        // Kept for interface compatibility but logic is handled by onSnapshot
    }

    // Listen to auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (!user) {
                setUserProfile(null);
                setAuthLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    // REALTIME LISTENER for User Profile
    useEffect(() => {
        let unsubscribeProfile = () => { };

        if (currentUser) {
            setAuthLoading(true); // Ensure loading while fetching profile
            const userRef = doc(db, 'users', currentUser.uid);

            unsubscribeProfile = onSnapshot(userRef,
                (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data() as UserProfile;
                        setUserProfile(userData);

                        // Register for push notifications
                        registerPushNotifications(currentUser.uid);
                    } else {
                        console.error('User profile not found in Firestore');
                        setUserProfile(null);
                    }
                    setAuthLoading(false);
                },
                (error) => {
                    console.error("Error listening to user profile:", error);
                    setAuthLoading(false);
                }
            );
        } else {
            setUserProfile(null);
            setAuthLoading(false); // ← Ensure loading resolves when not logged in
        }

        return () => unsubscribeProfile();
    }, [currentUser]);

    const value = {
        currentUser,
        userProfile,
        loading,
        signup,
        login,
        logout,
        updateUserPassword,
        sendPasswordReset,
        refreshUserProfile,
    };

    return (
        <AuthContext.Provider value={value}>
            {showSplash && !splashDone ? (
                <SplashScreen />
            ) : authLoading ? (
                <SkeletonLoader />
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
}
