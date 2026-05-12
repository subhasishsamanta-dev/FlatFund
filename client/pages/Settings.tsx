import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Settings as SettingsIcon,
  IndianRupee,
  Plus,
  Edit,
  Trash2,
  Save,
  Bell,
  Shield,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { useAppState } from "@/state/AppState";
import { availableIcons, getCategoryIcon } from "@/lib/icons";


export default function Settings() {
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const { settings, updateSettings } = useAppState();
  const [hasChanges, setHasChanges] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState('#10B981');
  const [newCategoryIcon, setNewCategoryIcon] = useState('Receipt');

  const updateSetting = (category: string, key: string, value: any) => {
    updateSettings({ [category]: { ...(settings as any)[category], [key]: value } });
    setHasChanges(true);
  };

  const saveSettings = () => {
    // settings are already updated in state; clear local change flag
    setHasChanges(false);
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const id = Date.now();
    const value = newCategoryName.trim().toLowerCase().replace(/\s+/g, '-');
    const category = {
      id,
      value,
      label: newCategoryName.trim(),
      icon: newCategoryIcon,
      color: newCategoryColor,
      isDefault: false,
    };
    const updated = [...(settings.categories || []), category];
    updateSettings({ categories: updated });
    setNewCategoryName("");
    setNewCategoryColor('#10B981');
    setNewCategoryIcon('Receipt');
    setIsAddCategoryDialogOpen(false);
  };

  const deleteCategory = (id: number) => {
    const updated = (settings.categories || []).filter((c: any) => c.id !== id);
    updateSettings({ categories: updated });
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure your Flat Fund application</p>
          </div>
          {hasChanges && (
            <Button onClick={saveSettings}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  General Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={settings.general.currency}
                      onValueChange={(value) => updateSetting('general', 'currency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">₹ Indian Rupee (INR)</SelectItem>
                        <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                        <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                        <SelectItem value="GBP">£ British Pound (GBP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={settings.general.timezone}
                      onValueChange={(value) => updateSetting('general', 'timezone', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select
                      value={settings.general.dateFormat}
                      onValueChange={(value) => updateSetting('general', 'dateFormat', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Monthly Target</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={settings.general.defaultTarget}
                        onChange={(e) => updateSetting('general', 'defaultTarget', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Low Fund Alert Threshold</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={settings.general.lowFundThreshold}
                        onChange={(e) => updateSetting('general', 'lowFundThreshold', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Alert when fund balance goes below this amount
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories */}
          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Expense Categories</CardTitle>
                <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Add New Category</DialogTitle>
                      <DialogDescription>
                        Create a new expense category for better organization.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="category-name">Category Name</Label>
                        <Input id="category-name" placeholder="Transportation" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Icon</Label>
                        <div className="grid grid-cols-6 gap-2 border rounded-md p-2 h-[120px] overflow-y-auto">
                          {availableIcons.map(iconName => {
                            const Icon = getCategoryIcon(iconName);
                            return (
                              <div
                                key={iconName}
                                className={`p-2 rounded-md cursor-pointer flex items-center justify-center hover:bg-muted ${newCategoryIcon === iconName ? 'bg-primary/20 ring-1 ring-primary' : ''}`}
                                onClick={() => setNewCategoryIcon(iconName)}
                                title={iconName}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Color</Label>
                        <div className="flex gap-2">
                          {['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#6B7280'].map((color) => (
                            <div
                              key={color}
                              className={`w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer ${newCategoryColor === color ? 'ring-2 ring-offset-2 ring-blue-400' : ''}`}
                              style={{ backgroundColor: color }}
                              onClick={() => setNewCategoryColor(color)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAddCategoryDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={addCategory}>
                        Add Category
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {(settings.categories || []).map((category: any, idx: number) => {
                    const Icon = getCategoryIcon(category.icon);

                    return (
                      <div key={category?.id ?? idx} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div
                            className="p-2 rounded-full"
                            style={{ backgroundColor: `${category?.color ?? '#000'}20`, color: category?.color ?? '#000' }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{category?.label ?? 'No categories yet'}</div>
                            {category?.isDefault && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteCategory(category.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Email Notifications</div>
                      <div className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.emailNotifications}
                      onCheckedChange={(checked) => updateSetting('notifications', 'emailNotifications', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Deposit Notifications</div>
                      <div className="text-sm text-muted-foreground">
                        Get notified when members make deposits
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.depositNotifications}
                      onCheckedChange={(checked) => updateSetting('notifications', 'depositNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Expense Notifications</div>
                      <div className="text-sm text-muted-foreground">
                        Get notified about new expenses
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.expenseNotifications}
                      onCheckedChange={(checked) => updateSetting('notifications', 'expenseNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Reimbursement Updates</div>
                      <div className="text-sm text-muted-foreground">
                        Get notified about reimbursement status changes
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.reimbursementNotifications}
                      onCheckedChange={(checked) => updateSetting('notifications', 'reimbursementNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Bill Reminders</div>
                      <div className="text-sm text-muted-foreground">
                        Get reminded about pending bill payments
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.billReminders}
                      onCheckedChange={(checked) => updateSetting('notifications', 'billReminders', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Month Close Notifications</div>
                      <div className="text-sm text-muted-foreground">
                        Get notified when months are closed
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.monthCloseNotifications}
                      onCheckedChange={(checked) => updateSetting('notifications', 'monthCloseNotifications', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies */}
          <TabsContent value="policies" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  App Policies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Allow Pending Spends</div>
                      <div className="text-sm text-muted-foreground">
                        Allow expenses when fund balance is insufficient
                      </div>
                    </div>
                    <Switch
                      checked={settings.policies.allowPendingSpends}
                      onCheckedChange={(checked) => updateSetting('policies', 'allowPendingSpends', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Require Receipts</div>
                      <div className="text-sm text-muted-foreground">
                        Make receipt upload mandatory for expenses
                      </div>
                    </div>
                    <Switch
                      checked={settings.policies.requireReceipts}
                      onCheckedChange={(checked) => updateSetting('policies', 'requireReceipts', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto-approve Reimbursements</div>
                      <div className="text-sm text-muted-foreground">
                        Automatically approve eligible reimbursement requests
                      </div>
                    </div>
                    <Switch
                      checked={settings.policies.autoApproveReimbursements}
                      onCheckedChange={(checked) => updateSetting('policies', 'autoApproveReimbursements', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Month Lock Window (days)</Label>
                    <Input
                      type="number"
                      value={settings.policies.lockWindow}
                      onChange={(e) => updateSetting('policies', 'lockWindow', parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                    <p className="text-sm text-muted-foreground">
                      Days after month end before automatic lock
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                  <div>
                    <div className="font-medium text-red-600">Reset All Data</div>
                    <div className="text-sm text-muted-foreground">
                      Permanently delete all transactions and reset the app
                    </div>
                  </div>
                  <Button variant="destructive">Reset App</Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                  <div>
                    <div className="font-medium text-red-600">Export Data</div>
                    <div className="text-sm text-muted-foreground">
                      Download a complete backup of your data
                    </div>
                  </div>
                  <Button variant="outline">Export Backup</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {hasChanges && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertCircle className="h-4 w-4" />
                You have unsaved changes
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setHasChanges(false)}>
                  Discard
                </Button>
                <Button onClick={saveSettings}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
