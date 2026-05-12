import {
    ShoppingCart,
    Utensils,
    Zap,
    Wifi,
    Home,
    Receipt,
    Droplets,
    Flame,
    Car,
    Gift,
    Coffee,
    MoreHorizontal,
    Briefcase,
    Music,
    Heart,
    Plane,
    Monitor,
    Dumbbell
} from "lucide-react";

export const iconMap: Record<string, any> = {
    'ShoppingCart': ShoppingCart,
    'Utensils': Utensils,
    'Zap': Zap,
    'Wifi': Wifi,
    'Home': Home,
    'Receipt': Receipt,
    'Droplets': Droplets,
    'Flame': Flame,
    'Car': Car,
    'Gift': Gift,
    'Coffee': Coffee,
    'MoreHorizontal': MoreHorizontal,
    'Briefcase': Briefcase,
    'Music': Music,
    'Heart': Heart,
    'Plane': Plane,
    'Monitor': Monitor,
    'Dumbbell': Dumbbell
};

export const getCategoryIcon = (iconName: string) => {
    return iconMap[iconName] || Receipt;
};

export const availableIcons = Object.keys(iconMap);
