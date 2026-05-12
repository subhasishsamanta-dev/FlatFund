import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getDefaultAvatar } from "@/lib/avatar";

export type Member = {
  id: number | string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  joinDate?: string;
  isActive?: boolean;
  isAdmin?: boolean;
  target?: number;
  deposited?: number;
  selfSpent?: number;
  extra?: number;
  reimbursementRequests?: number;
  lastActivity?: string;
  status?: string;
  lastLogin?: string;
  twoFactorEnabled?: boolean;
  statistics?: {
    totalDeposits: number;
    totalExpenses: number;
    monthsActive: number;
    avgMonthlyContribution: number;
    reimbursementsReceived: number;
    currentStreak: number;
  };
  recentActivity?: any[];
};

export type Deposit = {
  id: number | string;
  memberId?: number | string;
  memberName?: string;
  memberAvatar?: string;
  amount: number;
  date: string;
  reference?: string;
  note?: string;
  status?: string;
};

export type Expense = {
  id: number | string;
  memberId?: number | string;
  memberName?: string;
  memberAvatar?: string;
  amount: number;
  date: string;
  category?: string;
  categoryIcon?: any;
  note?: string;
  type?: string; // fund | self
  status?: string;
  receipt?: boolean;
};

export type Bill = {
  id: number | string;
  type: string;
  icon?: any;
  amount: number;
  dueDate?: string;
  billingMonth?: string;
  perMemberShare?: number;
  paidBy?: string;
  status?: string;
  invoiceNumber?: string;
  memberPayments?: Record<string | number, string>;
};

export type SettingsState = {
  general: {
    currency: string;
    timezone: string;
    dateFormat: string;
    defaultTarget: number;
    lowFundThreshold: number;
    activePeriodStart?: string; // YYYY-MM-DD
    nextBillDueDate?: string; // YYYY-MM-DD
  };
  notifications: Record<string, boolean>;
  policies: Record<string, any>;
  categories?: Array<{ id: number | string; value: string; label: string; icon?: string; color?: string; isDefault?: boolean }>;
};

type State = {
  members: Member[];
  deposits: Deposit[];
  expenses: Expense[];
  bills: Bill[];
  settings: SettingsState;
  user: Member | null;
};

const initialState: State = {
  members: [],
  deposits: [],
  expenses: [],
  bills: [],
  settings: {
    general: {
      currency: "INR",
      timezone: "Asia/Kolkata",
      dateFormat: "DD/MM/YYYY",
      defaultTarget: 1500,
      lowFundThreshold: 1000,
      activePeriodStart: new Date().toISOString().split('T')[0].slice(0, 7) + '-01', // Default to 1st of current month
    },
    notifications: {
      emailNotifications: true,
      depositNotifications: true,
      expenseNotifications: true,
      reimbursementNotifications: true,
      billReminders: true,
      monthCloseNotifications: true,
    },
    policies: {
      allowPendingSpends: false,
      requireReceipts: false,
      autoApproveReimbursements: false,
      lockWindow: 3,
    },
    categories: [],
  },
  user: null,
};

type Action =
  | { type: "ADD_MEMBER"; payload: Member }
  | { type: "UPDATE_MEMBER"; payload: Member }
  | { type: "REMOVE_MEMBER"; payload: { id: number | string } }
  | { type: "SET_MEMBERS"; payload: Member[] }
  | { type: "ADD_DEPOSIT"; payload: Deposit }
  | { type: "SET_DEPOSITS"; payload: Deposit[] }
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "UPDATE_EXPENSE"; payload: Expense }
  | { type: "SET_EXPENSES"; payload: Expense[] }
  | { type: "ADD_BILL"; payload: Bill }
  | { type: "UPDATE_BILL"; payload: Bill }
  | { type: "SET_BILLS"; payload: Bill[] }
  | { type: "UPDATE_SETTINGS"; payload: Partial<SettingsState> }
  | { type: "SET_USER"; payload: Member | null };



function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_MEMBER":
      return { ...state, members: [...state.members, action.payload] };
    case "UPDATE_MEMBER":
      return {
        ...state,
        members: state.members.map((m) => (m.id === action.payload.id ? action.payload : m)),
      };
    case "REMOVE_MEMBER":
      return { ...state, members: state.members.filter((m) => m.id !== action.payload.id) };
    case "SET_MEMBERS":
      return { ...state, members: action.payload };
    case "ADD_DEPOSIT":
      return { ...state, deposits: [...state.deposits, action.payload] };
    case "SET_DEPOSITS":
      return { ...state, deposits: action.payload };
    case "ADD_EXPENSE":
      return { ...state, expenses: [...state.expenses, action.payload] };
    case "UPDATE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.map((e) => (e.id === action.payload.id ? action.payload : e)),
      };
    case "SET_EXPENSES":
      return { ...state, expenses: action.payload };
    case "ADD_BILL":
      return { ...state, bills: [...state.bills, action.payload] };
    case "UPDATE_BILL":
      return { ...state, bills: state.bills.map((b) => (b.id === action.payload.id ? action.payload : b)) };
    case "SET_BILLS":
      return { ...state, bills: action.payload };
    case "UPDATE_SETTINGS": {
      const payload = action.payload;
      const currentSettings = state.settings;
      return {
        ...state,
        settings: {
          ...currentSettings,
          ...payload, // Merge top-level primitives
          general: payload.general ? { ...currentSettings.general, ...payload.general } : currentSettings.general,
          notifications: payload.notifications ? { ...currentSettings.notifications, ...payload.notifications } : currentSettings.notifications,
          policies: payload.policies ? { ...currentSettings.policies, ...payload.policies } : currentSettings.policies,
          categories: payload.categories ? payload.categories : currentSettings.categories
        }
      };
    }
    case "SET_USER":
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

const AppStateContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Sync settings with Firestore on mount
  useEffect(() => {
    try {
      const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<SettingsState>;
          dispatch({ type: "UPDATE_SETTINGS", payload: data });
        }
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up settings listener:", err);
    }
  }, []);

  return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
};

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");

  const { state, dispatch } = ctx;

  const actions = {
    addMember: (member: Member) => dispatch({ type: "ADD_MEMBER", payload: member }),
    updateMember: (member: Member) => dispatch({ type: "UPDATE_MEMBER", payload: member }),
    removeMember: (id: number | string) => dispatch({ type: "REMOVE_MEMBER", payload: { id } }),
    setMembers: (members: Member[]) => dispatch({ type: "SET_MEMBERS", payload: members }),

    addDeposit: (deposit: Deposit) => dispatch({ type: "ADD_DEPOSIT", payload: deposit }),
    setDeposits: (deposits: Deposit[]) => dispatch({ type: "SET_DEPOSITS", payload: deposits }),

    addExpense: (expense: Expense) => dispatch({ type: "ADD_EXPENSE", payload: expense }),
    updateExpense: (expense: Expense) => dispatch({ type: "UPDATE_EXPENSE", payload: expense }),
    setExpenses: (expenses: Expense[]) => dispatch({ type: "SET_EXPENSES", payload: expenses }),

    addBill: (bill: Bill) => dispatch({ type: "ADD_BILL", payload: bill }),
    updateBill: (bill: Bill) => dispatch({ type: "UPDATE_BILL", payload: bill }),
    setBills: (bills: Bill[]) => dispatch({ type: "SET_BILLS", payload: bills }),

    updateSettings: async (partial: Partial<SettingsState>) => {
      // Optimistic update
      dispatch({ type: "UPDATE_SETTINGS", payload: partial });

      // Update in Firestore
      try {
        // We need to merge with existing settings in Firestore
        // Since we don't have the full state here easily without prop drilling or refetching,
        // we rely on setDoc with merge: true
        await setDoc(doc(db, 'settings', 'global'), partial, { merge: true });
      } catch (error) {
        console.error("Failed to persist settings:", error);
        // Optionally revert state here if needed
      }
    },
    setUser: (user: Member | null) => dispatch({ type: "SET_USER", payload: user }),
  };

  return { ...state, ...actions };
}
