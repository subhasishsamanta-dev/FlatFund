
const mockDeposits = [
    { id: 'd1', uid: 'user1', amount: 1000, date: '2024-01-01', type: 'deposit' }
];

const mockExpenses = [
    { id: 'e1', uid: 'user1', amount: 200, type: 'fund', date: '2024-01-02', status: 'confirmed' }, // Fund expense paid by user1
    { id: 'e2', uid: 'user1', amount: 300, type: 'self', date: '2024-01-03', status: 'confirmed' }, // Self expense by user1 (Deposit!)
    { id: 'e3', uid: 'user1', amount: 400, type: 'self', date: '2024-01-04', status: 'reimbursement_requested' }, // Reimb req (Ignore for now)
    { id: 'e4', uid: 'user1', amount: 500, type: 'self', date: '2024-01-05', status: 'reimbursed' }, // Already reimbursed (Ignore for Deposit)
    { id: 'e5', uid: 'user1', amount: 500, type: 'fund', date: '2024-01-06', status: 'confirmed' } // The fund expense created when e4 was approved
];

const user = { uid: 'user1', name: 'Test User', monthlyTarget: 1500 };
const activePeriodStart = '2023-01-01';

// Strict logic: ONLY self-expenses with status 'confirmed' count as contribution
function calculateMemberStats(user: any, deposits: any[], expenses: any[]) {
    const userDeposits = deposits.filter(d => d.uid === user.uid && d.date >= activePeriodStart);
    const userExpenses = expenses.filter(e => e.uid === user.uid && e.type === 'self' && e.status === 'confirmed' && e.date >= activePeriodStart);

    const depositedValue = userDeposits.reduce((s, d) => s + (d.amount || 0), 0);
    const selfSpentValue = userExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalContribution = depositedValue + selfSpentValue;

    let status = 'behind';
    if (totalContribution >= 1000) status = 'on-track';
    if (totalContribution >= 1500) status = 'ahead';

    return { depositedValue, selfSpentValue, totalContribution, status };
}

function calculateDashboardStats(deposits: any[], expenses: any[]) {
    const explicitDepositsPeriod = deposits.filter(d => d.date >= activePeriodStart).reduce((s, d) => s + (d.amount || 0), 0);
    const selfSpentPeriod = expenses
        .filter(e => e.type === 'self' && e.status === 'confirmed' && e.date >= activePeriodStart)
        .reduce((s, e) => s + (e.amount || 0), 0);

    const totalDeposited = explicitDepositsPeriod + selfSpentPeriod;

    // Total Spent = all 'fund' + all 'confirmed self'
    const fundSpent = expenses.filter(e => e.type === 'fund' && e.date >= activePeriodStart).reduce((s, e) => s + (e.amount || 0), 0);
    const totalSpent = fundSpent + selfSpentPeriod;

    return { totalDeposited, totalSpent };
}

console.log("Member Stats (Expected: totalContribution 1300, status on-track):", calculateMemberStats(user, mockDeposits, mockExpenses));
console.log("Dashboard Stats (Expected: totalDeposited 1300, totalSpent 2000):", calculateDashboardStats(mockDeposits, mockExpenses));
