import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface MonthlyArchive {
    id: string; // The period name (e.g., "January 2026")
    period: string;
    archivedAt: any;
    summary: {
        totalBills: number;
        totalExpenses: number;
        totalDeposits: number;
    };
    data: {
        bills: any[];
        expenses: any[];
        deposits: any[];
    };
}

export function useMonthlyArchives() {
    const [archives, setArchives] = useState<MonthlyArchive[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'archivedMonths'), orderBy('archivedAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const archivesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as MonthlyArchive[];
                setArchives(archivesData);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching archives:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return { archives, loading, error };
}
