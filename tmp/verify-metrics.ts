
import { calculateDashboardMetrics } from '../lib/dashboard-utils';

const mockProjects = [
    {
        id: 'p1',
        currentFee: 1000,
        status: 'Active',
        paymentStatus: 'Unpaid',
        services: [{ isRecurring: true }],
        site: { domainName: 'test1.com', partner: { id: 'part1', name: 'Partner 1' } },
        timeLogs: [{ durationSeconds: 3600 }], // 1 hour
        _count: { tasks: 5 },
        tasks: [{}, {}, {}, {}, {}]
    },
    {
        id: 'p2',
        currentFee: 500,
        status: 'Active',
        paymentStatus: 'Paid',
        services: [{ isRecurring: false }],
        site: { domainName: 'test2.com', partner: { id: 'part2', name: 'Partner 2' } },
        timeLogs: [],
        _count: { tasks: 2 },
        tasks: [{}, {}]
    }
];

const mockTimeLogs = {
    _sum: { durationSeconds: 3600 }
};

const metrics = calculateDashboardMetrics(
    mockProjects,
    mockTimeLogs,
    [],
    10, // totalActiveTasks
    50, // hourlyRate
    []  // settlementAuditLogs
);

console.log('--- Dashboard Metrics Verification ---');
console.log('Total Revenue:', metrics.totalRevenue); // Should be 1500
console.log('Formatted Revenue:', metrics.formattedRevenue);
console.log('All Time Unpaid:', metrics.allTimeUnpaidRevenue); // Should be 1000
console.log('Active Tasks:', metrics.totalActiveTasks); // Should be 10
console.log('Monthly Projects Count:', metrics.activeMonthlyProjectsCount); // Should be 1
console.log('One-Time Projects Count:', metrics.activeOneTimeProjectsCount); // Should be 1
console.log('Time Sink Alerts:', metrics.timeSinkAlerts.length);
console.log('Success!');
