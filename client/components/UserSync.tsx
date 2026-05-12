import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppState, Member } from '../state/AppState';

export function UserSync() {
    const { userProfile, loading } = useAuth();
    const { setUser, user } = useAppState();

    useEffect(() => {
        if (loading) return;

        if (userProfile) {
            // Only update if the user in AppState is different or null
            if (!user || user.id !== userProfile.uid) {

                // Map UserProfile to Member type
                // Note: Some fields might need default values if missing in UserProfile
                const mappedUser: Member = {
                    id: userProfile.uid,
                    name: userProfile.name,
                    email: userProfile.email,
                    phone: userProfile.phone || '',
                    avatar: userProfile.avatar || '',
                    joinDate: userProfile.joinedAt,
                    isActive: userProfile.isActive,
                    isAdmin: userProfile.role === 'admin',
                    target: userProfile.monthlyTarget,
                    lastLogin: new Date().toISOString(), // Or keep track in auth context
                    twoFactorEnabled: userProfile.twoFactorEnabled,
                    // Initialize stats if not present (these usually come from a different logic/store, 
                    // but for now we initialize empty or rely on AppState reducer if it merges, 
                    // but SET_USER replaces it. Realistically we might need to fetch Member stats separately 
                    // or assume they are loaded via other means. For this sync, we just set identity.)
                    statistics: {
                        totalDeposits: 0,
                        totalExpenses: 0,
                        monthsActive: 0,
                        avgMonthlyContribution: 0,
                        reimbursementsReceived: 0,
                        currentStreak: 0,
                    },
                    recentActivity: [],
                    ...userProfile // Spread any other matching fields
                };

                setUser(mappedUser);
            }
        } else {
            // If no userProfile (logged out), ensure AppState user is null
            if (user) {
                setUser(null);
            }
        }
    }, [userProfile, loading, setUser, user]);

    return null; // This component renders nothing
}
