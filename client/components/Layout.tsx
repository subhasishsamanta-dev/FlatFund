import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Settings,
  Users,
  Receipt,
  PiggyBank,
  BarChart3,
  Bell,
  User,
  LogOut
} from "lucide-react";
import { useAppState } from "@/state/AppState";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultAvatar } from "@/lib/avatar";
import BottomNav from "@/components/BottomNav";

import {
  useNotifications,
} from "@/lib/notifications";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
  { href: "/deposits", label: "Deposits", icon: PiggyBank },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/bills", label: "Shared Bills", icon: BarChart3 },
  { href: "/members", label: "Members", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];




export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { userProfile, logout } = useAuth(); // Use AuthContext

  // Notification Logic
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications(userProfile?.uid);

  // Update document title and app badge with unread count
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Flat Fund` : 'Flat Fund';

    // PWA app icon badge (Navigator Badge API)
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        (navigator as any).setAppBadge(unreadCount).catch(() => { });
      } else {
        (navigator as any).clearAppBadge().catch(() => { });
      }
    }
  }, [unreadCount]);

  const { setUser, user } = useAppState();
  const userName = userProfile?.name || user?.name || 'Guest User';
  const userEmail = userProfile?.email || user?.email || '';
  const userInitials = (userName).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const isAdmin = userProfile?.role === 'admin';

  const navigate = useNavigate();

  const NavContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <nav className="space-y-2">
      {navItems.filter(i => !i.adminOnly || isAdmin).map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;

        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <PiggyBank className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold hidden sm:inline-block">FLAT FUND</span>
              <span className="text-lg font-bold sm:hidden truncate max-w-[100px]">FLAT FUND</span>
            </Link>
          </div>

          {/* Header right section */}
          <div className="flex flex-1 items-center justify-end gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none shadow-sm">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end">
                <div className="flex items-center justify-between p-2 font-medium border-b">
                  <span>Notifications</span>
                  <div className="flex gap-1">
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700">Read all</Button>
                    )}
                    {notifications.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">Clear</Button>
                    )}
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <DropdownMenuItem key={n.id} className={cn("flex flex-col items-start gap-1 p-3 cursor-pointer", !n.read && "bg-muted/50")} onClick={() => markAsRead(n.id)}>
                        <div className="font-semibold text-sm">{n.title}</div>
                        <div className="text-xs text-muted-foreground">{n.message}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</div>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 overflow-hidden">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={
                      (userProfile?.avatar || user?.avatar) &&
                        (String(userProfile?.avatar || user?.avatar).startsWith('data:') ||
                          String(userProfile?.avatar || user?.avatar).startsWith('/') ||
                          String(userProfile?.avatar || user?.avatar).startsWith('http'))
                        ? (userProfile?.avatar || user?.avatar)
                        : getDefaultAvatar(userName)
                    } />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{userName}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {userEmail}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={() => { logout(); navigate('/login'); }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex h-[calc(100vh-3.5rem)] w-64 flex-col border-r bg-card">
          <div className="p-6">
            <NavContent />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto overflow-x-hidden pb-0 md:pb-0">
          <div className="pb-24 md:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <BottomNav />
    </div>
  );
}
