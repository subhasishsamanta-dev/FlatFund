import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    Home,
    PiggyBank,
    Receipt,
    Users,
    BarChart3,
    Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { haptics } from "@/lib/haptics";

const BottomNav = () => {
    const location = useLocation();
    const { userProfile } = useAuth();
    const isAdmin = userProfile?.role === 'admin';

    const navItems = [
        { href: "/", label: "Dashboard", icon: Home },
        { href: "/deposits", label: "Deposits", icon: PiggyBank },
        { href: "/expenses", label: "Expenses", icon: Receipt },
        { href: "/members", label: "Members", icon: Users },
        { href: "/bills", label: "Bills", icon: BarChart3 },
    ];

    // Add Admin option for admin users
    if (isAdmin) {
        navItems.push({ href: "/admin", label: "Admin", icon: Settings });
    }

    return (
        <nav className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-background/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-[24px] overflow-hidden">
            <div className="flex items-center justify-around h-16 px-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => haptics.light()}
                            className="relative flex flex-col items-center justify-center gap-1.5 px-2 py-2 min-w-0 flex-1 group"
                        >
                            {/* Rounded top border indicator for active item */}
                            {isActive && (
                                <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-b-full" />
                            )}

                            {/* Icon with glow effect when active */}
                            <div className={cn(
                                "relative transition-all duration-300",
                                isActive && "drop-shadow-[0_0_8px_hsl(var(--primary))]"
                            )}>
                                <Icon
                                    className={cn(
                                        "h-6 w-6 shrink-0 transition-all duration-300",
                                        isActive
                                            ? "text-primary scale-110"
                                            : "text-muted-foreground group-hover:text-foreground group-hover:scale-105"
                                    )}
                                />
                            </div>

                            {/* Label - only show for active item */}
                            {isActive && (
                                <span className="text-[10px] font-semibold leading-none text-primary animate-in fade-in slide-in-from-bottom-1 duration-200">
                                    {item.label}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
