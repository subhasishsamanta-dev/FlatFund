import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  IndianRupee,
  TrendingUp,
  Settings,
  Eye,
  MoreHorizontal,
  Archive,
  CalendarCheck,
  Users,
  Download,
  History,
  FileText,
  BarChart,
  UtensilsCrossed,
  Upload,
  Sun,
  Moon,
  Flame,
  Trash2
} from "lucide-react";
import { useAppState } from "@/state/AppState";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreUsers } from "@/hooks/useFirestoreUsers";
import { useTransactions } from "@/hooks/useTransactions";
import { useBills } from "@/hooks/useBills";
import { useMonthlyArchives, MonthlyArchive } from "@/hooks/useMonthlyArchives";
import { useCookingSchedule, parseCookingCSV, CookingDay } from "@/hooks/useCookingSchedule";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCategoryIcon } from "@/lib/icons";
import { archiveMonth } from "@/lib/archiver";
import { sendNotification } from "@/lib/notifications";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { getDefaultAvatar } from "@/lib/avatar";
import { useState } from "react";
import html2canvas from "html2canvas";
import { cn } from "@/lib/utils";
import { format, addMonths, startOfMonth } from 'date-fns';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";


export default function AdminDashboard() {
  const { settings, updateSettings } = useAppState();
  const { bills } = useBills();
  const { users: firestoreUsers, updateUser } = useFirestoreUsers();
  const { deposits, expenses, addExpense: addExpenseToFirestore, updateExpense: updateExpenseInFirestore } = useTransactions();
  const { archives, loading: archivesLoading } = useMonthlyArchives();
  const { toast } = useToast();

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isCloseMonthOpen, setIsCloseMonthOpen] = useState(false);

  // Member actions state
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [isEditTargetOpen, setIsEditTargetOpen] = useState(false);
  const [editTargetValue, setEditTargetValue] = useState<number>(1500);
  const [selectedArchive, setSelectedArchive] = useState<MonthlyArchive | null>(null);
  const [isArchiveDetailsOpen, setIsArchiveDetailsOpen] = useState(false);
  const [archivePeriodName, setArchivePeriodName] = useState(format(new Date(), 'MMMM yyyy'));
  const [nextPeriodStartDate, setNextPeriodStartDate] = useState(format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [isClosingMonth, setIsClosingMonth] = useState(false);

  // Cooking schedule state
  const {
    schedules: cookingSchedules,
    loading: cookingLoading,
    uploadSchedule,
    toggleAttendance,
    deleteSchedule: deleteCookingSchedule,
    getTeamStreak,
  } = useCookingSchedule();
  const [csvError, setCsvError] = useState<string>('');
  const [csvUploading, setCsvUploading] = useState(false);
  const [cookingViewMonth, setCookingViewMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    setCsvUploading(true);
    try {
      const text = await file.text();
      const days = parseCookingCSV(text);
      if (days.length === 0) throw new Error('No valid rows found in CSV.');
      // Determine month from first day's date
      const firstDate = days[0].date; // YYYY-MM-DD
      const month = firstDate.slice(0, 7);  // YYYY-MM
      // Check if existing schedule; preserve existing morningDone/nightDone values
      const existing = cookingSchedules.find(s => s.month === month);
      let mergedDays = days;
      if (existing) {
        mergedDays = days.map(d => {
          const prev = existing.days.find(p => p.date === d.date);
          return prev ? { ...d, morningDone: prev.morningDone, nightDone: prev.nightDone } : d;
        });
      }
      await uploadSchedule(month, mergedDays);
      setCookingViewMonth(month);
      alert(`Schedule for ${month} uploaded successfully (${days.length} days).`);
    } catch (err: any) {
      setCsvError(err.message || 'Failed to parse CSV.');
    } finally {
      setCsvUploading(false);
      e.target.value = '';
    }
  };

  const handleToggleAttendance = async (
    month: string,
    date: string,
    slot: 'morningDone' | 'nightDone',
    value: boolean
  ) => {
    try {
      await toggleAttendance(month, date, slot, value);
      toast({
        title: value ? "Attendance Marked" : "Attendance Removed",
        description: `Successfully updated attendance for ${date}`,
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    }
  };

  const viewedSchedule = cookingSchedules.find(s => s.month === cookingViewMonth);

  // Gather unique team names for streak display
  const uniqueTeams = Array.from(
    new Set(
      cookingSchedules.flatMap(s => s.days.flatMap(d => [d.morningTeam, d.nightTeam]))
    )
  ).filter(Boolean);

  // Filter based on active period start
  const activePeriodStart = settings?.general?.activePeriodStart || '1970-01-01';

  // Categories from settings
  const categories = settings?.categories || [];

  // Helper for robust date comparison
  const getTimestamp = (dateStr: string) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const activePeriodTimestamp = getTimestamp(activePeriodStart);

  // Convert Firestore users to Member format for dashboard display
  const members = firestoreUsers.map(user => {
    // Only count deposits/expenses AFTER the activePeriodStart
    const userDeposits = deposits.filter(d => d.uid === user.uid && getTimestamp(d.date) >= activePeriodTimestamp && (d.status === 'confirmed' || !d.status));
    // Member contribution includes self-spent that hasn't been reimbursed yet
    const userExpenses = expenses.filter(e => e.uid === user.uid && e.type === 'self' && getTimestamp(e.date) >= activePeriodTimestamp && (e.status === 'confirmed' || e.status === 'reimbursement_requested' || e.status === 'reimbursement_eligible' || !e.status));

    const deposited = userDeposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const selfSpent = userExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // Status calculation
    const totalContribution = deposited + selfSpent;
    const target = user.monthlyTarget || 1500;
    let status = 'behind';
    if (totalContribution >= 1000) status = 'on-track';
    if (totalContribution === target) status = 'target-met';
    if (totalContribution > target) status = 'ahead';

    const pendingReimbursementAmount = expenses
      .filter(e => e.uid === user.uid && (e.status === 'reimbursement_requested' || e.status === 'reimbursement_eligible'))
      .reduce((s, e) => s + (e.amount || 0), 0);

    return {
      id: user.uid,
      uid: user.uid,
      name: user.name,
      email: user.email,
      avatar: user.avatar || user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      target,
      deposited,
      selfSpent,
      totalContribution,
      reimbursementRequests: pendingReimbursementAmount,
      status,
      extra: Math.max(0, totalContribution - target)
    };
  });

  const explicitDepositsAllTime = deposits.filter(d => d.status === 'confirmed' || !d.status).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const fundSpentAllTime = expenses.filter(e => e.type === 'fund' && (e.status === 'confirmed' || e.status === 'reimbursed' || !e.status)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const fundBalance = explicitDepositsAllTime - fundSpentAllTime;

  // ─── BUSINESS RULES ─────────────────────────────────────────────────────────
  // SELF EXPENSE:  counted as member contribution + virtual deposit + total expense.
  //                Central Fund Balance is NOT affected.
  // FUND EXPENSE:  deducted from Central Fund Balance + added to Total Expenses.
  // ─────────────────────────────────────────────────────────────────────────────

  // Central Fund Balance = all-time cash deposits − all-time fund-only expenses
  const cashDepositsPeriod = deposits
    .filter(d => getTimestamp(d.date) >= activePeriodTimestamp && (d.status === 'confirmed' || !d.status))
    .reduce((s, d) => s + (Number(d.amount) || 0), 0);

  // Self-expenses this period (all valid statuses) — counted as virtual deposits
  const selfSpentPeriod = expenses
    .filter(e => e.type === 'self'
      && (e.status === 'confirmed' || e.status === 'reimbursement_requested' || e.status === 'reimbursement_eligible' || e.status === 'reimbursed' || !e.status)
      && getTimestamp(e.date) >= activePeriodTimestamp)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Total Deposited = cash deposits + self-expenses (self = member deposited own money)
  const totalDeposited = cashDepositsPeriod + selfSpentPeriod;

  // Fund expenses this period — these DO reduce Central Fund Balance
  const fundSpentPeriod = expenses
    .filter(e => e.type === 'fund'
      && (e.status === 'confirmed' || e.status === 'reimbursed' || !e.status)
      && getTimestamp(e.date) >= activePeriodTimestamp)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Total Expenses = fund expenses + self-expenses
  const totalSpent = fundSpentPeriod + selfSpentPeriod;

  const now = new Date();
  const currentMonth = now.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const pendingReimbursements = expenses.filter(e => e.status === 'reimbursement_requested' || e.status === 'reimbursement_eligible').map((e) => ({
    expenseId: e.id,
    uid: e.uid,
    userName: e.userName,
    amount: e.amount,
    description: e.note,
    date: e.date,
    category: e.category
  }));

  const { userProfile } = useAuth(); // Get current user profile for admin details

  const handleCloseMonth = async () => {
    try {
      if (!userProfile) {
        throw new Error("You must be logged in to perform this action.");
      }

      setIsClosingMonth(true);
      // 1. Perform Archiving using the user-specified period name and carry over the current balance
      const result = await archiveMonth(
        archivePeriodName,
        fundBalance,
        nextPeriodStartDate,
        {
          uid: userProfile.uid,
          name: userProfile.name,
          avatar: userProfile.avatar || ''
        }
      );

      if (!result.success) {
        throw new Error(result.error || "Archiving failed");
      }

      // 2. Update activePeriodStart in Settings to the user-specified start date
      await updateSettings({
        general: {
          ...settings.general,
          activePeriodStart: nextPeriodStartDate
        }
      });

      setIsCloseMonthOpen(false);
      alert(`Month closed successfully.\n\nArchived as: ${archivePeriodName}\nNew period starts on: ${nextPeriodStartDate}\nOpening Balance: ₹${fundBalance.toLocaleString()}`);

    } catch (error: any) {
      console.error("Failed to close month:", error);
      alert(`Failed to close month: ${error.message}`);
    } finally {
      setIsClosingMonth(false);
    }
  };

  const approveReimbursement = async (req: any) => {
    try {
      // create fund expense to deduct from fund
      const targetMember = firestoreUsers.find(u => u.uid === req.uid);
      const fundExpense = {
        uid: req.uid,
        userName: req.userName,
        userAvatar: targetMember?.avatar || '',
        amount: req.amount || 0,
        date: new Date().toISOString().split('T')[0],
        category: 'Reimbursement Payout',
        categoryIcon: 'Receipt',
        note: `Reimbursement paid for ${req.userName}`,
        type: 'fund' as const,
        status: 'confirmed',
        receipt: false,
      };

      await addExpenseToFirestore(fundExpense as any);

      // Notify the user
      await sendNotification(
        req.uid,
        'Reimbursement Approved',
        `Your request for ₹${req.amount} has been approved.`,
        'success'
      );

      // mark original expense as reimbursed
      await updateExpenseInFirestore(req.expenseId, { status: 'reimbursed' });

      // Trigger push notification to the member (fire-and-forget)
      fetch('/api/reimbursements/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: req.uid,
          amount: req.amount || 0,
          approved: true,
          adminName: userProfile?.name || 'Admin'
        })
      }).catch(() => { });
    } catch (error) {
      console.error("Error approving reimbursement:", error);
      alert("Failed to approve reimbursement");
    }
  };

  const handleEditTargetClick = (member: any) => {
    setSelectedMember(member);
    setEditTargetValue(member.target || 1500);
    setIsEditTargetOpen(true);
  };

  const handleViewDetailsClick = (member: any) => {
    setSelectedMember(member);
    setIsViewDetailsOpen(true);
  };

  const saveTarget = async () => {
    if (!selectedMember) return;
    try {
      await updateUser(selectedMember.uid, { monthlyTarget: Number(editTargetValue) });
      setIsEditTargetOpen(false);
      // Optional: Refresh or let realtime listener handle it (listener handles it)
    } catch (e) {
      console.error("Failed to update target:", e);
      alert("Failed to update target");
    }
  };

  const monthSummary = {
    totalDeposits: totalDeposited,
    totalExpenses: totalSpent,
    pendingReimbursements: pendingReimbursements.reduce((s, r) => s + (r.amount || 0), 0),
    activeBills: bills.length
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return 'bg-green-100 text-green-700';
      case 'behind': return 'bg-orange-100 text-orange-700';
      case 'ahead': return 'bg-blue-100 text-blue-700';
      case 'target-met': return 'bg-green-600 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'on-track': return 'On Track';
      case 'behind': return 'Behind Target';
      case 'ahead': return 'Above Target';
      case 'target-met': return 'Target Met';
      default: return 'Unknown';
    }
  };

  // --- Report Data Calculations ---

  const getColorHex = (colorClass: string) => {
    const map: Record<string, string> = {
      'text-red-500': '#ef4444',
      'text-yellow-600': '#ca8a04',
      'text-blue-500': '#3b82f6',
      'text-green-600': '#16a34a',
      'text-green-500': '#22c55e',
      'text-blue-400': '#60a5fa',
      'text-orange-600': '#ea580c',
      'text-purple-600': '#9333ea',
      'text-pink-600': '#db2777',
      'text-indigo-600': '#4f46e5',
    };
    return map[colorClass] || '#cbd5e1';
  };

  // 1. Category Breakdown for Expenses (Fund + Self Eligible)
  const categorySummaryData = categories.map(cat => {
    const total = expenses
      .filter(e => e.category === cat.label && (e.status === 'confirmed' || !e.status))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    return {
      name: cat.label,
      value: total,
      color: getColorHex(cat.color || '')
    };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  // 2. Member Contribution Breakdown
  const memberReportData = members.map(m => ({
    name: m.name,
    deposited: m.totalContribution,
    target: m.target,
    percentage: Math.round((m.totalContribution / (m.target || 1)) * 100)
  })).sort((a, b) => b.deposited - a.deposited);

  // 3. Overall Totals
  const reportSummary = {
    fundBalance,
    totalDeposited,
    totalSpent,
    pendingReimbursements: monthSummary.pendingReimbursements
  };

  const downloadReport = async () => {
    const reportElement = document.getElementById('report-content');
    if (!reportElement) return;

    try {
      const canvas = await html2canvas(reportElement, {
        scale: 2, // Improve quality
        backgroundColor: '#ffffff', // Ensure white background
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `financial_report_${dateStr}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to generate report image:", error);
      alert("Failed to download report image");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <Tabs defaultValue="overview" className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <TabsList className="h-10">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <BarChart className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="archives" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  History
                </TabsTrigger>
                <TabsTrigger value="cooking" className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4" />
                  Cooking
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-10 px-4">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                  {/* ... rest of existing report dialog content stays the same ... */}
                  <DialogHeader>
                    <DialogTitle>Financial Report Summary</DialogTitle>
                    <DialogDescription>
                      Overview of funds, expenses, and member contributions for {currentMonth}.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-6 py-6 px-8 bg-white text-slate-950 font-sans rounded-xl border border-slate-200 shadow-sm" id="report-content">
                    {/* Header for Image */}
                    <div className="flex justify-between items-center border-b border-teal-100 pb-4 mb-2">
                      <div>
                        <h2 className="text-2xl font-black text-teal-600 tracking-tight">Flat Fund Report</h2>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-[0.2em]">{currentMonth}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-medium">Generated Profile</div>
                        <div className="text-xs font-bold text-slate-700">{userProfile?.name}</div>
                      </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-teal-50 border border-teal-100">
                        <div className="text-[10px] text-teal-600 font-bold uppercase tracking-wider mb-1">Balance</div>
                        <div className="text-lg font-black text-teal-800">₹{reportSummary.fundBalance.toLocaleString()}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Deposits</div>
                        <div className="text-lg font-black text-emerald-800">₹{reportSummary.totalDeposited.toLocaleString()}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                        <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mb-1">Spent</div>
                        <div className="text-lg font-black text-rose-800">₹{reportSummary.totalSpent.toLocaleString()}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                        <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-1">Pending</div>
                        <div className="text-lg font-black text-orange-800">₹{reportSummary.pendingReimbursements.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Category Chart */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-white">
                          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Expenses by Category</h3>
                        </div>
                        <div className="h-[250px] p-2 bg-white flex items-center justify-center">
                          {categorySummaryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={categorySummaryData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {categorySummaryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip
                                  formatter={(value: number) => `₹${value.toLocaleString()}`}
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                              No expense data available
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Member Contributions Chart/Table */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-white">
                          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Member Contributions</h3>
                        </div>
                        <div className="p-4 bg-white">
                          <div className="space-y-4">
                            {memberReportData.map((m, idx) => (
                              <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span className="text-slate-700">{m.name}</span>
                                  <span className="text-teal-600">₹{m.deposited.toLocaleString()}</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-teal-500 rounded-full"
                                    style={{ width: `${Math.min(100, m.percentage || 0)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Expenses List */}
                    <div className="mt-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Top Expenses</h3>
                      <div className="grid gap-2">
                        {expenses
                          .filter(e => e.date >= activePeriodStart)
                          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
                          .slice(0, 5)
                          .map((e, idx) => {
                            return (
                              <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-800">{e.note || e.category}</span>
                                  <span className="text-[10px] text-slate-500 font-medium">{e.category} • {e.date}</span>
                                </div>
                                <span className="text-sm font-black text-slate-900 font-mono">₹{e.amount.toLocaleString()}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t">
                    <div className="text-[10px] sm:text-xs text-muted-foreground pt-0 sm:pt-2">
                      Reporting Period: {activePeriodStart} to Present
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button variant="outline" onClick={downloadReport} className="flex-1 sm:flex-none">
                        <Download className="h-4 w-4 mr-2" />
                        Image
                      </Button>
                      <Button variant="outline" onClick={() => setIsReportOpen(false)} className="flex-1 sm:flex-none">Close</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isCloseMonthOpen} onOpenChange={setIsCloseMonthOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-10 px-4 text-red-600 border-red-200 hover:bg-red-50">
                    <Archive className="h-4 w-4 mr-2" />
                    Close Month
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Finalize Current Month</DialogTitle>
                    <DialogDescription>
                      This will archive all current data and start the next month's cycle.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-4 rounded-lg bg-orange-50 p-4 text-xs text-orange-800 border border-orange-100">
                      <p className="font-semibold">⚠️ Warning</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>All current bills, expenses, and deposits will be moved to history.</li>
                        <li>Member contribution targets will reset to ₹0/Target.</li>
                        <li>The fund balance will carry over to the new month.</li>
                      </ul>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="archive-name">Archive Period Name</Label>
                      <Input
                        id="archive-name"
                        placeholder="e.g. January 2026"
                        value={archivePeriodName}
                        onChange={(e) => setArchivePeriodName(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="next-start">New Cycle Start Date</Label>
                      <Input
                        id="next-start"
                        type="date"
                        value={nextPeriodStartDate}
                        onChange={(e) => setNextPeriodStartDate(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Transactions before this date will be hidden from the active dashboard.
                      </p>
                      {nextPeriodStartDate > new Date().toISOString().split('T')[0] && (
                        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
                          ⚠️ <strong>Warning:</strong> This date is in the future ({nextPeriodStartDate}). Setting a future start date will hide ALL current transactions until that date arrives. Are you sure?
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" onClick={() => setIsCloseMonthOpen(false)} disabled={isClosingMonth}>Cancel</Button>
                    <Button variant="destructive" onClick={handleCloseMonth} disabled={isClosingMonth}>
                      <CalendarCheck className="h-4 w-4 mr-2" />
                      {isClosingMonth ? "Archiving..." : "Close & Start Next Month"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Target Dialog */}
              <Dialog open={isEditTargetOpen} onOpenChange={setIsEditTargetOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit Monthly Target</DialogTitle>
                    <DialogDescription>
                      Set a new monthly contribution target for {selectedMember?.name}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="target-amount">Target Amount (₹)</Label>
                      <Input
                        id="target-amount"
                        type="number"
                        value={editTargetValue}
                        onChange={(e) => setEditTargetValue(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditTargetOpen(false)}>Cancel</Button>
                    <Button onClick={saveTarget}>Save Changes</Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* View Member Details Dialog */}
              <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Member Details</DialogTitle>
                    <DialogDescription>
                      Detailed overview for {selectedMember?.name}.
                    </DialogDescription>
                  </DialogHeader>

                  {selectedMember && (
                    <div className="space-y-6">
                      {/* Header Info */}
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={selectedMember.avatar} />
                          <AvatarFallback>{selectedMember.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-xl font-bold">{selectedMember.name}</h3>
                          <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                          <div className="mt-1 flex gap-2">
                            <Badge className={getStatusColor(selectedMember.status)}>
                              {getStatusText(selectedMember.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted/50 text-center">
                          <div className="text-sm text-muted-foreground">Total Contribution</div>
                          <div className="text-2xl font-bold text-primary">₹{selectedMember.totalContribution.toLocaleString()}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50 text-center">
                          <div className="text-sm text-muted-foreground">Monthly Target</div>
                          <div className="text-2xl font-bold">₹{selectedMember.target.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Breakdown</h4>
                        <div className="flex justify-between text-sm p-2 border-b">
                          <span>Deposited Cash</span>
                          <span className="font-mono">₹{selectedMember.deposited.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm p-2 border-b">
                          <span>Self Spent (Eligible)</span>
                          <span className="font-mono">₹{selectedMember.selfSpent.toLocaleString()}</span>
                        </div>
                        {selectedMember.extra > 0 && (
                          <div className="flex justify-between text-sm p-2 text-blue-600 font-medium">
                            <span>Extra Contribution</span>
                            <span>+ ₹{selectedMember.extra.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm p-2 pt-4 font-bold bg-muted/20 rounded">
                          <span>Total</span>
                          <span>₹{selectedMember.totalContribution.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setIsViewDetailsOpen(false)}>Close</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* Summary Cards */}
            <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
              <Card className="glass-card glass-card-hover border-primary/20">
                <CardHeader className="p-4 sm:p-6 pb-1 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium">Fund Balance</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-base sm:text-2xl font-bold text-primary flex items-center truncate">
                    <IndianRupee className="h-3.5 w-3.5 sm:h-5 sm:w-5 shrink-0" />
                    {fundBalance.toLocaleString("en-IN")}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card glass-card-hover border-green-500/20">
                <CardHeader className="p-4 sm:p-6 pb-1 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total Deposits</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-base sm:text-2xl font-bold text-green-600 flex items-center truncate">
                    <IndianRupee className="h-3.5 w-3.5 sm:h-5 sm:w-5 shrink-0" />
                    {monthSummary.totalDeposits.toLocaleString("en-IN")}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card glass-card-hover border-orange-500/20">
                <CardHeader className="p-4 sm:p-6 pb-1 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium">Pending Claim</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-base sm:text-2xl font-bold text-orange-600 flex items-center truncate">
                    <IndianRupee className="h-3.5 w-3.5 sm:h-5 sm:w-5 shrink-0" />
                    {monthSummary.pendingReimbursements.toLocaleString("en-IN")}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                    {monthSummary.pendingReimbursements > 0 ? `${pendingReimbursements.length} reqs` : 'No reqs'}
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card glass-card-hover">
                <CardHeader className="p-4 sm:p-6 pb-1 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium">Active Members</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-base sm:text-2xl font-bold truncate">
                    {members.length}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                    This month
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Members Overview & Reimbursement Requests */}
            <div className="grid gap-6 xl:grid-cols-2">
              {/* Members Overview */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Members Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {members.map((member) => {
                      const deposited = Number(member.deposited || 0);
                      const selfSpent = Number(member.selfSpent || 0);
                      const target = Number(member.target || 0);
                      // totalContribution includes self-spent amounts that were treated as deposits
                      const progress = (!target || target <= 0) ? 0 : Math.round((Math.min(member.totalContribution, target) / target) * 100);
                      const extra = Number(member.extra || 0);
                      return (
                        <div key={`member-${member.id}`} className="space-y-3 p-3 sm:p-4 rounded-lg glass-card border-white/5 relative">
                          <div className="flex items-center justify-between gap-2 overflow-hidden">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                                <AvatarImage src={
                                  (member.avatar && (member.avatar.startsWith('data:') || member.avatar.startsWith('/') || member.avatar.startsWith('http')))
                                    ? member.avatar
                                    : getDefaultAvatar(member.name)
                                } />
                                <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium text-sm sm:text-base truncate">{member.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge className={cn("text-[9px] sm:text-[10px] px-1 sm:px-1.5 h-4 sm:h-5", getStatusColor(member.status))}>
                                {getStatusText(member.status)}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                                    <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewDetailsClick(member)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditTargetClick(member)}>
                                    Edit Target
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[11px] sm:text-xs">
                              <span className="truncate">Progress: ₹{(member.totalContribution).toLocaleString("en-IN")}</span>
                              <span className="shrink-0 ml-2">Target: ₹{(target || 0).toLocaleString("en-IN")}</span>
                            </div>
                            <Progress value={progress} className="h-1.5" />
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span className="truncate">Dep: ₹{(deposited || 0).toLocaleString("en-IN")}</span>
                              <span className="truncate">Self: ₹{(selfSpent || 0).toLocaleString("en-IN")}</span>
                            </div>
                            {extra > 0 && (
                              <div className="text-[11px] font-medium text-blue-600">Extra: ₹{extra.toLocaleString("en-IN")}</div>
                            )}
                            {member.reimbursementRequests > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-orange-600">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                <span className="truncate">{member.reimbursementRequests} reimbursement request(s)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Reimbursements */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pending Reimbursements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingReimbursements.map((request) => (
                      <div key={request.expenseId} className="p-3 sm:p-4 rounded-lg glass-card border-white/5 space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 overflow-hidden">
                          <div className="min-w-0 w-full">
                            <div className="font-medium text-sm sm:text-base truncate">{request.userName}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">{request.description}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {request.date} • {request.category}
                            </div>
                          </div>
                          <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-1 sm:mt-0">
                            <div className="font-bold text-orange-600 text-sm sm:text-base">₹{request.amount}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => approveReimbursement(request)}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="archives" className="space-y-6 mt-0">
            <div>
              <h2 className="text-2xl font-bold">Monthly History</h2>
              <p className="text-sm text-muted-foreground">Historical records of previous billing cycles</p>
            </div>

            <div className="grid gap-4">
              {archivesLoading ? (
                <div className="py-20 text-center text-muted-foreground">Loading archives...</div>
              ) : archives.length === 0 ? (
                <Card>
                  <CardContent className="py-20 text-center text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No archived months found.</p>
                    <p className="text-sm">Historical data will appear here after you "Close Month".</p>
                  </CardContent>
                </Card>
              ) : (
                archives.map((archive) => (
                  <Card key={archive.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center">
                        <div className="p-6 bg-primary/5 flex flex-col justify-center border-b sm:border-b-0 sm:border-r min-w-[200px]">
                          <div className="text-sm font-medium text-primary uppercase tracking-wider">Period</div>
                          <div className="text-xl font-bold">{archive.period}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Archived: {archive.archivedAt?.toDate
                              ? format(archive.archivedAt.toDate(), 'PPP')
                              : 'Just now'}
                          </div>
                        </div>
                        <div className="flex-1 p-6 grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Bills</div>
                            <div className="text-lg font-bold">{archive.summary.totalBills}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Expenses</div>
                            <div className="text-lg font-bold">{archive.summary.totalExpenses}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Deposits</div>
                            <div className="text-lg font-bold">{archive.summary.totalDeposits}</div>
                          </div>
                        </div>
                        <div className="p-6 flex items-center justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedArchive(archive);
                              setIsArchiveDetailsOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Summary
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* ── COOKING SCHEDULE TAB ── */}
          <TabsContent value="cooking" className="space-y-6 mt-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <UtensilsCrossed className="h-6 w-6 text-orange-500" />
                  Cooking Schedule
                </h2>
                <p className="text-sm text-muted-foreground">Upload monthly CSV &amp; mark attendance per slot</p>
              </div>

              {/* CSV Upload */}
              <div className="flex items-center gap-3">
                <label
                  htmlFor="cooking-csv-upload"
                  className="flex items-center gap-2 cursor-pointer h-9 px-4 rounded-md border border-input bg-background text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {csvUploading ? 'Uploading...' : 'Upload CSV'}
                </label>
                <input
                  id="cooking-csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={csvUploading}
                  onChange={handleCsvUpload}
                />
              </div>
            </div>

            {csvError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <strong>Error:</strong> {csvError}
              </div>
            )}

            {/* CSV Format Guide */}
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground font-mono">
                  📋 CSV format: <strong>date, day, morning_team, night_team</strong>
                  &nbsp;&nbsp;—&nbsp;&nbsp;Example row: <span className="text-primary">2026-04-01,Wednesday,Team B,Team C</span>
                </p>
              </CardContent>
            </Card>

            {/* Team Streaks */}
            {uniqueTeams.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Flame className="h-5 w-5 text-orange-500" />
                    Team Streaks (Current Month)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {uniqueTeams.map(team => {
                      const streak = getTeamStreak(team);
                      return (
                        <div
                          key={team}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full border font-semibold text-sm ${
                            streak >= 7
                              ? 'bg-orange-100 border-orange-300 text-orange-800'
                              : streak >= 3
                              ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                              : 'bg-muted border-muted-foreground/20 text-muted-foreground'
                          }`}
                        >
                          <Flame className={`h-4 w-4 ${streak > 0 ? 'text-orange-500' : 'text-muted-foreground/40'}`} />
                          {team}
                          <span className="ml-1 font-bold">{streak}🔥</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Month selector and schedule table */}
            {cookingSchedules.length === 0 && !cookingLoading ? (
              <Card>
                <CardContent className="py-20 text-center text-muted-foreground">
                  <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No cooking schedules uploaded yet.</p>
                  <p className="text-sm">Upload a CSV file to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Month pills */}
                <div className="flex flex-wrap gap-2">
                  {cookingSchedules.map(s => (
                    <Button
                      key={s.month}
                      size="sm"
                      variant={s.month === cookingViewMonth ? 'default' : 'outline'}
                      onClick={() => setCookingViewMonth(s.month)}
                    >
                      {format(new Date(s.month + '-01'), 'MMM yyyy')}
                    </Button>
                  ))}
                </div>

                {viewedSchedule ? (
                  <Card className="glass-card overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-base">
                        {format(new Date(viewedSchedule.month + '-01'), 'MMMM yyyy')} Schedule
                        <span className="ml-2 text-sm font-normal text-muted-foreground">({viewedSchedule.days.length} days)</span>
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Delete schedule for ${viewedSchedule.month}?`)) {
                            deleteCookingSchedule(viewedSchedule.month);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                              <th className="px-4 py-2 text-left">Date</th>
                              <th className="px-4 py-2 text-left">Day</th>
                              <th className="px-4 py-2 text-left">
                                <span className="flex items-center gap-1"><Sun className="h-3.5 w-3.5 text-yellow-500" /> Morning</span>
                              </th>
                              <th className="px-4 py-2 text-center">Done?</th>
                              <th className="px-4 py-2 text-left">
                                <span className="flex items-center gap-1"><Moon className="h-3.5 w-3.5 text-indigo-500" /> Night</span>
                              </th>
                              <th className="px-4 py-2 text-center">Done?</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {viewedSchedule.days.map(day => {
                              const isToday = day.date === new Date().toISOString().split('T')[0];
                              return (
                                <tr
                                  key={day.date}
                                  className={`transition-colors ${
                                    isToday ? 'bg-primary/5 font-semibold ring-1 ring-primary/30' : 'hover:bg-muted/30'
                                  }`}
                                >
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    {day.date}
                                    {isToday && <Badge className="ml-2 text-[9px] h-4 bg-primary/80">Today</Badge>}
                                  </td>
                                  <td className="px-4 py-2.5 text-muted-foreground">{day.dayName}</td>
                                  <td className="px-4 py-2.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      ☀️ {day.morningTeam}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <Checkbox
                                      id={`m-${day.date}`}
                                      checked={!!day.morningDone}
                                      onCheckedChange={val =>
                                        handleToggleAttendance(viewedSchedule.month, day.date, 'morningDone', !!val)
                                      }
                                    />
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                      🌙 {day.nightTeam}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <Checkbox
                                      id={`n-${day.date}`}
                                      checked={!!day.nightDone}
                                      onCheckedChange={val =>
                                        handleToggleAttendance(viewedSchedule.month, day.date, 'nightDone', !!val)
                                      }
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                      No schedule for this month.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Archive Details Dialog */}
        <Dialog open={isArchiveDetailsOpen} onOpenChange={setIsArchiveDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Period Archive: {selectedArchive?.period}</DialogTitle>
              <DialogDescription>
                Summary of activity during this cycle.
              </DialogDescription>
            </DialogHeader>
            {selectedArchive && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-muted/50 border-none shadow-none">
                    <CardContent className="p-4 text-center">
                      <div className="text-xs text-muted-foreground uppercase">Bills</div>
                      <div className="text-xl font-bold">{selectedArchive.data.bills.length}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50 border-none shadow-none">
                    <CardContent className="p-4 text-center">
                      <div className="text-xs text-muted-foreground uppercase">Expenses</div>
                      <div className="text-xl font-bold">{selectedArchive.data.expenses.length}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50 border-none shadow-none">
                    <CardContent className="p-4 text-center">
                      <div className="text-xs text-muted-foreground uppercase">Deposits</div>
                      <div className="text-xl font-bold">{selectedArchive.data.deposits.length}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <div className="font-semibold px-1">Archived Bills & Fees</div>
                  <div className="grid gap-2">
                    {selectedArchive.data.bills.length > 0 ? (
                      selectedArchive.data.bills.map((bill: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-muted">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{bill.type || "Other Bill"}</div>
                              <div className="text-[10px] text-muted-foreground">{bill.dueDate}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm">₹{bill.amount?.toLocaleString()}</div>
                            <Badge variant="outline" className="text-[9px] h-4">
                              {bill.status === 'paid' ? 'Paid' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg border-dashed">
                        No bill records in this archive.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-orange-50/30 border-orange-100">
                  <div className="p-3 bg-orange-100/50 font-medium text-sm text-orange-900 border-b border-orange-100">Archive Information</div>
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-orange-800">
                      This is a read-only snapshot of the <strong>{selectedArchive.period}</strong> billing cycle.
                      All member contribution targets were reset after this data was moved to history.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button onClick={() => setIsArchiveDetailsOpen(false)}>Close Archive</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
