import React, { useState, useEffect } from "react";
import confetti from 'canvas-confetti';
import { useCookingSchedule } from "@/hooks/useCookingSchedule";
import { motion } from "framer-motion";
import { useCountUp } from "@/hooks/useCountUp";
import Layout from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { SpendingBreakdown } from "@/components/SpendingBreakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, IndianRupee, PieChart, TrendingUp, TrendingDown, PiggyBank, FileText, Zap, Droplets, Wifi, Home as HomeIcon, Flame, Car, Shield, UtensilsCrossed, Sun, Moon } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreUsers } from "@/hooks/useFirestoreUsers";
import { useBills } from "@/hooks/useBills";
import { useAppState } from "@/state/AppState";


export default function Dashboard() {
  const { bills, loading: billsLoading } = useBills();
  const { deposits, expenses, loading: txLoading } = useTransactions();
  const { userProfile, loading: authLoading } = useAuth();
  const { users: members, loading: usersLoading } = useFirestoreUsers();
  const { settings, updateSettings } = useAppState();
  const { getTodayEntry, getTeamStreak, getCurrentMonthSchedule } = useCookingSchedule();

  const todayCooking = getTodayEntry();
  const currentMonthSchedule = getCurrentMonthSchedule();

  // Gather unique team names for streaks display
  const uniqueTeams = Array.from(
    new Set(
      currentMonthSchedule?.days.flatMap(d => [d.morningTeam, d.nightTeam]) || []
    )
  ).filter(Boolean);

  const isLoading = txLoading || billsLoading;

  // Filter based on active period start
  const activePeriodStart = settings?.general?.activePeriodStart || '1970-01-01';

  // Helper for robust date comparison
  const getTimestamp = (dateStr: string) => {
    if (!dateStr) return 0;
    // Handle YYYY-MM-DD or DD/MM/YYYY
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const activePeriodTimestamp = getTimestamp(activePeriodStart);

  // Stats for the current logged-in user (string date comparison — reliable for YYYY-MM-DD)
  const userDeposits = deposits.filter(d =>
    d.uid === userProfile?.uid &&
    (!d.date || d.date >= activePeriodStart) &&
    (d.status === 'confirmed' || !d.status)
  );
  const userExpensesForContribution = expenses.filter(e =>
    e.uid === userProfile?.uid &&
    e.type === 'self' &&
    (!e.date || e.date >= activePeriodStart) &&
    (e.status === 'confirmed' || e.status === 'reimbursement_requested' || e.status === 'reimbursement_eligible' || e.status === 'reimbursed' || !e.status)
  );

  const deposited = userDeposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const selfSpent = userExpensesForContribution.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const userTotalContribution = deposited + selfSpent;

  // Confetti logic
  useEffect(() => {
    if (isLoading || authLoading || !userProfile) return;

    const target = userProfile.monthlyTarget || 1500;
    const hasMetTarget = userTotalContribution >= target;
    const sessionKey = `confetti_fired_${userProfile.uid}_${activePeriodStart}`;
    const hasFired = sessionStorage.getItem(sessionKey);

    if (hasMetTarget && !hasFired) {
      // Small delay to ensure they see the dashboard first
      const timer = setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.7 },
          zIndex: 1000,
          colors: ['#00E5FF', '#2979FF', '#00E676', '#FFEA00', '#FF3D00']
        });
        sessionStorage.setItem(sessionKey, 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [userTotalContribution, userProfile, isLoading, authLoading, activePeriodStart]);

  if (authLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Authenticating...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── BUSINESS RULES ─────────────────────────────────────────────────────────
  // SELF EXPENSE:  member contribution toward target + virtual deposit + total expenses.
  //                Central Fund Balance is NOT affected.
  // FUND EXPENSE:  deducted from Central Fund Balance + added to Total Expenses.
  // ─────────────────────────────────────────────────────────────────────────────

  // Helper: date string comparison (YYYY-MM-DD) — more reliable than timestamp UTC conversion
  // If date is missing, treat as always included (don't lose data)
  const isInPeriod = (dateStr: string | undefined) => {
    if (!dateStr) return true;
    return dateStr >= activePeriodStart;
  };

  // Helper: normalize type — treat missing type as 'fund' (safe default)
  const isFundExpense = (e: any) => !e.type || e.type === 'fund';
  const isSelfExpense = (e: any) => e.type === 'self';

  // Status checks
  const isActiveStatus = (status: string | undefined) =>
    !status || status === 'confirmed' || status === 'reimbursement_requested' ||
    status === 'reimbursement_eligible' || status === 'reimbursed';

  // Central Fund Balance = all-time real cash deposits − all-time fund-only expenses
  const explicitDepositsAllTime = deposits
    .filter(d => d.status === 'confirmed' || !d.status)
    .reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const fundSpentAllTime = expenses
    .filter(e => isFundExpense(e) && isActiveStatus(e.status))
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const fundBalance = explicitDepositsAllTime - fundSpentAllTime; // Central Fund Balance

  // Period figures (string comparison on YYYY-MM-DD — no timezone issues)
  const cashDepositsPeriod = deposits
    .filter(d => (d.status === 'confirmed' || !d.status) && isInPeriod(d.date))
    .reduce((s, d) => s + (Number(d.amount) || 0), 0);

  // Self-expenses this period (counted as virtual deposits from member's own pocket)
  const selfSpentConfirmed = expenses
    .filter(e => isSelfExpense(e) && isActiveStatus(e.status) && isInPeriod(e.date))
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Fund expenses this period
  const fundSpentPeriod = expenses
    .filter(e => isFundExpense(e) && isActiveStatus(e.status) && isInPeriod(e.date))
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // ─── FINAL TOTALS ───────────────────────────────────────────────────────────
  // Total Deposited = cash deposits + self-expenses (self is a virtual deposit)
  const totalDeposited = cashDepositsPeriod + selfSpentConfirmed;
  // Total Expenses = fund expenses + self-expenses
  const totalSpent = fundSpentPeriod + selfSpentConfirmed;
  const fundRemaining = fundBalance;

  // Brief diagnostic log
  console.log('[Dashboard]', { activePeriodStart, expenseCount: expenses.length, depositCount: deposits.length, totalSpent, totalDeposited });

  // Animated counters
  const displayFundBalance = useCountUp(fundBalance);
  const displayUserContribution = useCountUp(userTotalContribution);
  const displayTotalDeposited = useCountUp(totalDeposited);
  const displayTotalSpent = useCountUp(totalSpent);
  const displayFundRemaining = useCountUp(fundRemaining);

  const now = new Date();
  const currentMonth = now.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const member = {
    name: userProfile?.name || 'User',
    target: userProfile?.monthlyTarget || 0,
    deposited: userTotalContribution,
    selfSpent: selfSpent,
    reimbursementEligible: expenses.filter(e => e.uid === userProfile?.uid && (e.status === 'reimbursement_eligible' || e.status === 'reimbursement_requested')).reduce((s, e) => s + (e.amount || 0), 0)
  };

  const recentTransactions = [
    ...deposits.map(d => ({ id: `d-${d.id}`, type: 'deposit', amount: Number(d.amount || 0), date: d.date, note: d.note, userName: d.userName, category: undefined, createdAt: d.createdAt })),
    ...expenses.map(e => ({ id: `e-${e.id}`, type: 'expense', amount: Number(e.amount || 0), date: e.date, note: e.note, category: e.category, userName: e.userName, createdAt: e.createdAt }))
  ]
    .sort((a, b) => {
      // Primary: sort by createdAt timestamp (most recent first)
      const timeA = a.createdAt?.seconds ??
        (typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() / 1000 : Infinity) ??
        Infinity;
      const timeB = b.createdAt?.seconds ??
        (typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() / 1000 : Infinity) ??
        Infinity;

      if (timeB !== timeA) {
        if (timeB === Infinity && timeA === Infinity) return 0;
        return timeB > timeA ? 1 : -1;
      }

      // Secondary: sort by date string
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 10); // Limit to last 10 transactions
  const sharedBills = bills.map(b => {
    const userPaymentStatus = b.memberPayments?.[userProfile?.uid || ''] || 'pending';
    return {
      type: b.type,
      amount: b.amount,
      perMember: b.perMemberShare,
      status: userPaymentStatus
    };
  });

  const navigate = useNavigate();

  const handleExportSummary = (type: 'pdf' | 'excel') => {
    // Combine and format data for a single summary report
    const columns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Type', dataKey: 'type' },
      { header: 'Member', dataKey: 'userName' },
      { header: 'Note/Category', dataKey: 'note' },
      { header: 'Amount (INR)', dataKey: 'amount' },
    ];

    const reportData = [
      ...recentTransactions.map(tx => ({
        ...tx,
        note: tx.type === 'expense' ? `[Expense] ${tx.category}: ${tx.note}` : `[Deposit] ${tx.note}`
      }))
    ];

    const exportParams = {
      title: `Monthly Financial Summary - ${currentMonth}`,
      filename: `flatfund_summary_${currentMonth.replace(' ', '_')}`,
      columns,
      data: reportData
    };

    if (type === 'pdf') {
      exportToPDF(exportParams);
    } else {
      exportToExcel(exportParams);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{currentMonth}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportSummary('pdf')}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSummary('excel')}>
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => navigate('/deposits')} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Deposit
            </Button>
            <Button variant="outline" onClick={() => navigate('/expenses')} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Fund Balance Card */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-card glass-card-hover border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5" />
                Central Fund Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-9 w-48 mb-1" />
              ) : (
                <div className="text-3xl font-bold text-green-600 flex items-center">
                  <IndianRupee className="h-6 w-6" />
                  <motion.span>{displayFundBalance}</motion.span>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Available for group expenses
              </p>
            </CardContent>
          </Card>

          {/* Personal Progress Card */}
          <Card className="glass-card glass-card-hover border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Your Monthly Progress</span>
                {isLoading ? (
                  <Skeleton className="h-5 w-24 rounded-full" />
                ) : (
                  <Badge className={(() => {
                    const target = userProfile?.monthlyTarget || 1500;
                    if (userTotalContribution < 1000) return "bg-orange-100 text-orange-700 border-orange-200";
                    if (userTotalContribution < target) return "bg-green-100 text-green-700 border-green-200";
                    if (userTotalContribution === target) return "bg-green-600 text-white border-green-700";
                    return "bg-blue-100 text-blue-700 border-blue-200";
                  })()}>
                    {(() => {
                      const target = userProfile?.monthlyTarget || 1500;
                      if (userTotalContribution < 1000) return "Behind Target";
                      if (userTotalContribution < target) return "On Track";
                      if (userTotalContribution === target) return "Target Met";
                      return "Above Target";
                    })()}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                  {isLoading ? (
                    <Skeleton className="h-8 w-32 mb-1" />
                  ) : (
                    <div className="text-2xl font-bold text-primary flex items-center">
                      <IndianRupee className="h-5 w-5" />
                      <motion.span>{displayUserContribution}</motion.span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Total Contribution</p>
                </div>
                <div className="text-left sm:text-right">
                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24 sm:ml-auto" />
                      <Skeleton className="h-3 w-20 sm:ml-auto" />
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-medium">Target: ₹{(userProfile?.monthlyTarget || 1500).toLocaleString("en-IN")}</div>
                      <p className="text-xs text-muted-foreground">
                        {userTotalContribution >= (userProfile?.monthlyTarget || 1500)
                          ? `Extra: ₹${(userTotalContribution - (userProfile?.monthlyTarget || 1500)).toLocaleString("en-IN")}`
                          : `Due: ₹${(Math.max(0, (userProfile?.monthlyTarget || 1500) - userTotalContribution)).toLocaleString("en-IN")}`
                        }
                      </p>
                    </>
                  )}
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-2 w-full rounded-full" />
              ) : (
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(100, (userTotalContribution / (userProfile?.monthlyTarget || 1500 || 1)) * 100)}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fund Totals Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="glass-card glass-card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Deposited</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  <IndianRupee className="h-5 w-5 inline-block mr-2" />
                  <motion.span>{displayTotalDeposited}</motion.span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">Cash deposits + self-paid expenses</p>
            </CardContent>
          </Card>

          <Card className="glass-card glass-card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-red-600">
                  <IndianRupee className="h-5 w-5 inline-block mr-2" />
                  <motion.span>{displayTotalSpent}</motion.span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">Fund expenses + member self-paid expenses</p>
            </CardContent>
          </Card>

          <Card className="glass-card glass-card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fund Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-primary">
                  <IndianRupee className="h-5 w-5 inline-block mr-2" />
                  <motion.span>{displayFundRemaining}</motion.span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">Total balance available in the fund</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Cooking Schedule */}
        {todayCooking && (
          <Card className="glass-card glass-card-hover border-orange-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                Today's Cooking Duty
                <Badge variant="outline" className="ml-auto text-xs font-normal">
                  {todayCooking.date} · {todayCooking.dayName}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Morning */}
                <div className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-card/40 ${
                  todayCooking.morningDone
                    ? 'border-green-500/30 shadow-sm shadow-green-500/10'
                    : 'border-yellow-500/30'
                }`}>
                  <Sun className="h-6 w-6 text-yellow-500" />
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Morning</div>
                  <div className="text-base font-bold text-center">{todayCooking.morningTeam}</div>
                  {todayCooking.morningDone ? (
                    <Badge className="bg-green-500 text-white text-[10px]">✓ Done</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/50">Pending</Badge>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Flame className="h-3 w-3 text-orange-400" />
                    Streak: <span className="font-bold text-orange-600">{getTeamStreak(todayCooking.morningTeam)}🔥</span>
                  </div>
                </div>

                {/* Night */}
                <div className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-card/40 ${
                  todayCooking.nightDone
                    ? 'border-green-500/30 shadow-sm shadow-green-500/10'
                    : 'border-indigo-500/30'
                }`}>
                  <Moon className="h-6 w-6 text-indigo-500" />
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Night</div>
                  <div className="text-base font-bold text-center">{todayCooking.nightTeam}</div>
                  {todayCooking.nightDone ? (
                    <Badge className="bg-green-500 text-white text-[10px]">✓ Done</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-indigo-400 border-indigo-400/50">Pending</Badge>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Flame className="h-3 w-3 text-orange-400" />
                    Streak: <span className="font-bold text-orange-600">{getTeamStreak(todayCooking.nightTeam)}🔥</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Streaks Leaderboard */}
        {uniqueTeams.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-5 w-5 text-orange-500" />
                Team Streaks Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {uniqueTeams.sort((a,b) => getTeamStreak(b) - getTeamStreak(a)).map(team => {
                  const streak = getTeamStreak(team);
                  return (
                    <div 
                      key={team} 
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border bg-card/40 relative overflow-hidden group ${
                        streak >= 7 ? 'border-orange-500/30 shadow-sm shadow-orange-500/10' : 
                        streak >= 3 ? 'border-yellow-500/30 shadow-sm shadow-yellow-500/10' : 'border-white/5'
                      }`}
                    >
                      {streak >= 3 && (
                        <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-40 transition-opacity">
                          <Flame className={`h-8 w-8 ${streak >= 7 ? 'text-orange-500' : 'text-yellow-500'}`} />
                        </div>
                      )}
                      <div className="text-xs font-bold text-muted-foreground truncate w-full text-center mb-1">{team}</div>
                      <div className={`text-xl font-black ${
                        streak >= 7 ? 'text-orange-600' : 
                        streak >= 3 ? 'text-yellow-600' : 'text-muted-foreground'
                      }`}>
                        {streak} <span className="text-sm">🔥</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Spending Breakdown */}
        <SpendingBreakdown expenses={expenses} isLoading={isLoading} />

        {/* Recent Transactions & Shared Bills */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {txLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                      <div className="flex items-center gap-3 w-full">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="space-y-1 w-full">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-16 shrink-0" />
                    </div>
                  ))
                ) : recentTransactions.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No Transactions"
                    description="Your recent activity will appear here once you start adding transactions."
                    actionLabel="Add First"
                    onAction={() => navigate('/deposits')}
                  />
                ) : (
                  recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg glass-card border-white/5 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-full shrink-0 ${transaction.type === 'deposit'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-100 text-red-600'
                          }`}>
                          {transaction.type === 'deposit' ?
                            <TrendingDown className="h-4 w-4" /> :
                            <TrendingUp className="h-4 w-4" />
                          }
                        </div>
                        <div className="min-w-0 flex-1 grid gap-0.5">
                          <div className="font-medium text-sm leading-tight break-words pr-2">
                            {transaction.userName ? `${transaction.userName} — ${transaction.note}` : transaction.note}
                          </div>
                          <div className="text-xs text-muted-foreground break-words">
                            {transaction.date}
                            {transaction.category && ` • ${transaction.category}`}
                          </div>
                        </div>
                      </div>
                      <div className={`font-medium whitespace-nowrap tabular-nums shrink-0 ${transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {transaction.type === 'deposit' ? '+' : '-'}₹{transaction.amount}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shared Bills Status */}
          <Card>
            <CardHeader>
              <CardTitle>Shared Bills Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {billsLoading ? (
                  Array(2).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                      <div className="flex items-center gap-3 w-full">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="space-y-1 w-full">
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                    </div>
                  ))
                ) : sharedBills.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No Active Bills"
                    description="When a group bill is generated, it will show up here for tracking."
                  />
                ) : (
                  sharedBills.map((bill, index) => {
                    const getBillIcon = (type: string) => {
                      const lowerType = (type || '').toLowerCase();
                      if (lowerType.includes('electricity')) return <Zap className="h-4 w-4" />;
                      if (lowerType.includes('water')) return <Droplets className="h-4 w-4" />;
                      if (lowerType.includes('wifi') || lowerType.includes('internet')) return <Wifi className="h-4 w-4" />;
                      if (lowerType.includes('rent')) return <HomeIcon className="h-4 w-4" />;
                      if (lowerType.includes('gas')) return <Flame className="h-4 w-4" />;
                      if (lowerType.includes('parking')) return <Car className="h-4 w-4" />;
                      if (lowerType.includes('security')) return <Shield className="h-4 w-4" />;
                      return <FileText className="h-4 w-4" />;
                    };

                    return (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg glass-card border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${bill.status === 'paid'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-orange-100 text-orange-600'
                            }`}>
                            {getBillIcon(bill.type)}
                          </div>
                          <div>
                            <div className="font-medium">{bill.type}</div>
                            <div className="text-sm text-muted-foreground">
                              Your share: ₹{bill.perMember}
                            </div>
                          </div>
                        </div>
                        <Badge variant={bill.status === 'paid' ? 'default' : 'secondary'}>
                          {bill.status === 'paid' ? 'Paid' : 'Pending'}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
