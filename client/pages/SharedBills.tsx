import Layout from "@/components/Layout";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useNotifications,
  requestNotificationPermission,
  showBrowserNotification,
  sendNotification
} from "@/lib/notifications";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Calendar as CalendarIcon,
  IndianRupee,
  Download,
  Eye,
  Home,
  Zap,
  Wifi,
  Droplets,
  Car,
  Shield,
  CheckCircle,
  Clock,
  AlertCircle,
  Upload,
  Edit2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useFirestoreUsers } from "@/hooks/useFirestoreUsers";
import { useBills, Bill as FirestoreBill } from "@/hooks/useBills";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { haptics } from "@/lib/haptics";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const billTypes = [
  { value: "rent", label: "Rent", icon: Home },
  { value: "electricity", label: "Electricity", icon: Zap },
  { value: "internet", label: "Internet", icon: Wifi },
  { value: "water", label: "Water", icon: Droplets },
  { value: "parking", label: "Parking", icon: Car },
  { value: "security", label: "Security", icon: Shield },
];

import { getDefaultAvatar } from "@/lib/avatar";

import { useAppState } from "@/state/AppState";

export default function SharedBills() {
  const { users: members, loading: usersLoading } = useFirestoreUsers();
  const { bills: allBills, addBill: addBillToFirestore, updateBill: updateBillInFirestore, loading: billsLoading } = useBills();
  const { userProfile } = useAuth();
  const { settings, updateSettings } = useAppState();
  const { toast } = useToast();
  const isAdmin = userProfile?.role === 'admin';

  const activePeriodStart = settings?.general?.activePeriodStart || '1970-01-01';
  const bills = allBills.filter(b => (b.dueDate || '') >= activePeriodStart);

  // Calculate summary based on individual member payments
  const totalBillsAmount = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0);

  // paidAmount sums up the share of each member who has already paid
  const paidAmount = bills.reduce((total, bill) => {
    const paidCount = Object.values(bill.memberPayments || {}).filter(status => status === 'paid').length;
    return total + (paidCount * (Number(bill.perMemberShare) || 0));
  }, 0);

  const pendingAmount = totalBillsAmount - paidAmount;
  const perMemberDue = members.length ? Math.round(totalBillsAmount / members.length) : 0;
  const summary = { totalBills: totalBillsAmount, paidBills: paidAmount, pendingBills: pendingAmount, perMemberDue };
  const [date, setDate] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isDueDateDialogOpen, setIsDueDateDialogOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState(settings?.general?.nextBillDueDate || "");

  // Add bill form state
  const [billTypeValue, setBillTypeValue] = useState(billTypes[0].value);
  const [totalAmountInput, setTotalAmountInput] = useState("");
  const [invoiceInput, setInvoiceInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [splitMethod, setSplitMethod] = useState("equal");
  const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>([]);

  // Electricity bill specific state
  const [prevUnit, setPrevUnit] = useState("");
  const [currUnit, setCurrUnit] = useState("");

  // Auto-calculate electricity bill amount
  useEffect(() => {
    if (billTypeValue === 'electricity') {
      const prev = parseFloat(prevUnit) || 0;
      const curr = parseFloat(currUnit) || 0;
      if (curr > prev) {
        const diff = curr - prev;
        const amount = diff * 10;
        setTotalAmountInput(amount.toString());
      }
    }
  }, [prevUnit, currUnit, billTypeValue]);

  // Initialize selectedMemberUids when members load or dialog opens
  useEffect(() => {
    if (members.length > 0 && selectedMemberUids.length === 0) {
      setSelectedMemberUids(members.map(m => m.uid));
    }
  }, [members]);

  // Bill detail dialog
  const [selectedBill, setSelectedBill] = useState<FirestoreBill | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const openBillDetail = (bill: FirestoreBill) => { setSelectedBill(bill); setIsDetailOpen(true); };
  const closeBillDetail = () => { setSelectedBill(null); setIsDetailOpen(false); };

  const handleAddBill = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (date && date < today) {
      haptics.error();
      alert('Due dates cannot be in the past');
      return;
    }

    const amount = parseInt(totalAmountInput || '0') || 0;

    let targetMembers = members;
    if (splitMethod === 'custom') {
      targetMembers = members.filter(m => selectedMemberUids.includes(m.uid));
    }

    if (targetMembers.length === 0) {
      haptics.error();
      alert("Please select at least one member for the bill split.");
      return;
    }

    const count = targetMembers.length;
    const perMemberShare = Math.round(amount / count);
    const memberPayments: Record<string, 'pending' | 'paid'> = {};

    targetMembers.forEach(m => {
      memberPayments[m.uid] = 'pending';
    });

    const billData: any = {
      type: billTypes.find(b => b.value === billTypeValue)?.label || billTypeValue,
      amount,
      dueDate: date ? date : today,
      billingMonth: selectedMonth,
      perMemberShare,
      paidBy: 'individual',
      status: 'pending',
      memberPayments,
    };

    if (invoiceInput.trim()) {
      billData.invoiceNumber = invoiceInput.trim();
    }

    // Add notes to the data if provided
    if (notesInput.trim()) {
      billData.notes = notesInput.trim();
    }

    // Add electricity specific data to notes or a custom field if needed
    if (billTypeValue === 'electricity') {
      const unitInfo = ` (Units: ${prevUnit} - ${currUnit})`;
      billData.notes = (billData.notes || '') + unitInfo;
    }

    try {
      await addBillToFirestore(billData);

      // Notify all users via Firestore (in-app bell)
      await sendNotification(
        'all',
        'New Shared Bill',
        `A new ${billData.type} bill of ₹${amount} (₹${perMemberShare} each) has been added.`,
        'info'
      );

      // Trigger FCM push notification to all devices (fire-and-forget)
      fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile?.uid,
          userName: userProfile?.name,
          billTitle: billData.type,
          amount,
          perMemberShare
        })
      }).catch(() => { });

      // reset forms on success
      setBillTypeValue(billTypes[0].value);
      setTotalAmountInput("");
      setInvoiceInput("");
      setNotesInput("");
      setSplitMethod('equal');
      setSelectedMemberUids(members.map(m => m.uid));
      setDate('');
      setPrevUnit("");
      setCurrUnit("");
      setIsAddDialogOpen(false);
    } catch (err: any) {
      console.error("Failed to add bill:", err);
      haptics.error();
      alert(`Failed to add bill: ${err.message || 'Unknown error'}. Please ensure you have admin permissions.`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-700">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>;
      case 'pending':
        return <Badge className="bg-red-100 text-red-700">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getPaymentIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getPaymentProgress = (memberPayments: Record<string, string>) => {
    const totalMembers = Object.keys(memberPayments).length;
    if (totalMembers === 0) return 0;
    const paidMembers = Object.values(memberPayments).filter(status => status === 'paid').length;
    return Math.round((paidMembers / totalMembers) * 100);
  };

  const handleExport = (type: 'pdf' | 'excel') => {
    const columns = [
      { header: 'Due Date', dataKey: 'dueDate' },
      { header: 'Type', dataKey: 'type' },
      { header: 'Month', dataKey: 'billingMonth' },
      { header: 'Total Amount', dataKey: 'amount' },
      { header: 'Per Member', dataKey: 'perMemberShare' },
      { header: 'Status', dataKey: 'status' },
    ];

    const exportParams = {
      title: 'Shared Bills Report',
      filename: `bills_report_${new Date().toISOString().split('T')[0]}`,
      columns,
      data: bills
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

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Shared Bills</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Monthly shared living expenses</p>
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
            {isAdmin && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1 sm:flex-none h-10 px-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Bill
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Shared Bill</DialogTitle>
                    <DialogDescription>
                      Add a new shared bill to be split among members.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Bill Type</Label>
                      <Select value={billTypeValue} onValueChange={setBillTypeValue}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {billTypes.map((type) => {
                            const Icon = type.icon;
                            return (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {type.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {billTypeValue === 'electricity' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="prev-unit">Previous Month Unit</Label>
                          <Input
                            id="prev-unit"
                            type="number"
                            placeholder="100"
                            value={prevUnit}
                            onChange={(e) => setPrevUnit(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="curr-unit">This Month Unit</Label>
                          <Input
                            id="curr-unit"
                            type="number"
                            placeholder="150"
                            value={currUnit}
                            onChange={(e) => setCurrUnit(e.target.value)}
                          />
                        </div>
                        <div className="col-span-2 text-xs text-muted-foreground">
                          Rate: (Current - Previous) x ₹10
                        </div>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="total-amount">Total Amount</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="total-amount" placeholder="24000" className="pl-9" value={totalAmountInput} onChange={(e) => setTotalAmountInput(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="bill-due-date">Due Date</Label>
                      <Input id="bill-due-date" type="date" value={date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setDate(e.target.value)} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="invoice">Invoice Number</Label>
                      <Input id="invoice" placeholder="RENT-JAN-2024" value={invoiceInput} onChange={(e) => setInvoiceInput(e.target.value)} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea id="notes" placeholder="Additional details..." value={notesInput} onChange={(e) => setNotesInput(e.target.value)} />
                    </div>

                    <div className="grid gap-2">
                      <Label>Split Method</Label>
                      <Select value={splitMethod} onValueChange={(val) => {
                        setSplitMethod(val);
                        if (val === 'equal') setSelectedMemberUids(members.map(m => m.uid));
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equal">Equal Split (All members)</SelectItem>
                          <SelectItem value="custom">Specific Members (Selection)</SelectItem>
                        </SelectContent>
                      </Select>
                      {splitMethod === 'custom' && (
                        <div className="mt-3 space-y-2">
                          <Label>Select participating members:</Label>
                          <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                            {members.map(m => (
                              <div key={m.uid} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded transition-colors">
                                <input
                                  type="checkbox"
                                  id={`member-${m.uid}`}
                                  checked={selectedMemberUids.includes(m.uid)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMemberUids(prev => [...prev, m.uid]);
                                    } else {
                                      setSelectedMemberUids(prev => prev.filter(id => id !== m.uid));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor={`member-${m.uid}`} className="flex items-center gap-2 cursor-pointer flex-1">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={
                                      (m.avatar && (m.avatar.startsWith('data:') || m.avatar.startsWith('/') || m.avatar.startsWith('http')))
                                        ? m.avatar
                                        : getDefaultAvatar(m.name)
                                    } />
                                    <AvatarFallback className="text-[10px]">{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{m.name}</span>
                                </Label>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedMemberUids.length} members selected • ₹{totalAmountInput ? Math.round(parseInt(totalAmountInput) / (selectedMemberUids.length || 1)).toLocaleString('en-IN') : 0} each
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddBill}>
                      Add Bill
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Summary Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
              <CardTitle className="text-[10px] sm:text-sm font-medium">Total Fund Due</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-sm sm:text-2xl font-bold flex items-center text-primary truncate">
                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                {summary.totalBills.toLocaleString("en-IN")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
              <CardTitle className="text-[10px] sm:text-sm font-medium">Already Paid</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-sm sm:text-2xl font-bold text-green-600 flex items-center truncate">
                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                {summary.paidBills.toLocaleString("en-IN")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
              <CardTitle className="text-[10px] sm:text-sm font-medium">Remaining</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-sm sm:text-2xl font-bold text-orange-600 flex items-center truncate">
                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                {summary.pendingBills.toLocaleString("en-IN")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
              <CardTitle className="text-[10px] sm:text-sm font-medium flex items-center justify-between">
                Next Due
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                    setNewDueDate(settings?.general?.nextBillDueDate || "");
                    setIsDueDateDialogOpen(true);
                  }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-sm sm:text-lg font-medium truncate">
                {settings?.general?.nextBillDueDate && settings.general.nextBillDueDate !== ""
                  ? new Date(settings.general.nextBillDueDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })
                  : 'Not Set'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Due Date Edit Dialog */}
        <Dialog open={isDueDateDialogOpen} onOpenChange={setIsDueDateDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Set Next Bill Due Date</DialogTitle>
              <DialogDescription>
                This date will be visible to all members.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="next-due-date">Due Date</Label>
                <Input
                  id="next-due-date"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDueDateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={async () => {
                await updateSettings({
                  general: {
                    ...settings.general,
                    nextBillDueDate: newDueDate
                  }
                });
                setIsDueDateDialogOpen(false);
              }}>
                Save Change
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bills Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Bills List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Bills Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bills.length === 0 ? (
                    <EmptyState
                      icon={AlertCircle}
                      title="All Caught Up"
                      description="No shared bills are pending for this period."
                      actionLabel={isAdmin ? "Add New Bill" : undefined}
                      onAction={isAdmin ? () => setIsAddDialogOpen(true) : undefined}
                    />
                  ) : bills.map((bill) => {
                    const BillIcon = billTypes.find(t => t.label === bill.type)?.icon || AlertCircle;
                    const progress = getPaymentProgress(bill.memberPayments);

                    return (
                      <div key={bill.id} className="p-4 rounded-lg border space-y-4">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="p-2 rounded-full bg-muted shrink-0">
                              <BillIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{bill.type}</div>
                              <div className="text-xs sm:text-sm text-muted-foreground break-all">
                                {bill.dueDate} • {bill.invoiceNumber || 'No Invoice'}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1">
                            <div className="text-lg font-bold flex items-center">
                              <IndianRupee className="h-4 w-4 shrink-0" />
                              {bill.amount.toLocaleString("en-IN")}
                            </div>
                            {getStatusBadge(bill.status)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Payment Progress</span>
                            <span>{progress}% complete</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                          <div className="text-sm text-muted-foreground">
                            ₹{bill.perMemberShare.toLocaleString("en-IN")} per member
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="flex flex-wrap -space-x-2">
                            {members.filter(m => bill.memberPayments[m.uid]).map((member) => (
                              <Avatar key={member.uid} className="h-6 w-6 border-2 border-background" title={`${member.name}: ${bill.memberPayments[member.uid]}`}>
                                <AvatarImage src={
                                  (member.avatar && (member.avatar.startsWith('data:') || member.avatar.startsWith('/') || member.avatar.startsWith('http')))
                                    ? member.avatar
                                    : getDefaultAvatar(member.name)
                                } />
                                <AvatarFallback className="text-[10px]">{member.name ? member.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="outline" size="sm" onClick={() => openBillDetail(bill)} className="flex-1 sm:flex-none h-8 text-xs">
                              <Eye className="h-3 w-3 mr-1" />
                              Details
                            </Button>
                            {bill.status !== 'paid' && isAdmin && (
                              <Button size="sm" onClick={() => {
                                const newPayments = { ...bill.memberPayments };
                                Object.keys(newPayments).forEach(k => newPayments[k] = 'paid');
                                updateBillInFirestore(bill.id, { status: 'paid', memberPayments: newPayments });
                              }} className="flex-1 sm:flex-none h-8 text-xs">
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Matrix */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Payment Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  {/* Mobile Grid View */}
                  <div className="md:hidden space-y-4">
                    {bills.map((bill) => {
                      const BillIcon = billTypes.find(t => t.label === bill.type)?.icon || AlertCircle;
                      return (
                        <div key={bill.id} className="p-3 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <BillIcon className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-medium text-sm truncate">{bill.type}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              ₹{bill.amount}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {members.map((member) => (
                              <div key={member.uid} className="flex flex-col items-center gap-1">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={
                                    (member.avatar && (member.avatar.startsWith('data:') || member.avatar.startsWith('/') || member.avatar.startsWith('http')))
                                      ? member.avatar
                                      : getDefaultAvatar(member.name)
                                  } />
                                  <AvatarFallback className="text-[8px]">{member.name ? member.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                                </Avatar>
                                <div className="scale-75 origin-top">
                                  {bill.memberPayments[member.uid] ? getPaymentIcon(bill.memberPayments[member.uid]) : '-'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24"></TableHead>
                          {members.map((member) => (
                            <TableHead key={member.uid} className="text-center p-2 min-w-[60px]">
                              <div className="flex flex-col items-center gap-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={
                                    (member.avatar && (member.avatar.startsWith('data:') || member.avatar.startsWith('/') || member.avatar.startsWith('http')))
                                      ? member.avatar
                                      : getDefaultAvatar(member.name)
                                  } />
                                  <AvatarFallback className="text-xs">{member.name ? member.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] max-w-[50px] truncate">{member.name}</span>
                              </div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bills.map((bill) => {
                          const BillIcon = billTypes.find(t => t.label === bill.type)?.icon || AlertCircle;
                          return (
                            <TableRow key={bill.id}>
                              <TableCell className="p-2">
                                <div className="flex items-center gap-1">
                                  <BillIcon className="h-3 w-3 shrink-0" />
                                  <span className="text-xs font-medium truncate max-w-[60px]">{bill.type}</span>
                                </div>
                              </TableCell>
                              {members.map((member) => (
                                <TableCell key={member.uid} className="text-center p-2">
                                  {bill.memberPayments[member.uid] ? getPaymentIcon(bill.memberPayments[member.uid]) : '-'}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bill Details Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Bill Details</DialogTitle>
              <DialogDescription>View and manage bill payments</DialogDescription>
            </DialogHeader>

            {selectedBill ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>B</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{selectedBill.type}</div>
                    <div className="text-sm text-muted-foreground">Invoice: {selectedBill.invoiceNumber || 'N/A'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Amount</div>
                    <div className="text-lg font-bold">₹{(selectedBill.amount || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Per Member</div>
                    <div className="text-lg font-bold">₹{(selectedBill.perMemberShare || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Payment Status</div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {members.filter(m => selectedBill.memberPayments[m.uid]).map(m => (
                      <div key={m.uid} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={
                              (m.avatar && (m.avatar.startsWith('data:') || m.avatar.startsWith('/') || m.avatar.startsWith('http')))
                                ? m.avatar
                                : getDefaultAvatar(m.name)
                            } />
                            <AvatarFallback>{m.name ? m.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{m.name}</div>
                            <div className="text-xs text-muted-foreground">Status: {selectedBill.memberPayments[m.uid]}</div>
                          </div>
                        </div>
                        <div>
                          {selectedBill.memberPayments[m.uid] !== 'paid' && (userProfile?.uid === m.uid || isAdmin) && (
                            <Button size="sm" onClick={() => {
                              const newPayments = { ...selectedBill.memberPayments, [m.uid]: 'paid' } as Record<string, 'pending' | 'paid'>;
                              const allPaid = Object.values(newPayments).every(v => v === 'paid');
                              const status = allPaid ? 'paid' : 'partial';
                              updateBillInFirestore(selectedBill.id, { memberPayments: newPayments, status });
                              const billName = selectedBill.type || 'Shared Bill';
                              sendNotification(m.uid, 'Payment Recorded', `Your share for ${billName} is marked as paid.`, 'success');
                              setSelectedBill({ ...selectedBill, memberPayments: newPayments, status });
                            }}>Mark as Paid</Button>
                          )}
                          {selectedBill.memberPayments[m.uid] === 'paid' && (
                            <Badge variant="outline" className="text-green-600 bg-green-50">Already Paid</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  {selectedBill.status !== 'paid' && isAdmin && (
                    <Button onClick={() => {
                      const newPayments = { ...selectedBill.memberPayments };
                      Object.keys(newPayments).forEach(k => newPayments[k] = 'paid');
                      updateBillInFirestore(selectedBill.id, { status: 'paid', memberPayments: newPayments });

                      // Notify all involved members
                      Object.keys(newPayments).forEach(uid => {
                        sendNotification(uid, 'Bill Paid', `${selectedBill.type} has been fully settled.`, 'success');
                      });

                      setSelectedBill({ ...selectedBill, status: 'paid', memberPayments: newPayments });
                    }}>
                      Mark Entire Bill Paid
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { setIsDetailOpen(false); setSelectedBill(null); }}>Close</Button>
                </div>
              </div>
            ) : (
              <div>Loading...</div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </Layout >
  );
}
