import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Key,
  Camera,
  Save,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  PieChart,
  Download,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useAppState } from "@/state/AppState";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useBills } from "@/hooks/useBills";
import { useFirestoreUsers } from "@/hooks/useFirestoreUsers";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";
import { getPushRegistrationStatus } from "@/lib/notifications";


export default function Profile() {
  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { user, setUser } = useAppState();
  const { updateUser } = useFirestoreUsers();
  const { updateUserPassword, refreshUserProfile } = useAuth();
  const { deposits, expenses } = useTransactions();
  const { bills } = useBills();

  const userData = user || { id: 0, name: 'User', email: '', phone: '', avatar: '', joinDate: '', isAdmin: false, lastLogin: '', twoFactorEnabled: false, statistics: { totalDeposits: 0, totalExpenses: 0, monthsActive: 0, avgMonthlyContribution: 0, reimbursementsReceived: 0, currentStreak: 0 }, recentActivity: [] };

  // Calculate Recent Activity
  const activityLog = useMemo(() => {
    if (!userData.id) return [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const log: any[] = [];

    // Deposits
    deposits.forEach(d => {
      // For Firestore deposits, we check against uid
      if ((d.uid === userData.id || d.uid === (userData as any).uid) && d.date >= thirtyDaysAgoStr) {
        log.push({
          id: `dep-${d.id}`,
          type: 'deposit',
          description: d.note || 'Deposit',
          date: d.date,
          amount: d.amount
        });
      }
    });

    // Expenses (Fund & Self)
    expenses.forEach(e => {
      // Show expenses made by this user (whether fund or self)
      if ((e.uid === userData.id || e.uid === (userData as any).uid) && e.date >= thirtyDaysAgoStr) {
        log.push({
          id: `exp-${e.id}`,
          type: 'expense',
          description: e.note || e.category || 'Expense',
          date: e.date,
          amount: e.amount
        });
      }
    });

    // Bills
    bills.forEach(b => {
      // Check if user has paid this bill
      const paymentStatus = b.memberPayments && (b.memberPayments[userData.id] || b.memberPayments[(userData as any).uid]);
      if (paymentStatus === 'paid' && b.dueDate && b.dueDate >= thirtyDaysAgoStr) {
        log.push({
          id: `bill-${b.id}`,
          type: 'bill',
          description: `${b.type} Bill`,
          date: b.dueDate,
          amount: b.perMemberShare
        });
      }
    });

    return log.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [userData.id, deposits, expenses, bills]);
  // Calculate Real-time Statistics
  const stats = useMemo(() => {
    if (!userData.id) return { totalDeposits: 0, totalExpenses: 0, monthsActive: 0, avgMonthlyContribution: 0, reimbursementsReceived: 0, currentStreak: 0 };

    const userExpenses = expenses.filter(e =>
      (e.uid === userData.id || e.uid === (userData as any).uid) &&
      e.type === 'self' &&
      e.category !== 'Reimbursement Payout' &&
      (e.status === 'confirmed' || !e.status)
    );
    const totalExpenses = userExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const userDeposits = deposits.filter(d => (d.uid === userData.id || d.uid === (userData as any).uid) && (d.status === 'confirmed' || !d.status));
    const totalDeposits = userDeposits.reduce((acc, curr) => acc + (curr.amount || 0), 0) + totalExpenses;

    // Calculate months active (approx)
    const joinDate = new Date(userData.joinDate || Date.now());
    const now = new Date();
    const monthsActive = Math.max(1, (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth()));

    const avgMonthlyContribution = totalDeposits / monthsActive;

    // Calculate streak (consecutive months with deposits)
    // Simplified streak logic: count how many recent months have at least one deposit
    let currentStreak = 0;
    for (let i = 0; i < 12; i++) { // Check last 12 months
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
      const hasDeposit = userDeposits.some(dep => dep.date.startsWith(monthStr));
      if (hasDeposit) {
        currentStreak++;
      } else if (i > 0) { // Break if gap found (allow current month to be empty if just started)
        // But if it's the current month and we haven't deposited yet, don't break streak immediately if previous month had one?
        // Simple approach: break on first missing month
        break;
      }
    }

    // Calculate reimbursements received (expenses that were reimbursed)
    const reimbursedExpenses = expenses.filter(e =>
      (e.uid === userData.id || e.uid === (userData as any).uid) &&
      e.status === 'reimbursed'
    );
    const reimbursementsReceived = reimbursedExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return {
      totalDeposits,
      totalExpenses,
      monthsActive,
      avgMonthlyContribution,
      reimbursementsReceived,
      currentStreak
    };
  }, [userData.id, userData.joinDate, deposits, expenses]);

  const progressPercentage = stats.currentStreak ? Math.min(100, Math.round((stats.avgMonthlyContribution / (stats.avgMonthlyContribution || 1)) * 100)) : 0;

  // Local editable state
  const [name, setName] = useState(userData.name);
  const [email, setEmail] = useState(userData.email);
  const [phone, setPhone] = useState(userData.phone || "");
  const [monthlyTarget, setMonthlyTarget] = useState((userData as any).monthlyTarget || 1500);
  const [avatar, setAvatar] = useState(userData.avatar || "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // sync when global user changes
    setName(userData.name);
    setEmail(userData.email);
    setPhone(userData.phone || "");
    setAvatar(userData.avatar || "");
  }, [userData]);

  const onSelectAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatar(result);
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const [isSaving, setIsSaving] = useState(false);

  const saveUserChanges = async () => {
    if (isSaving) return; // Prevent double-click

    setIsSaving(true);
    const updatedUser = {
      ...userData,
      name: name.trim() || userData.name,
      email: email.trim() || userData.email,
      phone: phone.trim(),
      monthlyTarget: parseInt(String(monthlyTarget)) || 1500,
      avatar: avatar || userData.avatar,
    };

    try {
      // Support both id and uid for compatibility
      const userId = updatedUser.id || (updatedUser as any).uid;
      if (!userId) {
        throw new Error("User ID not found");
      }

      console.log("Updating user profile:", userId, {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        monthlyTarget: updatedUser.monthlyTarget,
        avatar: updatedUser.avatar ? `${updatedUser.avatar.substring(0, 50)}...` : 'none',
      });

      await updateUser(String(userId), {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        monthlyTarget: updatedUser.monthlyTarget,
        avatar: updatedUser.avatar,
      });

      // Also update local user identity if it's the current user
      setUser(updatedUser as any);

      // Refresh the userProfile in AuthContext to update header avatar
      await refreshUserProfile();

      toast.success("Profile updated successfully");
      haptics.success();
      setHasChanges(false);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile: " + (error.message || "Unknown error"));
      haptics.error();
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      haptics.error();
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      haptics.error();
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      haptics.error();
      return;
    }

    try {
      await updateUserPassword(currentPassword, newPassword);
      toast.success("Password updated successfully");
      haptics.success();
      setIsChangePasswordOpen(false);
      // Clear fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Password update error:", error);
      toast.error(error.message || "Failed to update password. Check current password.");
      haptics.error();
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
          {hasChanges && (
            <Button onClick={saveUserChanges} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Overview */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20 aspect-square">
                      <AvatarImage src={avatar} alt={name} />
                      <AvatarFallback className="text-2xl">
                        {name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onSelectAvatarFile} />
                    <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full" onClick={() => fileInputRef.current?.click()}>
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-semibold">{name}</h3>
                    <p className="text-muted-foreground">{email}</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      {userData.isAdmin && (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        Active Member
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Joined {userData.joinDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span>Last login: {userData.lastLogin}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">{stats.currentStreak} month streak</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            {!userData.isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">This Month Progress</span>
                    <span className="text-sm font-medium">{progressPercentage}%</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        ₹{(stats.totalDeposits / 1000).toFixed(1)}K
                      </div>
                      <div className="text-xs text-muted-foreground">Total Deposits</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        ₹{(stats.totalExpenses / 1000).toFixed(1)}K
                      </div>
                      <div className="text-xs text-muted-foreground">Total Expenses</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="personal" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 h-auto sm:grid-cols-4">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="statistics">Statistics</TabsTrigger>
                <TabsTrigger value="push">Push Status</TabsTrigger>
              </TabsList>

              {/* Personal Information */}
              <TabsContent value="personal" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          value={name}
                          onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setHasChanges(true); }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => { setPhone(e.target.value); setHasChanges(true); }}
                          placeholder="+91 98765 43210"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="monthlyTarget">Monthly Target (₹)</Label>
                        <Input
                          id="monthlyTarget"
                          type="number"
                          value={monthlyTarget}
                          onChange={(e) => { setMonthlyTarget(e.target.value); setHasChanges(true); }}
                          placeholder="1500"
                          min="0"
                          disabled={!userData.isAdmin}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="joinDate">Join Date</Label>
                        <Input
                          id="joinDate"
                          value={userData.joinDate}
                          disabled
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Settings */}
              <TabsContent value="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Security Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">Change Password</div>
                        <div className="text-sm text-muted-foreground">
                          Update your account password
                        </div>
                      </div>
                      <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">
                            <Key className="h-4 w-4 mr-2" />
                            Change Password
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Change Password</DialogTitle>
                            <DialogDescription>
                              Enter your current password and choose a new one.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="current-password">Current Password</Label>
                              <div className="relative">
                                <Input
                                  id="current-password"
                                  type={showPassword ? "text" : "password"}
                                  value={currentPassword}
                                  onChange={(e) => setCurrentPassword(e.target.value)}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0 h-full px-3"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new-password">New Password</Label>
                              <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="confirm-password">Confirm New Password</Label>
                              <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsChangePasswordOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleChangePassword}>
                              Update Password
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>


                  </CardContent>
                </Card>
              </TabsContent>

              {/* Recent Activity */}
              <TabsContent value="activity" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Recent Activity</CardTitle>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {activityLog.length > 0 ? (
                        activityLog.map((activity) => (
                          <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${activity.type === 'deposit' ? 'bg-green-100 text-green-600' :
                                activity.type === 'expense' ? 'bg-red-100 text-red-600' :
                                  'bg-orange-100 text-orange-600'
                                }`}>
                                {activity.type === 'deposit' ? <TrendingDown className="h-4 w-4" /> :
                                  activity.type === 'expense' ? <TrendingUp className="h-4 w-4" /> :
                                    <IndianRupee className="h-4 w-4" />}
                              </div>
                              <div>
                                <div className="font-medium capitalize">{activity.type}</div>
                                <div className="text-sm text-muted-foreground">{activity.description}</div>
                                <div className="text-xs text-muted-foreground">{activity.date}</div>
                              </div>
                            </div>
                            <div className={`font-bold ${activity.type === 'deposit' ? 'text-green-600' :
                              activity.type === 'expense' ? 'text-red-600' :
                                'text-orange-600'
                              }`}>
                              {activity.type === 'deposit' ? '+' : activity.type === 'reimbursement' ? '+' : '-'}₹{activity.amount}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          No recent activity in the last 30 days.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Statistics */}
              <TabsContent value="statistics" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Contribution Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Total Deposits</span>
                          <span className="font-medium">₹{stats.totalDeposits.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Total Expenses</span>
                          <span className="font-medium">₹{stats.totalExpenses.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Avg Monthly</span>
                          <span className="font-medium">₹{stats.avgMonthlyContribution.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Reimbursements</span>
                          <span className="font-medium">₹{stats.reimbursementsReceived.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Activity Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Months Active</span>
                          <span className="font-medium">{stats.monthsActive}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Current Streak</span>
                          <span className="font-medium text-green-600">{stats.currentStreak} months</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Member Since</span>
                          <span className="font-medium">{userData.joinDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Account Status</span>
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Push Notification Status */}
              <TabsContent value="push" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Push Notification Setup
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      {/* Status Indicators */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="p-4 border rounded-lg flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Permission</div>
                            <div className="text-lg font-bold">
                              {Notification.permission === 'granted' ? (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4" /> Granted
                                </span>
                              ) : Notification.permission === 'denied' ? (
                                <span className="text-red-600 flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4" /> Denied
                                </span>
                              ) : (
                                <span className="text-orange-600 flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4" /> Default
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border rounded-lg flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-muted-foreground">Server Registration</div>
                            <div className="text-lg font-bold">
                              {getPushRegistrationStatus(String(userData.id || (userData as any).uid)) ? (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle className="h-4 w-4" /> Active
                                </span>
                              ) : (
                                <span className="text-orange-600 flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4" /> Pending
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Diagnostic Info */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Why am I not getting notifications?</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                          <li><strong>iOS Support:</strong> You MUST add this app to your Home Screen to receive push notifications on iPhone.</li>
                          <li><strong>Permissions:</strong> Ensure you allowed notifications when prompted by your browser.</li>
                          <li><strong>PWA:</strong> Notifications work best when the app is installed as a PWA.</li>
                          <li><strong>DND:</strong> Check if "Do Not Disturb" or "Focus" mode is active on your device.</li>
                        </ul>
                      </div>

                      <div className="pt-4 flex gap-3">
                        <Button
                          className="flex-1"
                          onClick={async () => {
                            const userId = userData.id || (userData as any).uid;
                            if (!userId) return;

                            try {
                              const res = await fetch('/api/push/test', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                toast.success(data.message || "Test notification triggered!");
                                if (data.tokensFound === 0) {
                                   toast.warning("No tokens found. Try refreshing the page to re-register.");
                                }
                              } else {
                                toast.error(data.message || "Failed to trigger test notification");
                              }
                            } catch (e) {
                              toast.error("Network error while testing notifications");
                            }
                          }}
                        >
                          Send Test Notification
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => window.location.reload()}
                        >
                            Refresh Registration
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {hasChanges && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertCircle className="h-4 w-4" />
                You have unsaved changes
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setHasChanges(false)} className="flex-1 sm:flex-none">
                  Discard
                </Button>
                <Button onClick={saveUserChanges} className="flex-1 sm:flex-none" disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout >
  );
}
