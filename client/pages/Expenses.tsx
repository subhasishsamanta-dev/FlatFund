import Layout from "@/components/Layout";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
    Search,
    Filter,
    IndianRupee,
    Download,
    Eye,
    Receipt,
    Pencil
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTransactions, Expense } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreUsers } from "@/hooks/useFirestoreUsers";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getDefaultAvatar } from "@/lib/avatar";
import { sendNotification } from "@/lib/notifications";
import { useAppState } from "@/state/AppState";
import { getCategoryIcon } from "@/lib/icons";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Expenses() {
    const { expenses, loading: transactionsLoading, addExpense: addExpenseToFirestore, updateExpense: updateExpenseInFirestore } = useTransactions();
    const { users: firestoreUsers } = useFirestoreUsers();
    const { userProfile } = useAuth();
    const { settings } = useAppState();

    const members = firestoreUsers.map(u => ({
        id: u.uid,
        name: u.name,
        avatar: u.avatar,
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

    // Filter based on active period start
    const activePeriodStart = settings?.general?.activePeriodStart || '1970-01-01';



    // Total Expenses card logic:
    // 1. All fund expenses (including confirmed payouts)
    // 2. Self expenses that are confirmed OR any reimbursement status
    const fundExpenses = expenses
        .filter(e => e.type === 'fund' && (e.status === 'confirmed' || e.status === 'reimbursed' || !e.status) && e.date >= activePeriodStart)
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const selfExpenses = expenses
        .filter(e => e.type === 'self' && (e.status === 'confirmed' || e.status === 'reimbursement_requested' || e.status === 'reimbursement_eligible' || e.status === 'reimbursed' || !e.status) && e.date >= activePeriodStart)
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const totalExpenses = fundExpenses + selfExpenses;

    console.log('Expenses Page Debug:', {
        activePeriodStart,
        totalExpensesInSystem: expenses.length,
        filteredTotal: totalExpenses,
        expenseStatuses: [...new Set(expenses.map(e => e.status))],
        expenseDates: expenses.map(e => e.date).slice(0, 5)
    });

    const summary = { totalExpenses, fundExpenses, selfExpenses, thisMonth: totalExpenses };

    const [date, setDate] = useState<string>('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");

    // Add/Edit expense form state
    const [amountInput, setAmountInput] = useState("");
    const [categoryInput, setCategoryInput] = useState("");
    const [noteInput, setNoteInput] = useState("");
    const [expenseType, setExpenseType] = useState<"fund" | "self">("fund");
    const [requestReimbursement, setRequestReimbursement] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(userProfile?.uid || null);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editExpenseId, setEditExpenseId] = useState<string | null>(null);

    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Set default date to today when dialog opens
    useEffect(() => {
        if (isAddDialogOpen && !isEditing) {
            setDate(new Date().toISOString().split('T')[0]);
            setSelectedMemberId(userProfile?.uid || null);
        }
    }, [isAddDialogOpen, isEditing, userProfile]);

    const resetForm = () => {
        setAmountInput("");
        setCategoryInput("");
        setNoteInput("");
        setDate('');
        setRequestReimbursement(false);
        setExpenseType("fund");
        setIsEditing(false);
        setEditExpenseId(null);
        setSelectedMemberId(userProfile?.uid || null);
    };

    const handleEditClick = (expense: Expense) => {
        setAmountInput(expense.amount.toString());
        setCategoryInput(expense.category);
        setNoteInput(expense.note || "");
        setDate(expense.date);
        setExpenseType(expense.type as "fund" | "self");
        // Check if status implies reimbursement requested
        setRequestReimbursement(expense.status === 'reimbursement_requested');
        setSelectedMemberId(expense.uid);

        setIsEditing(true);
        setEditExpenseId(expense.id);
        setIsAddDialogOpen(true);
    };

    const handleSaveExpense = async () => {
        if (!amountInput || parseInt(amountInput) <= 0) {
            toast({
                title: "Invalid Amount",
                description: "Please enter a valid expense amount greater than 0.",
                variant: "destructive",
            });
            return;
        }

        if (!date) {
            toast({
                title: "Date Required",
                description: "Please select a date for the expense.",
                variant: "destructive",
            });
            return;
        }

        if (!categoryInput) {
            toast({
                title: "Category Required",
                description: "Please enter a category for the expense.",
                variant: "destructive",
            });
            return;
        }

        if (!noteInput.trim()) {
            toast({
                title: "Note Required",
                description: "Please enter a note for the expense.",
                variant: "destructive",
            });
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        if (date && date > today) {
            toast({
                title: "Invalid Date",
                description: "Future dates are not allowed for expenses.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedMember = firestoreUsers.find(u => u.uid === selectedMemberId);

            const commonData = {
                amount: parseInt(amountInput || '0') || 0,
                date: date ? date : today,
                category: categoryInput,
                note: noteInput || '',
                type: expenseType,
                // If editing, preserve status unless explicitly logic changes it (here simplified to re-eval based on type/check)
                // For simplicty, creates/updates adhere to current form state logic:
                status: (expenseType === 'self' && requestReimbursement) ? 'reimbursement_requested' : 'confirmed',
                uid: selectedMemberId || userProfile?.uid,
                userName: selectedMember?.name || userProfile?.name,
                userAvatar: selectedMember?.avatar || ''
            };

            if (isEditing && editExpenseId) {
                await updateExpenseInFirestore(editExpenseId, commonData);
                toast({
                    title: "Expense Updated",
                    description: `Successfully updated expense.`,
                });
            } else {
                await addExpenseToFirestore(commonData as any);
                // Notify all users via Firestore (in-app bell)
                await sendNotification(
                    'all',
                    'New Expense',
                    `New ${expenseType} expense of ₹${commonData.amount} by ${commonData.userName}.`,
                    'info'
                );

                // Trigger FCM push notification to all devices (fire-and-forget)
                fetch('/api/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: commonData.uid,
                        userName: commonData.userName,
                        amount: commonData.amount,
                        category: commonData.category,
                        type: commonData.type
                    })
                }).catch(() => { });

                // If reimbursement was requested, also notify admins via push
                if (expenseType === 'self' && requestReimbursement) {
                    fetch('/api/reimbursements/request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: commonData.uid,
                            userName: commonData.userName,
                            amount: commonData.amount
                        })
                    }).catch(() => { });
                }

                toast({
                    title: "Expense Added",
                    description: `Successfully recorded ${expenseType} expense of ₹${commonData.amount}.`,
                });
            }

            // reset form
            resetForm();
            setIsAddDialogOpen(false);
        } catch (error: any) {
            console.error("Error saving expense:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to save expense. Please try again.",
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
            { header: 'Category', dataKey: 'category' },
            { header: 'Note', dataKey: 'note' },
            { header: 'Type', dataKey: 'type' },
            { header: 'Amount (INR)', dataKey: 'amount' },
        ];

        const exportParams = {
            title: 'Expenses Report',
            filename: `expenses_report_${new Date().toISOString().split('T')[0]}`,
            columns,
            data: filteredExpenses
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

    const filteredExpenses = expenses
        .filter(expense => {
            const matchesSearch = (expense.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (expense.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (expense.category || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === "all" || expense.type === typeFilter;
            const matchesStatus = statusFilter === "all" || expense.status === statusFilter;

            const expenseDate = expense.date;
            const validFrom = !fromDate || expenseDate >= fromDate;
            const validTo = !toDate || expenseDate <= toDate;

            return matchesSearch && matchesType && matchesStatus && validFrom && validTo;
        })
        .sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            // Secondary sort: High createdAt timestamp first
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

    const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const openExpenseDetail = (expense: Expense) => {
        setSelectedExpense(expense);
        setIsDetailOpen(true);
    };

    const closeExpenseDetail = () => {
        setSelectedExpense(null);
        setIsDetailOpen(false);
    };

    return (
        <Layout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">Expenses</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">Track and manage all expenses</p>
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
                        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                            setIsAddDialogOpen(open);
                            if (!open) resetForm();
                        }}>
                            <DialogTrigger asChild>
                                <Button onClick={() => resetForm()} className="flex-1 sm:flex-none h-10 px-4">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Expense
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{isEditing ? "Edit Expense" : "Add New Expense"}</DialogTitle>
                                    <DialogDescription>
                                        {isEditing ? "Update details of the expense." : "Record a new fund or self expense."}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="expense-type">Expense Type</Label>
                                        <Select
                                            value={expenseType}
                                            onValueChange={(val) => setExpenseType(val as "fund" | "self")}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fund">Fund Expense</SelectItem>
                                                <SelectItem value="self">Self Expense</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Fund = Shared expense, Self = Personal expense
                                        </p>
                                    </div>

                                    {expenseType === 'self' && (
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="reimbursement"
                                                checked={requestReimbursement}
                                                onCheckedChange={(c) => setRequestReimbursement(!!c)}
                                            />
                                            <Label htmlFor="reimbursement">Request Reimbursement</Label>
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <Label htmlFor="amount">Amount</Label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input id="amount" placeholder="500" className="pl-9" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="expense-date">Date *</Label>
                                        <Input
                                            id="expense-date"
                                            type="date"
                                            value={date}
                                            max={new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setDate(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="category">Category</Label>
                                        <Select value={categoryInput} onValueChange={setCategoryInput}>
                                            <SelectTrigger id="category">
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(settings.categories && settings.categories.length > 0) ? (
                                                    settings.categories.map((cat: any) => {
                                                        const Icon = getCategoryIcon(cat.icon);
                                                        return (
                                                            <SelectItem key={cat.id} value={cat.label}>
                                                                <div className="flex items-center gap-2">
                                                                    <div
                                                                        className="p-1 rounded-full"
                                                                        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                                                                    >
                                                                        <Icon className="h-3 w-3" />
                                                                    </div>
                                                                    {cat.label}
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })
                                                ) : (
                                                    <>
                                                        <SelectItem value="Groceries">Groceries</SelectItem>
                                                        <SelectItem value="Utilities">Utilities</SelectItem>
                                                        <SelectItem value="Rent">Rent</SelectItem>
                                                        <SelectItem value="Internet">Internet</SelectItem>
                                                        <SelectItem value="Other">Other</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
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
                                        <Label htmlFor="note">Note *</Label>
                                        <Textarea id="note" placeholder="What was this expense for?" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} required />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => {
                                        setIsAddDialogOpen(false);
                                        resetForm();
                                    }} disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSaveExpense} disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {isEditing ? "Update Expense" : "Add Expense"}
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
                            <CardTitle className="text-[10px] sm:text-sm font-medium">Total Expenses</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0">
                            <div className="text-sm sm:text-2xl font-bold text-red-600 flex items-center truncate">
                                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                                {summary.totalExpenses.toLocaleString("en-IN")}
                            </div>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">All time</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
                            <CardTitle className="text-[10px] sm:text-sm font-medium">Fund Expenses</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0">
                            <div className="text-sm sm:text-2xl font-bold text-orange-600 flex items-center truncate">
                                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                                {summary.fundExpenses.toLocaleString("en-IN")}
                            </div>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">Shared expenses</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
                            <CardTitle className="text-[10px] sm:text-sm font-medium">Self Expenses</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0">
                            <div className="text-sm sm:text-2xl font-bold text-purple-600 flex items-center truncate">
                                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                                {summary.selfExpenses.toLocaleString("en-IN")}
                            </div>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">Personal expenses</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-3">
                            <CardTitle className="text-[10px] sm:text-sm font-medium">This Month</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0">
                            <div className="text-sm sm:text-2xl font-bold flex items-center truncate">
                                <IndianRupee className="h-3 w-3 sm:h-5 sm:w-5 shrink-0" />
                                {summary.thisMonth.toLocaleString("en-IN")}
                            </div>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">Current month</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters and Search */}
                <Card>
                    <CardHeader>
                        <CardTitle>Expense History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="flex-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search expenses..."
                                        className="pl-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-full sm:w-40">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="fund">Fund</SelectItem>
                                    <SelectItem value="self">Self</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-40">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="confirmed">Confirmed</SelectItem>
                                    <SelectItem value="reimbursement_requested">Reimbursement Requested</SelectItem>
                                    <SelectItem value="reimbursement_approved">Reimbursement Approved</SelectItem>
                                    <SelectItem value="reimbursement_rejected">Reimbursement Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-full sm:w-40">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {settings.categories?.map((cat: any) => (
                                        <SelectItem key={cat.id} value={cat.label}>{cat.label}</SelectItem>
                                    ))}
                                    {(!settings.categories || settings.categories.length === 0) && (
                                        <>
                                            <SelectItem value="Groceries">Groceries</SelectItem>
                                            <SelectItem value="Utilities">Utilities</SelectItem>
                                            <SelectItem value="Rent">Rent</SelectItem>
                                            <SelectItem value="Internet">Internet</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Range Filter */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="flex-1">
                                <Label htmlFor="from-date" className="text-xs">From Date</Label>
                                <Input
                                    id="from-date"
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                />
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="to-date" className="text-xs">To Date</Label>
                                <Input
                                    id="to-date"
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Expenses List */}
                        <div className="space-y-3">
                            {paginatedExpenses.map((expense) => (
                                <div key={expense.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border gap-4">
                                    <div className="flex items-center gap-4 min-w-0 w-full">
                                        <Avatar className="h-10 w-10 shrink-0 aspect-square">
                                            <AvatarImage src={resolveAvatar(expense.uid, expense.userName || 'User')} />
                                            <AvatarFallback>{expense.userName ? expense.userName.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <div className="font-medium truncate">{expense.userName}</div>
                                            <div className="text-sm text-muted-foreground break-words overflow-wrap-anywhere line-clamp-2">
                                                {expense.category} • {expense.note}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {expense.date}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center justify-between w-full sm:w-auto gap-3">
                                        <div className="text-left sm:text-right">
                                            <div className="text-lg font-bold text-red-600 flex items-center">
                                                <IndianRupee className="h-4 w-4 shrink-0" />
                                                {expense.amount.toLocaleString("en-IN")}
                                            </div>
                                            <div className="flex gap-1">
                                                <Badge variant={expense.type === 'fund' ? 'default' : 'secondary'} className="text-[10px]">
                                                    {expense.type}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {expense.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => openExpenseDetail(expense)} className="h-8 w-8">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            {/* Edit Button: Visible if Admin OR if the current user owns the expense */}
                                            {(userProfile?.role === 'admin' || userProfile?.uid === expense.uid) && (
                                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(expense)} className="h-8 w-8">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredExpenses.length === 0 && (
                            <EmptyState
                                icon={Receipt}
                                title="No Expenses Found"
                                description="Track all fund and personal expenses here to keep the group updated."
                                actionLabel="Record Expense"
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

                        {/* Expense Details Dialog */}
                        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>Expense Details</DialogTitle>
                                    <DialogDescription>View full details of the expense.</DialogDescription>
                                </DialogHeader>
                                {selectedExpense ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={resolveAvatar(selectedExpense.uid, selectedExpense.userName || 'User')} />
                                                <AvatarFallback>{selectedExpense.userName ? selectedExpense.userName.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium">{selectedExpense.userName}</div>
                                                <div className="text-sm text-muted-foreground">{selectedExpense.category}</div>
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="text-sm text-muted-foreground">Amount</div>
                                            <div className="text-xl font-bold">₹{selectedExpense.amount.toLocaleString("en-IN")}</div>
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="text-sm text-muted-foreground">Type</div>
                                            <Badge variant={selectedExpense.type === 'fund' ? 'default' : 'secondary'}>
                                                {selectedExpense.type}
                                            </Badge>
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="text-sm text-muted-foreground">Status</div>
                                            <Badge variant="outline">{selectedExpense.status}</Badge>
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="text-sm text-muted-foreground">Date</div>
                                            <div>{selectedExpense.date}</div>
                                        </div>
                                        <div className="grid gap-2">
                                            <div className="text-sm text-muted-foreground">Note</div>
                                            <div>{selectedExpense.note || 'No note provided'}</div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            {(userProfile?.role === 'admin' || userProfile?.uid === selectedExpense.uid) && (
                                                <Button variant="outline" onClick={() => {
                                                    closeExpenseDetail();
                                                    handleEditClick(selectedExpense);
                                                }}>
                                                    Edit
                                                </Button>
                                            )}
                                            <Button onClick={closeExpenseDetail}>Close</Button>
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
        </Layout >
    );
}
