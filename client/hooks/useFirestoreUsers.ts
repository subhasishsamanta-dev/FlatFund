import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface FirestoreUser {
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

export function useFirestoreUsers() {
    const [users, setUsers] = useState<FirestoreUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const q = query(collection(db, 'users'));

            const unsubscribe = onSnapshot(
                q,
                (snapshot) => {
                    const usersData = snapshot.docs.map(doc => ({
                        ...doc.data(),
                        uid: doc.id,
                    })) as FirestoreUser[];

                    // Client-side sorting by name
                    const sortedData = [...usersData].sort((a, b) =>
                        (a.name || '').localeCompare(b.name || '')
                    );

                    setUsers(sortedData);
                    setLoading(false);
                },
                (err) => {
                    console.error('Error fetching users:', err);
                    setError(err.message);
                    setLoading(false);
                }
            );

            return () => unsubscribe();
        } catch (err: any) {
            console.error('Error setting up users listener:', err);
            setError(err.message);
            setLoading(false);
        }
    }, []);

    const updateUser = async (uid: string, data: Partial<FirestoreUser>) => {
        await updateDoc(doc(db, 'users', uid), data);
    };

    return { users, loading, error, updateUser };
}
