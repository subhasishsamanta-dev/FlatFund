import React, { useMemo } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Expense } from '@/hooks/useTransactions';
import { useAppState } from '@/state/AppState';
import { PieChart as PieChartIcon } from 'lucide-react';

interface SpendingBreakdownProps {
    expenses: Expense[];
    isLoading: boolean;
}

const COLORS = [
    '#0d9488', // Teal
    '#2563eb', // Blue
    '#7c3aed', // Violet
    '#db2777', // Pink
    '#ea580c', // Orange
    '#ca8a04', // Yellow
    '#16a34a', // Green
    '#ef4444', // Red
];

export const SpendingBreakdown: React.FC<SpendingBreakdownProps> = ({ expenses, isLoading }) => {
    const { settings } = useAppState();

    const data = useMemo(() => {
        if (!expenses.length) return [];

        const categoryMap: Record<string, number> = {};

        expenses.forEach(expense => {
            const category = expense.category || 'Other';
            categoryMap[category] = (categoryMap[category] || 0) + (expense.amount || 0);
        });

        return Object.entries(categoryMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [expenses]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background/95 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
                    <p className="font-bold text-sm">{payload[0].name}</p>
                    <p className="text-primary font-medium">₹{payload[0].value.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-muted-foreground">
                        {Math.round((payload[0].value / data.reduce((s, d) => s + d.value, 0)) * 100)}% of total
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="glass-card glass-card-hover overflow-hidden h-full">
            <CardHeader className="pb-0">
                <CardTitle className="text-base flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4" />
                    Spending Breakdown
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                {isLoading ? (
                    <div className="h-[250px] flex items-center justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-32 w-32 rounded-full border-8 border-muted border-t-primary animate-spin mb-4" />
                            <div className="h-4 w-24 bg-muted rounded" />
                        </div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="h-[250px] flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                        <PieChartIcon className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-sm font-medium">No expense data to analyze yet.</p>
                    </div>
                ) : (
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                            className="hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    verticalAlign="bottom"
                                    align="center"
                                    iconType="circle"
                                    wrapperStyle={{
                                        paddingTop: '20px',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
