import Layout from "@/components/Layout";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserPlus,
  IndianRupee,
  Mail,
  Phone,
  Calendar,
  Edit,
  MoreHorizontal,
  Eye,
  UserMinus,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Users
} from "lucide-react";
import { useState } from "react";
import { useAppState } from "@/state/AppState";
import { useFirestoreUsers } from "@/hooks/useFirestoreUsers";
import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, getSecondaryAuth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";


import { getDefaultAvatar } from "@/lib/avatar";

export default function Members() {
  const { deposits, expenses, settings } = useAppState();
  const { users: firestoreUsers, loading: usersLoading, updateUser } = useFirestoreUsers();
  const { userProfile } = useAuth(); // Get current user to check admin status

  const { deposits: firestoreDeposits, expenses: firestoreExpenses } = useTransactions();

  // Filter based on active period start
  const activePeriodStart = settings?.general?.activePeriodStart || '1970-01-01';

  // Convert Firestore users to Member format
  const members = firestoreUsers.map(user => {
    const userDeposits = firestoreDeposits.filter(d => d.uid === user.uid && d.date >= activePeriodStart && (d.status === 'confirmed' || !d.status));
    const userExpenses = firestoreExpenses.filter(e => e.uid === user.uid && e.type === 'self' && (e.status === 'confirmed' || !e.status) && e.date >= activePeriodStart);

    const depositedValue = userDeposits.reduce((s, d) => s + (d.amount || 0), 0);
    const selfSpentValue = userExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalContribution = depositedValue + selfSpentValue;
    const target = user.monthlyTarget || 1500;

    let status = 'behind';
    if (totalContribution >= 1000) status = 'on-track';
    if (totalContribution === target) status = 'target-met';
    if (totalContribution > target) status = 'ahead';

    const userAllExpenses = firestoreExpenses.filter(e => e.uid === user.uid);
    const userAllDeposits = firestoreDeposits.filter(d => d.uid === user.uid);
    const allActivities = [...userAllDeposits, ...userAllExpenses];

    const lastActivityDate = allActivities.length > 0
      ? allActivities.reduce((latest, current) => current.date > latest ? current.date : latest, allActivities[0].date)
      : null;

    return {
      id: user.uid, // Use UID as ID
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar || getDefaultAvatar(user.name),
      joinDate: user.joinedAt,
      isActive: user.isActive,
      isAdmin: user.role === 'admin',
      target: target,
      deposited: depositedValue,
      selfSpent: selfSpentValue,
      totalContribution: totalContribution,
      extra: Math.max(0, totalContribution - target),
      reimbursementRequests: firestoreExpenses
        .filter(e => e.uid === user.uid && (e.status === 'reimbursement_requested' || e.status === 'reimbursement_eligible'))
        .reduce((s, e) => s + (e.amount || 0), 0),
      lastActivity: lastActivityDate ? lastActivityDate : (user.joinedAt ? `Joined ${user.joinedAt}` : 'No activity'),
      status: status,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  });

  const summary = {
    totalMembers: members.length,
    activeMembers: members.filter(m => m.isActive).length,
    avgTarget: members.length ? Math.round(members.reduce((s, m) => s + (m.target || 0), 0) / members.length) : 0,
    avgContribution: members.length ? Math.round(members.reduce((s, m) => s + (m.totalContribution || 0), 0) / members.length) : 0
  };
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  // Add member form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newJoinMonth, setNewJoinMonth] = useState("2024-01");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newConfirmPassword, setNewConfirmPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  // Check if current user is admin
  const isAdmin = userProfile?.role === 'admin';

  const handleAddMember = async () => {
    // Validation
    if (!newName || !newEmail || !newPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in name, email, and password",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== newConfirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure passwords match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);

      // Create Firebase Auth user using secondary auth to prevent admin logout
      const secondaryAuth = await getSecondaryAuth();
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newEmail,
        newPassword
      );
      const user = userCredential.user;

      // Create Firestore user profile (using main db instance is fine)
      const userProfile = {
        uid: user.uid,
        email: user.email || newEmail,
        name: newName,
        phone: newPhone || '',
        role: newIsAdmin ? 'admin' : 'member',
        isActive: true,
        monthlyTarget: parseInt(newTarget || '1500'),
        joinedAt: newJoinMonth,
        createdAt: new Date().toISOString(),
        twoFactorEnabled: false,
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);

      toast({
        title: "Member created successfully!",
        description: `${newName} can now login with their credentials`,
      });

      // Reset form
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewTarget("");
      setNewJoinMonth("2024-01");
      setNewIsAdmin(false);
      setNewPassword("");
      setNewConfirmPassword("");
      setIsAddDialogOpen(false);
    } catch (error: any) {
      console.error('Error creating member:', error);

      let errorMessage = 'Failed to create member';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already in use';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Edit & View handlers
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  const openEditMember = (member: any) => {
    setSelectedMember(member);
    setEditName(member.name || "");
    setEditEmail(member.email || "");
    setEditPhone(member.phone || "");
    setEditTarget(String(member.target || ""));
    setEditIsAdmin(Boolean(member.isAdmin));
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMember || !updateUser) return;

    try {
      const updatedData = {
        name: editName,
        email: editEmail || undefined,
        phone: editPhone || '',
        monthlyTarget: parseInt(editTarget || '0') || 0,
        role: editIsAdmin ? 'admin' as const : 'member' as const
      };

      await updateUser(selectedMember.id, updatedData);

      toast({
        title: "Member Updated",
        description: `Successfully updated details for ${editName}.`,
      });

      setIsEditDialogOpen(false);
      setSelectedMember(null);
    } catch (error) {
      console.error("Error updating member:", error);
      toast({
        title: "Error",
        description: "Failed to update member profile in database.",
        variant: "destructive",
      });
    }
  };

  const openViewMember = (member: any) => {
    setSelectedMember(member);
    setIsViewDialogOpen(true);
  };

  const closeViewMember = () => {
    setSelectedMember(null);
    setIsViewDialogOpen(false);
  };

  const handleRemoveMember = async (member: any) => {
    try {
      if (member.isActive) {
        await updateUser(member.id, { isActive: false });
        toast({
          title: "Member Deactivated",
          description: `Successfully deactivated ${member.name}.`,
        });
      } else {
        // Toggle back to active or leave as is. Removing from Firestore completely requires deleteUser.
        // For now, allow deactivation only.
        toast({
          title: "Note",
          description: "Full deletion is disabled for safety. Use deactivation instead.",
        });
      }
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to update member status.",
        variant: "destructive",
      });
    }
  };

  const filteredMembers = members.filter(member => {
    switch (filterStatus) {
      case "all":
        return true;
      case "active":
        return Boolean(member.isActive);
      case "inactive":
        return !member.isActive;
      case "on-track":
      case "behind":
      case "target-met":
      case "ahead":
        return member.status === filterStatus;
      default:
        return true;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return 'bg-green-100 text-green-700 border-green-200';
      case 'behind': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'ahead': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'target-met': return 'bg-green-600 text-white border-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'on-track': return 'On Track';
      case 'behind': return 'Behind Target';
      case 'ahead': return 'Above Target';
      case 'target-met': return 'Target Met';
      case 'inactive': return 'Inactive';
      default: return 'Unknown';
    }
  };

  const getProgressPercentage = (deposited: number, target: number) => {
    if (!target || target <= 0) return 0;
    return Math.round((Math.min(deposited, target) / target) * 100);
  };

  if (usersLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading members...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Members</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage flat members and their targets</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
                <SelectItem value="on-track">On Track</SelectItem>
                <SelectItem value="behind">Behind Target</SelectItem>
                <SelectItem value="target-met">Target Met</SelectItem>
                <SelectItem value="ahead">Above Target</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Member</DialogTitle>
                    <DialogDescription>
                      Add a new member to the flat fund.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" placeholder="John Doe" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="john@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone (Optional)</Label>
                      <Input id="phone" placeholder="+91 98765 43210" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isCreating}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Re-enter password"
                        value={newConfirmPassword}
                        onChange={(e) => setNewConfirmPassword(e.target.value)}
                        disabled={isCreating}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="target">Monthly Target</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="target" placeholder="1500" className="pl-9" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Join Month</Label>
                      <Select value={newJoinMonth} onValueChange={setNewJoinMonth}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2024-01">January 2024</SelectItem>
                          <SelectItem value="2024-02">February 2024</SelectItem>
                          <SelectItem value="2024-03">March 2024</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="admin" checked={newIsAdmin} onCheckedChange={(val) => setNewIsAdmin(Boolean(val))} />
                      <Label htmlFor="admin">Grant admin privileges</Label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isCreating}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddMember} disabled={isCreating}>
                      {isCreating ? "Creating..." : "Add Member"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                {summary.totalMembers}
              </div>
              <p className="text-sm text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {summary.activeMembers}
              </div>
              <p className="text-sm text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Average Target</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center">
                <IndianRupee className="h-5 w-5" />
                {summary.avgTarget.toLocaleString("en-IN")}
              </div>
              <p className="text-sm text-muted-foreground">Per member</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Average Contribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 flex items-center">
                <IndianRupee className="h-5 w-5" />
                {summary.avgContribution.toLocaleString("en-IN")}
              </div>
              <p className="text-sm text-muted-foreground">Per member</p>
            </CardContent>
          </Card>
        </div>

        {/* Members List */}
        <div className="grid gap-4">
          {filteredMembers.map((member) => {
            const deposited = Number(member.deposited || 0);
            const selfSpent = Number(member.selfSpent || 0);
            const totalContribution = deposited + selfSpent;
            const target = Number(member.target || 0);
            const progress = getProgressPercentage(totalContribution, target);
            const remaining = Math.max(target - totalContribution, 0);

            return (
              <Card key={`member-${member.id}`} className={`${!member.isActive ? 'opacity-60' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 w-full">
                      <Avatar className="h-12 w-12 aspect-square">
                        <AvatarImage src={
                          (member.avatar && (member.avatar.startsWith('data:') || member.avatar.startsWith('/') || member.avatar.startsWith('http')))
                            ? member.avatar
                            : getDefaultAvatar(member.name)
                        } />
                        <AvatarFallback>{member.name ? member.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-lg truncate max-w-[150px] sm:max-w-none" title={member.name}>{member.name}</h3>
                          {member.isAdmin && (
                            <Badge variant="secondary" className="text-xs">Admin</Badge>
                          )}
                          <Badge className={getStatusColor(member.status)}>
                            {getStatusText(member.status)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mt-2">
                          <div className="flex items-center gap-2 break-all">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            {member.email}
                          </div>
                          {member.phone && (
                            <div className="flex items-center gap-2 break-all">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {member.phone}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            Joined {member.joinDate}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="absolute top-6 right-6 sm:relative sm:top-0 sm:right-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openViewMember(member)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuItem onClick={() => openEditMember(member)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Member
                              </DropdownMenuItem>
                              {member.isActive ? (
                                <DropdownMenuItem className="text-red-600" onClick={() => updateUser && updateUser(member.id, { isActive: false })}>
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="text-green-600" onClick={() => updateUser && updateUser(member.id, { isActive: true })}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Activate
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="text-xs text-muted-foreground">
                        Contribution: ₹{totalContribution.toLocaleString("en-IN")} / Target: ₹{(target || 0).toLocaleString("en-IN")}
                      </div>
                    </div>

                    {/* Cash Deposited */}
                    <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
                      <div className="text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Deposited
                      </div>
                      <div className="text-xl font-bold text-green-700">
                        ₹{(member.deposited || 0).toLocaleString("en-IN")}
                      </div>
                    </div>

                    {/* Self Spent */}
                    <div className="text-center p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                      <div className="text-sm text-indigo-600 font-medium flex items-center justify-center gap-1">
                        <IndianRupee className="h-3 w-3" />
                        Self Spent
                      </div>
                      <div className="text-xl font-bold text-indigo-700">
                        ₹{(member.selfSpent || 0).toLocaleString("en-IN")}
                      </div>
                    </div>

                    {/* Extra Amount */}
                    <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-sm text-blue-600 font-medium flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Total Extra
                      </div>
                      <div className="text-xl font-bold text-blue-700">
                        ₹{(member.extra || 0).toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs text-blue-600">
                        Above monthly target
                      </div>
                      {member.reimbursementRequests > 0 && (
                        <div className="text-xs text-orange-600 flex items-center justify-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          Pending: ₹{(member.reimbursementRequests).toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground">
                        {totalContribution >= target ? 'Extra Amount' : 'Due Amount'}
                      </div>
                      <div className={`text-xl font-bold ${totalContribution >= target ? 'text-green-600' : 'text-orange-600'}`}>
                        ₹{(totalContribution >= target ?
                          Math.max(0, (member.extra || 0)) :
                          Math.max(0, target - totalContribution)
                        ).toLocaleString("en-IN")}
                      </div>
                      {member.reimbursementRequests > 0 && (
                        <div className="text-xs text-orange-600 flex items-center justify-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          Pending: ₹{(member.reimbursementRequests).toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs sm:text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last activity: {member.lastActivity}
                    </span>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {isAdmin && (
                        <Button variant="outline" size="sm" onClick={() => openEditMember(member)} className="flex-1 sm:flex-none h-8 text-xs">
                          <Edit className="h-3 w-3 mr-1" />
                          Edit Target
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openViewMember(member)} className="flex-1 sm:flex-none h-8 text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        View History
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredMembers.length === 0 && (
          <EmptyState
            icon={Users}
            title="No Members Found"
            description="Invite your roommates or group members to start tracking shared funds."
            actionLabel={isAdmin ? "Add Member" : undefined}
            onAction={isAdmin ? () => setIsAddDialogOpen(true) : undefined}
          />
        )}

        {/* Edit Member Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Member</DialogTitle>
              <DialogDescription>Update member details</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Full Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Monthly Target</Label>
                <Input value={editTarget} onChange={(e) => setEditTarget(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editIsAdmin} onCheckedChange={(v) => setEditIsAdmin(Boolean(v))} />
                <Label>Admin</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Member Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Member Details</DialogTitle>
              <DialogDescription>Member activity and contributions</DialogDescription>
            </DialogHeader>
            {selectedMember ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={
                      (selectedMember.avatar && (selectedMember.avatar.startsWith('data:') || selectedMember.avatar.startsWith('/') || selectedMember.avatar.startsWith('http')))
                        ? selectedMember.avatar
                        : getDefaultAvatar(selectedMember.name)
                    } />
                    <AvatarFallback>{selectedMember.name ? selectedMember.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{selectedMember.name}</div>
                    <div className="text-sm text-muted-foreground">{selectedMember.email}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Target</div>
                    <div className="text-lg font-bold">₹{(selectedMember.target || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Total Contribution</div>
                    <div className="text-lg font-bold">₹{(selectedMember.totalContribution || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-sm text-muted-foreground">Extra Amount</div>
                  <div className="text-lg font-bold">₹{(Math.max(0, (selectedMember.extra || 0))).toLocaleString('en-IN')}</div>
                  {selectedMember.reimbursementRequests > 0 && (
                    <div className="text-sm text-orange-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      Pending Reimbursement Requests: {selectedMember.reimbursementRequests}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Activity History</div>
                  <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-1">
                    {[
                      ...firestoreDeposits.filter(d => d.uid === selectedMember.id).map(d => ({ ...d, activityType: 'deposit' as const })),
                      ...firestoreExpenses.filter(e => e.uid === selectedMember.id).map(e => ({ ...e, activityType: 'expense' as const }))
                    ]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((item: any) => (
                        <div key={`${item.activityType}-${item.id}`} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${item.activityType === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                              {item.activityType === 'deposit' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="font-medium">
                                {item.activityType === 'deposit' ? 'Deposit' : 'Expense'}
                                <span className={`ml-2 text-sm font-bold ${item.activityType === 'deposit' ? 'text-green-600' : 'text-blue-600'}`}>
                                  {item.activityType === 'deposit' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.date} • {item.note || item.category || 'No details'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" onClick={closeViewMember}>Close</Button>
                </div>
              </div>
            ) : (
              <div>Loading...</div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
