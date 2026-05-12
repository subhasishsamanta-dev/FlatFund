import Layout from "@/components/Layout";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  TrendingUp,
  Search,
  Filter,
  IndianRupee,
  Download,
  Eye
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAppState } from "@/state/AppState";
import { useTransactions, Deposit } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreUsers } from "@/hooks/useFirestoreUsers";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


import { getDefaultAvatar } from "@/lib/avatar";
import { sendNotification } from "@/lib/notifications";


export default function Deposits() {
  const { deposits, expenses, loading: transactionsLoading, addDeposit: addDepositToFirestore } = useTransactions();
  const { users: firestoreUsers } = useFirestoreUsers();
  const { userProfile } = useAuth();

  // Map firestore users to Member format for the dropdown
  const members = firestoreUsers.map(u => ({
    id: u.uid,
    name: u.name,
    avatar: u.avatar,
    target: u.monthlyTarget
  }));

  // Helper: resolve the correct avatar for a transaction by looking up the member's current avatar
  const resolveAvatar = (uid: string, userName: string) => {
    const member = firestoreUsers.find(u => u.uid === uid);
    const avatar = member?.avatar;
    if (avatar && (avatar.startsWith('data:') || avatar.startsWith('/') || avatar.startsWith('http'))) {
      return avatar;
    }
    return getDefaultAvatar(userName || 'User');
  };

  // Helper for robust date comparison
  const getTimestamp = (dateStr: string) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const { settings } = useAppState();
  const activePeriodStart = settings?.general?.activePeriodStart || '1970-01-01';
  const activePeriodTimestamp = getTimestamp(activePeriodStart);

  // Contribution: include self-spent that hasn't been reimbursed yet
  const selfDepositsAllTime = expenses.filter(e => e.type === 'self' && (e.status === 'confirmed' || e.status === 'reimbursement_requested' || e.status === 'reimbursement_eligible' || !e.status)).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Rule: totalDeposits (Cash only)
  const totalDeposits = deposits.filter(d => d.status === 'confirmed' || !d.status).reduce((s, d) => s + (Number(d.amount) || 0), 0);

  // Group contribution (Cash + Self Spent)
  const groupContributionAllTime = totalDeposits + selfDepositsAllTime;

  const now = new Date();

  const cashThisMonth = deposits.filter(d => {
    return getTimestamp(d.date) >= activePeriodTimestamp && (d.status === 'confirmed' || !d.status);
  }).reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const selfThisMonth = expenses.filter(e => {
    // Contribution: include self-spent that hasn't been reimbursed yet
    return e.type === 'self' && getTimestamp(e.date) >= activePeriodTimestamp && (e.status === 'confirmed' || e.status === 'reimbursement_requested' || e.status === 'reimbursement_eligible' || !e.status);
  }).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const thisMonth = cashThisMonth + selfThisMonth;

  const totalTargets = members.reduce((s, m) => s + (Number(m.target) || 0), 0);
  // Member contribution for progress includes their cash + self spent
  const targetProgress = totalTargets ? Math.round(((totalDeposits + selfDepositsAllTime) / totalTargets) * 100) : 0;
  const avgDeposit = members.length ? Math.round((totalDeposits + selfDepositsAllTime) / members.length) : 0;
  const summary = { totalDeposits, thisMonth, targetProgress, avgDeposit };

  const [date, setDate] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add deposit form state
  const [amountInput, setAmountInput] = useState("");
  const [referenceInput, setReferenceInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(userProfile?.uid || null);

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default date to today when dialog opens
  useEffect(() => {
    if (isAddDialogOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setSelectedMemberId(userProfile?.uid || null);
    }
  }, [isAddDialogOpen, userProfile]);

  const handleAddDeposit = async () => {
    if (!amountInput || parseInt(amountInput) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (!date) {
      toast({
        title: "Date Required",
        description: "Please select a date for the deposit.",
        variant: "destructive",
      });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (date && date > today) {
      toast({
        title: "Invalid Date",
        description: "Future dates are not allowed for deposits.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedMember = firestoreUsers.find(u => u.uid === selectedMemberId);

      const depositData = {
        amount: parseInt(amountInput || '0') || 0,
        date: date ? date : today,
        reference: referenceInput || '',
        note: noteInput || '',
        status: 'confirmed' as const,
        uid: selectedMemberId || userProfile?.uid,
        userName: selectedMember?.name || userProfile?.name,
        userAvatar: selectedMember?.avatar || ''
      };

      await addDepositToFirestore(depositData as any);

      // Notify all users via Firestore (in-app bell)
      await sendNotification(
        'all',
        'New Deposit',
        `New deposit of ₹${depositData.amount} from ${depositData.userName}.`,
        'success'
      );

      // Trigger FCM push notification to all devices (fire-and-forget)
      fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: depositData.uid,
          userName: depositData.userName,
          amount: depositData.amount
        })
      }).catch(() => { });

      toast({
        title: "Deposit Added",
        description: `Successfully recorded deposit of ₹${depositData.amount} for ${depositData.userName}.`,
      });

      // reset form
      setAmountInput("");
      setReferenceInput("");
      setNoteInput("");
      setDate('');
      setIsAddDialogOpen(false);
    } catch (error: any) {
      console.error("Error adding deposit:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add deposit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = (type: 'pdf' | 'excel') => {
    const columns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Member', dataKey: 'userName' },
      { header: 'Note', dataKey: 'note' },
      { header: 'Reference', dataKey: 'reference' },
      { header: 'Status', dataKey: 'status' },
      { header: 'Amount (INR)', dataKey: 'amount' },
    ];

    const exportParams = {
      title: 'Deposits Report',
      filename: `deposits_report_${new Date().toISOString().split('T')[0]}`,
      columns,
      data: filteredDeposits
    };

    if (type === 'pdf') {
      exportToPDF(exportParams);
    } else {
      exportToExcel(exportParams);
    }

    toast({
      title: "Report Exported",
      description: `Successfully generated ${type.toUpperCase()} report.`,
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const itemsPerPage = 20;

  const filteredDeposits = deposits
    .filter(deposit => {
      const matchesSearch = (deposit.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (deposit.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (deposit.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || deposit.status === statusFilter;

      const depositDate = deposit.date;
      const validFrom = !fromDate || depositDate >= fromDate;
      const validTo = !toDate || depositDate <= toDate;

      return matchesSearch && matchesStatus && validFrom && validTo;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const paginatedDeposits = filteredDeposits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredDeposits.length / itemsPerPage);

  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const openDepositDetail = (deposit: Deposit) => {
    setSelectedDeposit(deposit);
    setIsDetailOpen(true);
  };

  const closeDepositDetail = () => {
    setSelectedDeposit(null);
    setIsDetailOpen(false);
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Deposits</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Track and manage fund contributions</p>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-1 sm:flex-none h-10 px-4">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none h-10 px-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Deposit
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Deposit</DialogTitle>
                  <DialogDescription>
                    Record a new deposit to the fund.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="amount" placeholder="1500" className="pl-9" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="deposit-date">Date *</Label>
                    <Input
                      id="deposit-date"
                      type="date"
                      value={date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="member">Member</Label>
                    <Select
                      value={selectedMemberId || ''}
                      onValueChange={(val) => setSelectedMemberId(val)}
                      disabled={userProfile?.role !== 'admin'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {userProfile?.role !== 'admin' && (
                      <p className="text-xs text-muted-foreground">Only admins can change the member.</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="reference">Reference Number</Label>
                    <Input id="reference" placeholder="UPI/NEFT reference" value={referenceInput} onChange={(e) => setReferenceInput(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="note">Note (Optional)</Label>
                    <Textarea id="note" placeholder="Additional details..." value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddDeposit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Deposit
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
              <CardTitle className="text-[10px] sm:text-sm font-medium">Total Deposits</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-sm sm:text-2xl font-bold text-green-600 flex items-center truncate">
                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                {summary.totalDeposits.toLocaleString("en-IN")}
              </div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
              <CardTitle className="text-[10px] sm:text-sm font-medium">This Month</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-sm sm:text-2xl font-bold text-primary flex items-center truncate">
                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                {summary.thisMonth.toLocaleString("en-IN")}
              </div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">January 2024</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
              <CardTitle className="text-[10px] sm:text-sm font-medium">Target Progress</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-sm sm:text-2xl font-bold">{summary.targetProgress}%</div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">Group target achieved</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
              <CardTitle className="text-[10px] sm:text-sm font-medium">Average Deposit</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-sm sm:text-2xl font-bold flex items-center truncate">
                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                {summary.avgDeposit.toLocaleString("en-IN")}
              </div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">Per member</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Deposit History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search deposits..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Deposits Table */}
            <div className="space-y-3">
              {paginatedDeposits.map((deposit) => (
                <div key={deposit.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0 aspect-square">
                      <AvatarImage src={resolveAvatar(deposit.uid, deposit.userName || 'User')} />
                      <AvatarFallback>{deposit.userName ? deposit.userName.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{deposit.userName}</div>
                      <div className="text-sm text-muted-foreground truncate">{deposit.note}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {deposit.date} • Ref: {deposit.reference}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center justify-between w-full sm:w-auto gap-3">
                    <div className="text-left sm:text-right">
                      <div className="text-lg font-bold text-green-600 flex items-center">
                        <IndianRupee className="h-4 w-4 shrink-0" />
                        {deposit.amount.toLocaleString("en-IN")}
                      </div>
                      <Badge variant={deposit.status === 'confirmed' ? 'default' : 'secondary'} className="text-[10px]">
                        {deposit.status}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openDepositDetail(deposit)} className="h-8 w-8">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {filteredDeposits.length === 0 && (
              <EmptyState
                icon={TrendingUp}
                title="No Deposits Found"
                description="Keep track of all money added to the fund in one place."
                actionLabel="Record Deposit"
                onAction={() => setIsAddDialogOpen(true)}
              />
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}

            {/* Deposit Details Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Deposit Details</DialogTitle>
                  <DialogDescription>View full details of the deposit.</DialogDescription>
                </DialogHeader>
                {selectedDeposit ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={resolveAvatar(selectedDeposit.uid, selectedDeposit.userName || 'User')} />
                        <AvatarFallback>{selectedDeposit.userName ? selectedDeposit.userName.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{selectedDeposit.userName}</div>
                        <div className="text-sm text-muted-foreground">Ref: {selectedDeposit.reference}</div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <div className="text-sm text-muted-foreground">Amount</div>
                      <div className="text-xl font-bold">₹{selectedDeposit.amount.toLocaleString("en-IN")}</div>
                    </div>
                    <div className="grid gap-2">
                      <div className="text-sm text-muted-foreground">Date</div>
                      <div>{selectedDeposit.date}</div>
                    </div>
                    <div className="grid gap-2">
                      <div className="text-sm text-muted-foreground">Note</div>
                      <div>{selectedDeposit.note}</div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={closeDepositDetail}>Close</Button>
                    </div>
                  </div>
                ) : (
                  <div>Loading...</div>
                )}
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
