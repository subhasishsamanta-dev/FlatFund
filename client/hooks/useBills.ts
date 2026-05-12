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

const getSafeTime = (createdAt: any) => {
    if (!createdAt) return Infinity;
    if (typeof createdAt.seconds === 'number') return createdAt.seconds;
    if (typeof createdAt.toMillis === 'function') return createdAt.toMillis() / 1000;
    return Infinity;
};

export interface Bill {
    id: string;
    type: string;
    amount: number;
    dueDate: string;
    billingMonth: string;
    perMemberShare: number;
    paidBy: string;
    status: 'pending' | 'partial' | 'paid';
    invoiceNumber?: string;
    memberPayments: Record<string, 'pending' | 'paid'>;
    createdAt: any;
    createdBy: string;
}

export function useBills() {
    const [bills, setBills] = useState<Bill[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { userProfile } = useAuth();

    useEffect(() => {
        const q = query(collection(db, 'bills'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const billsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Bill[];

                // Client-side sorting: most recent or latest due date first
                const sortedData = [...billsData].sort((a, b) => {
                    // Primary sort: due date (descending)
                    const dateA = new Date(a.dueDate || 0).getTime();
                    const dateB = new Date(b.dueDate || 0).getTime();
                    if (dateB !== dateA) return dateB - dateA;

                    // Secondary sort: createdAt
                    const timeA = getSafeTime(a.createdAt);
                    const timeB = getSafeTime(b.createdAt);
                    if (timeB === timeA) return 0;
                    return timeB > timeA ? 1 : -1;
                });

                setBills(sortedData);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching bills:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const addBill = async (data: Omit<Bill, 'id' | 'createdAt' | 'createdBy'>) => {
        if (!userProfile) throw new Error("Must be logged in to add bill");

        const result = await addDoc(collection(db, 'bills'), {
            ...data,
            createdBy: userProfile.uid,
            createdAt: serverTimestamp()
        });

        // Trigger push notification (fire-and-forget)
        fetch('/api/bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userProfile.uid,
                userName: userProfile.name,
                billTitle: data.type,
                amount: data.amount,
                perMemberShare: data.perMemberShare
            })
        }).catch(() => { });

        return result;
    };

    const updateBill = async (id: string, data: Partial<Bill>) => {
        const billRef = doc(db, 'bills', id);
        await updateDoc(billRef, data);
    };

    const deleteBill = async (id: string) => {
        await deleteDoc(doc(db, 'bills', id));
    };

    return {
        bills,
        loading,
        error,
        addBill,
        updateBill,
        deleteBill
    };
}
