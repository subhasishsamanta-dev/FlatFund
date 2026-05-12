import { useState, useEffect } from 'react';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { haptics } from '@/lib/haptics';

// Helper to get safe timestamp for sorting
const getSafeTime = (createdAt: any) => {
    if (!createdAt) return Infinity;
    if (typeof createdAt.seconds === 'number') return createdAt.seconds;
    if (typeof createdAt.toMillis === 'function') return createdAt.toMillis() / 1000;
    return Infinity;
};

export interface Deposit {
    id: string;
    uid: string;
    userName: string;
    userAvatar?: string;
    amount: number;
    date: string;
    reference?: string;
    note?: string;
    status: 'confirmed' | 'pending';
    createdAt: any;
}

export interface Expense {
    id: string;
    uid: string;
    userName: string;
    userAvatar?: string;
    amount: number;
    date: string;
    category: string;
    categoryIcon?: string;
    note?: string;
    type: 'fund' | 'self';
    status: string;
    receipt?: boolean;
    createdAt: any;
}

export function useTransactions() {
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const { userProfile } = useAuth();

    useEffect(() => {
        const qDeposits = query(collection(db, 'deposits'));
        const qExpenses = query(collection(db, 'expenses'));

        const unsubDeposits = onSnapshot(qDeposits, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Deposit[];

            // Client-side sorting: most recent first
            const sortedData = [...data].sort((a, b) => {
                const dateA = new Date(a.date || 0).getTime();
                const dateB = new Date(b.date || 0).getTime();
                if (dateB !== dateA) return dateB - dateA;

                // Treat null createdAt (just added) as "now"
                const timeA = a.createdAt?.seconds ??
                    (typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() / 1000 : Infinity);
                const timeB = b.createdAt?.seconds ??
                    (typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() / 1000 : Infinity);
                return Number(timeB || 0) - Number(timeA || 0);
            });

            setDeposits(sortedData);
        });

        const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Expense[];

            // Client-side sorting: most recent first
            const sortedData = [...data].sort((a, b) => {
                const dateA = new Date(a.date || 0).getTime();
                const dateB = new Date(b.date || 0).getTime();
                if (dateB !== dateA) return dateB - dateA;

                // Treat null createdAt (just added) as "now"
                const timeA = a.createdAt?.seconds ??
                    (typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() / 1000 : Infinity);
                const timeB = b.createdAt?.seconds ??
                    (typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() / 1000 : Infinity);
                return Number(timeB || 0) - Number(timeA || 0);
            });

            setExpenses(sortedData);
            setLoading(false);
        });

        return () => {
            unsubDeposits();
            unsubExpenses();
        };
    }, []);

    const addDeposit = async (data: Omit<Deposit, 'id' | 'createdAt' | 'uid' | 'userName' | 'userAvatar'> & { uid?: string; userName?: string; userAvatar?: string }) => {
        if (!userProfile) throw new Error("Must be logged in to add deposit");

        await addDoc(collection(db, 'deposits'), {
            ...data,
            status: data.status || 'confirmed',
            uid: data.uid || userProfile.uid,
            userName: data.userName || userProfile.name,
            userAvatar: data.userAvatar || userProfile.avatar || '',
            createdAt: serverTimestamp()
        });

        // Trigger push notification (fire-and-forget)
        fetch('/api/deposits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: data.uid || userProfile.uid,
                userName: data.userName || userProfile.name,
                amount: data.amount
            })
        }).catch(() => { });

        haptics.success();
    };

    const addExpense = async (data: Omit<Expense, 'id' | 'createdAt' | 'uid' | 'userName' | 'userAvatar'> & { uid?: string; userName?: string; userAvatar?: string }) => {
        if (!userProfile) throw new Error("Must be logged in to add expense");

        await addDoc(collection(db, 'expenses'), {
            ...data,
            status: data.status || 'confirmed',
            uid: data.uid || userProfile.uid,
            userName: data.userName || userProfile.name,
            userAvatar: data.userAvatar || userProfile.avatar || '',
            createdAt: serverTimestamp()
        });

        // Trigger push notification (fire-and-forget)
        fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: data.uid || userProfile.uid,
                userName: data.userName || userProfile.name,
                amount: data.amount,
                category: data.category,
                type: data.type
            })
        }).catch(() => { });

        haptics.success();
    };

    const updateExpense = async (id: string, data: Partial<Expense>) => {
        await updateDoc(doc(db, 'expenses', id), data);
    };

    const updateDeposit = async (id: string, data: Partial<Deposit>) => {
        await updateDoc(doc(db, 'deposits', id), data);
    };

    return {
        deposits,
        expenses,
        loading,
        addDeposit,
        addExpense,
        updateExpense,
        updateDeposit
    };
}
