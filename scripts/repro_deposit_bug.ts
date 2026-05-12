
const deposits = [
    { id: '1', uid: 'user1', amount: 500, date: '2026-01-05', status: 'confirmed' }
];

const expenses = [
    { id: 'e1', uid: 'user1', amount: 200, date: '2026-01-05', type: 'self', status: 'confirmed' }
];

// Case A: activePeriodStart is today
let activePeriodStart = '2026-01-05';
console.log("--- Case A: activePeriodStart is 2026-01-05 (Today) ---");
let filteredDeposits = deposits.filter(d => d.date >= activePeriodStart);
let filteredExpenses = expenses.filter(e => e.type === 'self' && e.status === 'confirmed' && e.date >= activePeriodStart);
console.log("Filtered Deposits Count:", filteredDeposits.length);
console.log("Filtered Expenses Count:", filteredExpenses.length);
console.log("Total Deposited:", filteredDeposits.reduce((s, d) => s + d.amount, 0) + filteredExpenses.reduce((s, e) => s + e.amount, 0));

// Case B: activePeriodStart is tomorrow (Bug case)
activePeriodStart = '2026-01-06';
console.log("\n--- Case B: activePeriodStart is 2026-01-06 (Tomorrow) ---");
filteredDeposits = deposits.filter(d => d.date >= activePeriodStart);
filteredExpenses = expenses.filter(e => e.type === 'self' && e.status === 'confirmed' && e.date >= activePeriodStart);
console.log("Filtered Deposits Count:", filteredDeposits.length);
console.log("Filtered Expenses Count:", filteredExpenses.length);
console.log("Total Deposited:", filteredDeposits.reduce((s, d) => s + d.amount, 0) + filteredExpenses.reduce((s, e) => s + e.amount, 0));
