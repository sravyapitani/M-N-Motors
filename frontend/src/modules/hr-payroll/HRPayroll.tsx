
import { useMemo, useState } from 'react';

import './HRPayroll.css';

type HRSection =
    | 'Employees'
    | 'Vacancies'
    | 'Hiring Pipeline'
    | 'Onboarding'
    | 'On-Roll & Daily Wages'
    | 'Payroll Runs'
    | 'Leave'
    | 'Attendance'
    | 'Incentives & Commissions';

type Employee = {
    id: number;
    name: string;
    role: string;
    department: string;
    branch: string;
    type: string;
    attendance: number;
    targets: number;
    status: string;
};

type Vacancy = {
    id: number;
    position: string;
    department: string;
    branch: string;
    openings: number;
    filled: number;
    type: string;
    status: string;
};

const sections: { label: HRSection; icon: string }[] = [
    { label: 'Employees', icon: '👨‍💼' },
    { label: 'Vacancies', icon: '📋' },
    { label: 'Hiring Pipeline', icon: '🕒' },
    { label: 'Onboarding', icon: '🚀' },
    { label: 'On-Roll & Daily Wages', icon: '💵' },
    { label: 'Payroll Runs', icon: '🧮' },
    { label: 'Leave', icon: '🌴' },
    { label: 'Attendance', icon: '🕘' },
    { label: 'Incentives & Commissions', icon: '🏆' },
];

const employees: Employee[] = [
    { id: 1, name: 'Manish Sheikh', role: 'Branch Manager', department: 'Executive', branch: 'Whitefield', type: 'On-Roll', attendance: 88, targets: 108, status: 'Active' },
    { id: 2, name: 'Ayesha Subramaniam', role: 'Sales Manager', department: 'Sales', branch: 'Whitefield', type: 'On-Roll', attendance: 94, targets: 115, status: 'Active' },
    { id: 3, name: 'Sunita Deshmukh', role: 'Sales Executive', department: 'Sales', branch: 'Whitefield', type: 'On-Roll', attendance: 89, targets: 61, status: 'Active' },
    { id: 4, name: 'Rajeev Subramaniam', role: 'Sales Executive', department: 'Sales', branch: 'Whitefield', type: 'On-Roll', attendance: 97, targets: 84, status: 'Active' },
    { id: 5, name: 'Riya Chawla', role: 'Sales Executive', department: 'Sales', branch: 'Whitefield', type: 'On-Roll', attendance: 86, targets: 80, status: 'Active' },
    { id: 6, name: 'Ritika Patil', role: 'Sales Executive', department: 'Sales', branch: 'Whitefield', type: 'On-Roll', attendance: 92, targets: 60, status: 'Active' },
    { id: 7, name: 'Ritika Patil', role: 'CRM Executive', department: 'Sales', branch: 'Whitefield', type: 'On-Roll', attendance: 85, targets: 62, status: 'Active' },
    { id: 8, name: 'Neha Sheikh', role: 'Finance Manager', department: 'Finance', branch: 'Whitefield', type: 'On-Roll', attendance: 90, targets: 109, status: 'Active' },
    { id: 9, name: 'Vikram Subramaniam', role: 'Accounts Executive', department: 'Finance', branch: 'Whitefield', type: 'On-Roll', attendance: 92, targets: 118, status: 'Active' },
    { id: 10, name: 'Aarav Chawla', role: 'Service Manager', department: 'Service', branch: 'Whitefield', type: 'On-Roll', attendance: 84, targets: 62, status: 'Active' },
    { id: 11, name: 'Priya Nair', role: 'Parts Executive', department: 'Parts', branch: 'Sector 18', type: 'On-Roll', attendance: 91, targets: 95, status: 'Active' },
    { id: 12, name: 'Karan Mehta', role: 'HR Executive', department: 'HR', branch: 'Vashi', type: 'Contract', attendance: 88, targets: 76, status: 'Active' },
    { id: 13, name: 'Sneha Kulkarni', role: 'Service Advisor', department: 'Service', branch: 'Gachibowli', type: 'On-Roll', attendance: 96, targets: 102, status: 'Active' },
    { id: 14, name: 'Rahul Verma', role: 'Operations Executive', department: 'Ops', branch: 'Sector 18', type: 'On-Roll', attendance: 87, targets: 89, status: 'Active' },
    { id: 15, name: 'Anjali Rao', role: 'Accounts Executive', department: 'Finance', branch: 'Vashi', type: 'Contract', attendance: 79, targets: 70, status: 'Inactive' },
];

const vacancies: Vacancy[] = [
    { id: 1, position: 'Accounts Executive', department: 'Finance', branch: 'Sector 18', openings: 2, filled: 0, type: 'On-Roll', status: 'Open' },
    { id: 2, position: 'Technician', department: 'Service', branch: 'Sector 18', openings: 4, filled: 3, type: 'On-Roll', status: 'On Hold' },
    { id: 3, position: 'Parts Executive', department: 'Parts', branch: 'Whitefield', openings: 2, filled: 0, type: 'On-Roll', status: 'Open' },
    { id: 4, position: 'Branch Manager', department: 'Executive', branch: 'Sector 18', openings: 4, filled: 0, type: 'Contract', status: 'Open' },
    { id: 5, position: 'Sales Executive', department: 'Sales', branch: 'Vashi', openings: 1, filled: 1, type: 'On-Roll', status: 'Filled' },
    { id: 6, position: 'Service Advisor', department: 'Service', branch: 'Vashi', openings: 4, filled: 3, type: 'On-Roll', status: 'On Hold' },
    { id: 7, position: 'Service Advisor', department: 'Service', branch: 'Whitefield', openings: 1, filled: 0, type: 'On-Roll', status: 'Open' },
    { id: 8, position: 'HR Executive', department: 'HR', branch: 'Sector 18', openings: 1, filled: 1, type: 'On-Roll', status: 'Filled' },
    { id: 9, position: 'Accounts Executive', department: 'Finance', branch: 'Gachibowli', openings: 2, filled: 0, type: 'Contract', status: 'Open' },
    { id: 10, position: 'Service Advisor', department: 'Service', branch: 'Gachibowli', openings: 1, filled: 1, type: 'Contract', status: 'Filled' },
];

const departments = [
    { name: 'Executive', count: 5 },
    { name: 'Sales', count: 40 },
    { name: 'Finance', count: 10 },
    { name: 'Service', count: 40 },
    { name: 'Parts', count: 10 },
    { name: 'HR', count: 5 },
    { name: 'Ops', count: 20 },
];

const vacancyDepartments = [
    { name: 'Finance', count: 8 },
    { name: 'Service', count: 17 },
    { name: 'Parts', count: 2 },
    { name: 'Executive', count: 4 },
    { name: 'Sales', count: 4 },
    { name: 'HR', count: 5 },
];

type PayslipRecord = {
    id: number;
    name: string;
    role: string;
    branch: string;
    gross: number;
    deductions: number;
    netPay: number;
};

const payrollRecords: PayslipRecord[] = [
    // PAGE 1 — WHITEFIELD
    { id: 1, name: 'Manish Sheikh', role: 'Branch Manager', branch: 'Whitefield', gross: 84167, deductions: 8617, netPay: 75550 },
    { id: 2, name: 'Ayesha Subramaniam', role: 'Sales Manager', branch: 'Whitefield', gross: 115000, deductions: 16300, netPay: 98700 },
    { id: 3, name: 'Sunita Deshmukh', role: 'Sales Executive', branch: 'Whitefield', gross: 32500, deductions: 2150, netPay: 30350 },
    { id: 4, name: 'Rajeev Subramaniam', role: 'Sales Executive', branch: 'Whitefield', gross: 66667, deductions: 6867, netPay: 59800 },
    { id: 5, name: 'Riya Chawla', role: 'Sales Executive', branch: 'Whitefield', gross: 110000, deductions: 15600, netPay: 94400 },
    { id: 6, name: 'Ritika Patil', role: 'Sales Executive', branch: 'Whitefield', gross: 56667, deductions: 3600, netPay: 53067 },
    { id: 7, name: 'Ritika Patil', role: 'CRM Executive', branch: 'Whitefield', gross: 53333, deductions: 3400, netPay: 49933 },
    { id: 8, name: 'Neha Sheikh', role: 'Finance Manager', branch: 'Whitefield', gross: 25000, deductions: 1700, netPay: 23300 },
    { id: 9, name: 'Vikram Subramaniam', role: 'Accounts Executive', branch: 'Whitefield', gross: 48333, deductions: 3100, netPay: 45233 },
    { id: 10, name: 'Aarav Chawla', role: 'Service Manager', branch: 'Whitefield', gross: 66667, deductions: 6867, netPay: 59800 },

    // PAGE 2 — WHITEFIELD
    { id: 11, name: 'Sameer Kulkarni', role: 'Service Advisor', branch: 'Whitefield', gross: 82500, deductions: 8450, netPay: 74050 },
    { id: 12, name: 'Ayesha Sharma', role: 'Service Advisor', branch: 'Whitefield', gross: 120000, deductions: 17000, netPay: 103000 },
    { id: 13, name: 'Dev Sheikh', role: 'Technician', branch: 'Whitefield', gross: 81667, deductions: 8367, netPay: 73300 },
    { id: 14, name: 'Arjun Joshi', role: 'Technician', branch: 'Whitefield', gross: 118333, deductions: 16767, netPay: 101566 },
    { id: 15, name: 'Anjali Rao', role: 'Technician', branch: 'Whitefield', gross: 77500, deductions: 7950, netPay: 69550 },
    { id: 16, name: 'Imran Mehta', role: 'Parts Manager', branch: 'Whitefield', gross: 49167, deductions: 3150, netPay: 46017 },
    { id: 17, name: 'Meera Verma', role: 'Parts Executive', branch: 'Whitefield', gross: 75833, deductions: 7783, netPay: 68050 },
    { id: 18, name: 'Arjun Khan', role: 'Warranty Executive', branch: 'Whitefield', gross: 86667, deductions: 8867, netPay: 77800 },
    { id: 19, name: 'Meera Joshi', role: 'Insurance Executive', branch: 'Whitefield', gross: 120000, deductions: 17000, netPay: 103000 },
    { id: 20, name: 'Sameer Sharma', role: 'Finance / Lending Executive', branch: 'Whitefield', gross: 59167, deductions: 3750, netPay: 55417 },

    // PAGE 3 — GACHIBOWLI
    { id: 21, name: 'Lakshmi Chawla', role: 'HR Executive', branch: 'Whitefield', gross: 85000, deductions: 8700, netPay: 76300 },
    { id: 22, name: 'Suresh Iyer', role: 'Sales Manager', branch: 'Gachibowli', gross: 115833, deductions: 16417, netPay: 99416 },
    { id: 23, name: 'Pooja Bose', role: 'Sales Executive', branch: 'Gachibowli', gross: 57500, deductions: 3650, netPay: 53850 },
    { id: 24, name: 'Vivaan Sheikh', role: 'Sales Executive', branch: 'Gachibowli', gross: 23333, deductions: 1600, netPay: 21733 },
    { id: 25, name: 'Karthik Mehta', role: 'Sales Executive', branch: 'Gachibowli', gross: 30833, deductions: 2050, netPay: 28783 },
    { id: 26, name: 'Nikhil Menon', role: 'Sales Executive', branch: 'Gachibowli', gross: 82500, deductions: 8450, netPay: 74050 },
    { id: 27, name: 'Anjali Rao', role: 'CRM Executive', branch: 'Gachibowli', gross: 113333, deductions: 16067, netPay: 97266 },
    { id: 28, name: 'Arjun Menon', role: 'Finance Manager', branch: 'Gachibowli', gross: 75833, deductions: 7783, netPay: 68050 },
    { id: 29, name: 'Lakshmi Rao', role: 'Accounts Executive', branch: 'Gachibowli', gross: 50833, deductions: 3250, netPay: 47583 },
    { id: 30, name: 'Deepa Verma', role: 'Service Manager', branch: 'Gachibowli', gross: 76667, deductions: 7867, netPay: 68800 },

    // PAGE 4 — GACHIBOWLI / VASHI
    { id: 31, name: 'Aditya Sharma', role: 'Service Advisor', branch: 'Gachibowli', gross: 97500, deductions: 9950, netPay: 87550 },
    { id: 32, name: 'Ayesha Nair', role: 'Service Advisor', branch: 'Gachibowli', gross: 78333, deductions: 8033, netPay: 70300 },
    { id: 33, name: 'Ayesha Gupta', role: 'Parts Manager', branch: 'Gachibowli', gross: 97500, deductions: 9950, netPay: 87550 },
    { id: 34, name: 'Ayesha Sharma', role: 'Parts Executive', branch: 'Gachibowli', gross: 25000, deductions: 1700, netPay: 23300 },
    { id: 35, name: 'Nikhil Bose', role: 'Warranty Executive', branch: 'Gachibowli', gross: 57500, deductions: 3650, netPay: 53850 },
    { id: 36, name: 'Kabir Kapoor', role: 'Insurance Executive', branch: 'Gachibowli', gross: 98333, deductions: 10033, netPay: 88300 },
    { id: 37, name: 'Divya Mehta', role: 'Finance / Lending Executive', branch: 'Gachibowli', gross: 95000, deductions: 9700, netPay: 85300 },
    { id: 38, name: 'Imran Patil', role: 'HR Executive', branch: 'Gachibowli', gross: 95833, deductions: 9783, netPay: 86050 },
    { id: 39, name: 'Sanya Verma', role: 'Procurement Manager', branch: 'Gachibowli', gross: 63333, deductions: 6533, netPay: 56800 },
    { id: 40, name: 'Riya Bose', role: 'Branch Manager', branch: 'Vashi', gross: 47500, deductions: 3050, netPay: 44450 },

    // PAGE 5 — VASHI
    { id: 41, name: 'Deepa Gupta', role: 'Sales Manager', branch: 'Vashi', gross: 117500, deductions: 16650, netPay: 100850 },
    { id: 42, name: 'Divya Deshmukh', role: 'Sales Executive', branch: 'Vashi', gross: 60000, deductions: 3800, netPay: 56200 },
    { id: 43, name: 'Meera Patil', role: 'Sales Executive', branch: 'Vashi', gross: 73333, deductions: 7533, netPay: 65800 },
    { id: 44, name: 'Ayesha Menon', role: 'Sales Executive', branch: 'Vashi', gross: 28333, deductions: 1900, netPay: 26433 },
    { id: 45, name: 'Sunita Menon', role: 'Sales Executive', branch: 'Vashi', gross: 60000, deductions: 3800, netPay: 56200 },
    { id: 46, name: 'Imran Reddy', role: 'CRM Executive', branch: 'Vashi', gross: 120833, deductions: 17117, netPay: 103716 },
    { id: 47, name: 'Divya Reddy', role: 'Finance Manager', branch: 'Vashi', gross: 25833, deductions: 1750, netPay: 24083 },
    { id: 48, name: 'Aarav Nair', role: 'Accounts Executive', branch: 'Vashi', gross: 45000, deductions: 2900, netPay: 42100 },
    { id: 49, name: 'Karthik Iyer', role: 'Service Manager', branch: 'Vashi', gross: 27500, deductions: 1850, netPay: 25650 },
    { id: 50, name: 'Dev Gupta', role: 'Service Advisor', branch: 'Vashi', gross: 24167, deductions: 1650, netPay: 22517 },

    // PAGE 6 — VASHI
    { id: 51, name: 'Vikram Gupta', role: 'Service Advisor', branch: 'Vashi', gross: 74167, deductions: 7617, netPay: 66550 },
    { id: 52, name: 'Dev Verma', role: 'Technician', branch: 'Vashi', gross: 75000, deductions: 7700, netPay: 67300 },
    { id: 53, name: 'Neha Kapoor', role: 'Technician', branch: 'Vashi', gross: 114167, deductions: 16183, netPay: 97984 },
    { id: 54, name: 'Farhan Deshmukh', role: 'Technician', branch: 'Vashi', gross: 45000, deductions: 2900, netPay: 42100 },
    { id: 55, name: 'Ramesh Kulkarni', role: 'Parts Manager', branch: 'Vashi', gross: 120000, deductions: 17000, netPay: 103000 },
    { id: 56, name: 'Riya Chawla', role: 'Parts Executive', branch: 'Vashi', gross: 69167, deductions: 7117, netPay: 62050 },
    { id: 57, name: 'Manish Chawla', role: 'Insurance Executive', branch: 'Vashi', gross: 43333, deductions: 2800, netPay: 40533 },
    { id: 58, name: 'Riya Nair', role: 'Finance / Lending Executive', branch: 'Vashi', gross: 72500, deductions: 7450, netPay: 65050 },
    { id: 59, name: 'Pooja Rao', role: 'HR Executive', branch: 'Vashi', gross: 99167, deductions: 10117, netPay: 89050 },
    { id: 60, name: 'Arjun Verma', role: 'Procurement Manager', branch: 'Vashi', gross: 119167, deductions: 16883, netPay: 102284 },

    // PAGE 7 — ANNA NAGAR
    { id: 61, name: 'Sanya Khan', role: 'Branch Manager', branch: 'Anna Nagar', gross: 82500, deductions: 8450, netPay: 74050 },
    { id: 62, name: 'Nikhil Kapoor', role: 'Sales Manager', branch: 'Anna Nagar', gross: 85833, deductions: 8783, netPay: 77050 },
    { id: 63, name: 'Arjun Gupta', role: 'Sales Executive', branch: 'Anna Nagar', gross: 63333, deductions: 6533, netPay: 56800 },
    { id: 64, name: 'Ananya Iyer', role: 'Sales Executive', branch: 'Anna Nagar', gross: 69167, deductions: 7117, netPay: 62050 },
    { id: 65, name: 'Dev Khan', role: 'Sales Executive', branch: 'Anna Nagar', gross: 80000, deductions: 8200, netPay: 71800 },
    { id: 66, name: 'Vivaan Rao', role: 'Sales Executive', branch: 'Anna Nagar', gross: 60833, deductions: 6283, netPay: 54550 },
    { id: 67, name: 'Ayesha Subramaniam', role: 'CRM Executive', branch: 'Anna Nagar', gross: 30833, deductions: 2050, netPay: 28783 },
    { id: 68, name: 'Deepa Reddy', role: 'Finance Manager', branch: 'Anna Nagar', gross: 113333, deductions: 16067, netPay: 97266 },
    { id: 69, name: 'Sanya Joshi', role: 'Accounts Executive', branch: 'Anna Nagar', gross: 68333, deductions: 7033, netPay: 61300 },
    { id: 70, name: 'Farhan Subramaniam', role: 'Service Manager', branch: 'Anna Nagar', gross: 97500, deductions: 9950, netPay: 87550 },

    // PAGE 8 — ANNA NAGAR
    { id: 71, name: 'Riya Verma', role: 'Service Advisor', branch: 'Anna Nagar', gross: 58333, deductions: 3700, netPay: 54633 },
    { id: 72, name: 'Ishaan Bose', role: 'Service Advisor', branch: 'Anna Nagar', gross: 115833, deductions: 16417, netPay: 99416 },
    { id: 73, name: 'Farhan Sheikh', role: 'Technician', branch: 'Anna Nagar', gross: 76667, deductions: 7867, netPay: 68800 },
    { id: 74, name: 'Ananya Reddy', role: 'Technician', branch: 'Anna Nagar', gross: 36667, deductions: 2400, netPay: 34267 },
    { id: 75, name: 'Sanya Sheikh', role: 'Technician', branch: 'Anna Nagar', gross: 67500, deductions: 6950, netPay: 60550 },
    { id: 76, name: 'Ishaan Kulkarni', role: 'Parts Manager', branch: 'Anna Nagar', gross: 55000, deductions: 3500, netPay: 51500 },
    { id: 77, name: 'Aarav Gupta', role: 'Parts Executive', branch: 'Anna Nagar', gross: 65000, deductions: 6700, netPay: 58300 },
    { id: 78, name: 'Aarav Kulkarni', role: 'Warranty Executive', branch: 'Anna Nagar', gross: 95000, deductions: 9700, netPay: 85300 },
    { id: 79, name: 'Zoya Sheikh', role: 'Insurance Executive', branch: 'Anna Nagar', gross: 64167, deductions: 6617, netPay: 57550 },
    { id: 80, name: 'Ayesha Deshmukh', role: 'Finance / Lending Executive', branch: 'Anna Nagar', gross: 88333, deductions: 9033, netPay: 79300 },

    // PAGE 9 — ANNA NAGAR / SECTOR 18
    { id: 81, name: 'Lakshmi Kulkarni', role: 'HR Executive', branch: 'Anna Nagar', gross: 115833, deductions: 16417, netPay: 99416 },
    { id: 82, name: 'Karthik Reddy', role: 'Procurement Manager', branch: 'Anna Nagar', gross: 80000, deductions: 8200, netPay: 71800 },
    { id: 83, name: 'Nikhil Reddy', role: 'Branch Manager', branch: 'Sector 18', gross: 113333, deductions: 16067, netPay: 97266 },
    { id: 84, name: 'Kabir Joshi', role: 'Sales Manager', branch: 'Sector 18', gross: 110000, deductions: 15600, netPay: 94400 },
    { id: 85, name: 'Sameer Sheikh', role: 'Sales Executive', branch: 'Sector 18', gross: 101667, deductions: 14433, netPay: 87234 },
    { id: 86, name: 'Rohan Sheikh', role: 'Sales Executive', branch: 'Sector 18', gross: 33333, deductions: 2200, netPay: 31133 },
    { id: 87, name: 'Manish Kapoor', role: 'Sales Executive', branch: 'Sector 18', gross: 95833, deductions: 9783, netPay: 86050 },
    { id: 88, name: 'Anjali Joshi', role: 'Sales Executive', branch: 'Sector 18', gross: 60000, deductions: 3800, netPay: 56200 },
    { id: 89, name: 'Sunita Reddy', role: 'CRM Executive', branch: 'Sector 18', gross: 54167, deductions: 3450, netPay: 50717 },
    { id: 90, name: 'Neha Joshi', role: 'Finance Manager', branch: 'Sector 18', gross: 65000, deductions: 6700, netPay: 58300 },

    // PAGE 10 — SECTOR 18
    { id: 91, name: 'Sanya Mehta', role: 'Accounts Executive', branch: 'Sector 18', gross: 113333, deductions: 16067, netPay: 97266 },
    { id: 92, name: 'Dev Sharma', role: 'Service Manager', branch: 'Sector 18', gross: 46667, deductions: 3000, netPay: 43667 },
    { id: 93, name: 'Ritika Deshmukh', role: 'Service Advisor', branch: 'Sector 18', gross: 25833, deductions: 1750, netPay: 24083 },
    { id: 94, name: 'Pooja Deshmukh', role: 'Technician', branch: 'Sector 18', gross: 56667, deductions: 3600, netPay: 53067 },
    { id: 95, name: 'Pooja Joshi', role: 'Technician', branch: 'Sector 18', gross: 46667, deductions: 3000, netPay: 43667 },
    { id: 96, name: 'Ananya Sharma', role: 'Technician', branch: 'Sector 18', gross: 81667, deductions: 8367, netPay: 73300 },
    { id: 97, name: 'Isha Deshmukh', role: 'Technician', branch: 'Sector 18', gross: 41667, deductions: 2700, netPay: 38967 },
    { id: 98, name: 'Isha Iyer', role: 'Technician', branch: 'Sector 18', gross: 62500, deductions: 6450, netPay: 56050 },
    { id: 99, name: 'Imran Rao', role: 'Parts Manager', branch: 'Sector 18', gross: 94167, deductions: 9617, netPay: 84550 },
    { id: 100, name: 'Ritika Sen', role: 'Parts Executive', branch: 'Sector 18', gross: 30833, deductions: 2050, netPay: 28783 },

    // PAGE 11 — SECTOR 18
    { id: 101, name: 'Divya Sheikh', role: 'Warranty Executive', branch: 'Sector 18', gross: 46667, deductions: 3000, netPay: 43667 },
    { id: 102, name: 'Priya Subramaniam', role: 'Insurance Executive', branch: 'Sector 18', gross: 85833, deductions: 8783, netPay: 77050 },
    { id: 103, name: 'Suresh Sharma', role: 'Finance / Lending Executive', branch: 'Sector 18', gross: 78333, deductions: 8033, netPay: 70300 },
    { id: 104, name: 'Arjun Sharma', role: 'HR Executive', branch: 'Sector 18', gross: 120000, deductions: 17000, netPay: 103000 },
    { id: 105, name: 'Vikram Deshmukh', role: 'Procurement Manager', branch: 'Sector 18', gross: 60833, deductions: 6283, netPay: 54550 },
];


type IncentiveRecord = {
    id: number;
    employee: string;
    branch: string;
    type: 'Sales Incentive' | 'Finance Commission';
    basis: string;
    amount: number;
    date: string;
    status: 'Credited' | 'Pending Payout';
};

const incentiveRecords: IncentiveRecord[] = [
    { id: 1, employee: 'Sameer Sheikh', branch: 'Vashi', type: 'Sales Incentive', basis: 'Vehicle delivery – Orbis Auto Haul', amount: 4585, date: '24 Aug', status: 'Credited' },
    { id: 2, employee: 'Divya Mehta', branch: 'Gachibowli', type: 'Finance Commission', basis: 'Loan disbursed via Kisan Rural Finance', amount: 18131, date: '23 Aug', status: 'Credited' },
    { id: 3, employee: 'Sameer Sharma', branch: 'Whitefield', type: 'Finance Commission', basis: 'Loan disbursed via Vertex Capital', amount: 21886, date: '18 Aug', status: 'Credited' },
    { id: 4, employee: 'Suresh Sharma', branch: 'Sector 18', type: 'Finance Commission', basis: 'Loan disbursed via Vertex Capital', amount: 7344, date: '14 Aug', status: 'Credited' },
    { id: 5, employee: 'Ayesha Deshmukh', branch: 'Anna Nagar', type: 'Finance Commission', basis: 'Loan disbursed via Kisan Rural Finance', amount: 17512, date: '10 Aug', status: 'Credited' },
    { id: 6, employee: 'Anjali Joshi', branch: 'Anna Nagar', type: 'Sales Incentive', basis: 'Vehicle delivery – TriNova Cargo', amount: 1578, date: '06 Aug', status: 'Credited' },
    { id: 7, employee: 'Divya Mehta', branch: 'Gachibowli', type: 'Finance Commission', basis: 'Loan disbursed via BlueLeaf Finance', amount: 3606, date: '04 Aug', status: 'Credited' },
    { id: 8, employee: 'Dev Khan', branch: 'Anna Nagar', type: 'Sales Incentive', basis: 'Vehicle delivery – Velocia Motors Voyage', amount: 5177, date: '29 Jul', status: 'Pending Payout' },
    { id: 9, employee: 'Sunita Menon', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery – TriNova Eco', amount: 2717, date: '28 Jul', status: 'Credited' },
    { id: 10, employee: 'Nikhil Menon', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery – Velocia Motors Voyage', amount: 4622, date: '25 Jul', status: 'Credited' },
    { id: 11, employee: 'Ritika Patil', branch: 'Anna Nagar', type: 'Sales Incentive', basis: 'Vehicle delivery – TriNova Eco', amount: 2567, date: '22 Jul', status: 'Credited' },
    { id: 12, employee: 'Sunita Deshmukh', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery – Orbis Auto Crest', amount: 16528, date: '21 Jul', status: 'Credited' },

    // PAGE 2
    { id: 13, employee: 'Sameer Sheikh', branch: 'Sector 18', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Spark', amount: 4680, date: '18 Jul', status: 'Pending Payout' },
    { id: 14, employee: 'Divya Mehta', branch: 'Gachibowli', type: 'Finance Commission', basis: 'Loan disbursed via Vertex Capital', amount: 16645, date: '16 Jul', status: 'Credited' },
    { id: 15, employee: 'Ayesha Menon', branch: 'Gachibowli', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Haul', amount: 9840, date: '15 Jul', status: 'Credited' },
    { id: 16, employee: 'Ayesha Deshmukh', branch: 'Anna Nagar', type: 'Finance Commission', basis: 'Loan disbursed via Suraksha NBFC', amount: 14227, date: '07 Jul', status: 'Credited' },
    { id: 17, employee: 'Divya Deshmukh', branch: 'Sector 18', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Terra', amount: 7765, date: '05 Jul', status: 'Credited' },
    { id: 18, employee: 'Pooja Bose', branch: 'Sector 18', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Spark', amount: 6230, date: '05 Jul', status: 'Credited' },
    { id: 19, employee: 'Suresh Sharma', branch: 'Sector 18', type: 'Finance Commission', basis: 'Loan disbursed via Nationwide Bank Auto Loans', amount: 11700, date: '03 Jul', status: 'Credited' },
    { id: 20, employee: 'Ayesha Deshmukh', branch: 'Anna Nagar', type: 'Finance Commission', basis: 'Loan disbursed via Suraksha NBFC', amount: 3281, date: '28 Jun', status: 'Credited' },
    { id: 21, employee: 'Suresh Sharma', branch: 'Sector 18', type: 'Finance Commission', basis: 'Loan disbursed via Vertex Capital', amount: 11007, date: '25 Jun', status: 'Credited' },
    { id: 22, employee: 'Nikhil Menon', branch: 'Gachibowli', type: 'Sales Incentive', basis: 'Vehicle delivery — TriNova Cargo', amount: 3018, date: '24 Jun', status: 'Credited' },
    { id: 23, employee: 'Ritika Patil', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Voyage', amount: 5425, date: '17 Jun', status: 'Credited' },
    { id: 24, employee: 'Ayesha Menon', branch: 'Gachibowli', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Spark', amount: 4335, date: '09 Jun', status: 'Credited' },

    // PAGE 3
    { id: 25, employee: 'Ritika Patil', branch: 'Sector 18', type: 'Sales Incentive', basis: 'Vehicle delivery — TriNova Eco', amount: 2408, date: '07 Jun', status: 'Credited' },
    { id: 26, employee: 'Anjali Joshi', branch: 'Sector 18', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Haul', amount: 6480, date: '04 Jun', status: 'Credited' },
    { id: 27, employee: 'Ritika Patil', branch: 'Sector 18', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Crest', amount: 18737, date: '02 Jun', status: 'Credited' },
    { id: 28, employee: 'Nikhil Menon', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — TriNova Eco', amount: 2699, date: '02 Jun', status: 'Credited' },
    { id: 29, employee: 'Karthik Mehta', branch: 'Vashi', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Haul', amount: 10527, date: '01 Jun', status: 'Credited' },
    { id: 30, employee: 'Arjun Gupta', branch: 'Vashi', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Haul', amount: 5169, date: '26 May', status: 'Credited' },
    { id: 31, employee: 'Dev Khan', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Crest', amount: 10683, date: '19 May', status: 'Credited' },
    { id: 32, employee: 'Rajeev Subramaniam', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Voyage', amount: 9985, date: '07 May', status: 'Credited' },
    { id: 33, employee: 'Vivaan Rao', branch: 'Vashi', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Crest', amount: 8477, date: '05 May', status: 'Credited' },
    { id: 34, employee: 'Arjun Gupta', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Voyage', amount: 10579, date: '03 May', status: 'Pending Payout' },
    { id: 35, employee: 'Nikhil Menon', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Voyage', amount: 10851, date: '03 May', status: 'Credited' },
    { id: 36, employee: 'Vivaan Sheikh', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Voyage', amount: 9175, date: '02 May', status: 'Credited' },

    // PAGE 4
    { id: 37, employee: 'Riya Chawla', branch: 'Anna Nagar', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Spark', amount: 4355, date: '29 Apr', status: 'Credited' },
    { id: 38, employee: 'Dev Khan', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Nova', amount: 5371, date: '22 Apr', status: 'Credited' },
    { id: 39, employee: 'Sunita Deshmukh', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Nova', amount: 5182, date: '04 Apr', status: 'Credited' },
    { id: 40, employee: 'Sunita Menon', branch: 'Sector 18', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Nova', amount: 4241, date: '03 Apr', status: 'Credited' },
    { id: 41, employee: 'Vivaan Rao', branch: 'Vashi', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Haul', amount: 7830, date: '01 Apr', status: 'Credited' },
    { id: 42, employee: 'Rohan Sheikh', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Crest', amount: 16541, date: '30 Mar', status: 'Pending Payout' },
    { id: 43, employee: 'Vivaan Rao', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Terra', amount: 12482, date: '26 Mar', status: 'Credited' },
    { id: 44, employee: 'Ayesha Menon', branch: 'Sector 18', type: 'Sales Incentive', basis: 'Vehicle delivery — TriNova Eco', amount: 2622, date: '22 Mar', status: 'Credited' },
    { id: 45, employee: 'Sameer Sheikh', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Terra', amount: 6282, date: '05 Mar', status: 'Credited' },
    { id: 46, employee: 'Divya Deshmukh', branch: 'Vashi', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Haul', amount: 4619, date: '02 Mar', status: 'Credited' },
    { id: 47, employee: 'Vivaan Rao', branch: 'Vashi', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Terra', amount: 10799, date: '16 Feb', status: 'Credited' },
    { id: 48, employee: 'Sunita Deshmukh', branch: 'Vashi', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Terra', amount: 1521, date: '10 Feb', status: 'Credited' },

    // PAGE 5
    { id: 49, employee: 'Karthik Mehta', branch: 'Anna Nagar', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Terra', amount: 13753, date: '09 Feb', status: 'Credited' },
    { id: 50, employee: 'Ritika Patil', branch: 'Vashi', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Voyage', amount: 9072, date: '09 Feb', status: 'Credited' },
    { id: 51, employee: 'Nikhil Menon', branch: 'Anna Nagar', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Crest', amount: 10857, date: '04 Feb', status: 'Credited' },
    { id: 52, employee: 'Divya Deshmukh', branch: 'Anna Nagar', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Terra', amount: 6129, date: '04 Feb', status: 'Credited' },
    { id: 53, employee: 'Vivaan Rao', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Terra', amount: 16758, date: '02 Feb', status: 'Credited' },
    { id: 54, employee: 'Nikhil Menon', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Velocia Motors Voyage', amount: 5539, date: '30 Jan', status: 'Credited' },
    { id: 55, employee: 'Sunita Menon', branch: 'Whitefield', type: 'Sales Incentive', basis: 'Vehicle delivery — Orbis Auto Nova', amount: 2631, date: '20 Jan', status: 'Credited' },
    { id: 56, employee: 'Riya Chawla', branch: 'Anna Nagar', type: 'Sales Incentive', basis: 'Vehicle delivery — TriNova Eco', amount: 3119, date: '17 Jan', status: 'Credited' },


];

const formatIncentiveMoney = (amount: number) =>
    `₹${amount.toLocaleString('en-IN')}`;




const formatPayrollMoney = (amount: number) =>
    `₹${amount.toLocaleString('en-IN')}`;


type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

type LeaveRequest = {
    id: number;
    employee: string;
    branch: string;
    type: 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Unpaid Leave';
    from: string;
    days: number;
    status: LeaveStatus;
};

const leaveRequests: LeaveRequest[] = [
    { id: 1, employee: 'Arjun Verma', branch: 'Vashi', type: 'Sick Leave', from: '03 Oct', days: 3, status: 'Pending' },
    { id: 2, employee: 'Ananya Iyer', branch: 'Anna Nagar', type: 'Earned Leave', from: '02 Oct', days: 4, status: 'Pending' },
    { id: 3, employee: 'Lakshmi Chawla', branch: 'Whitefield', type: 'Casual Leave', from: '01 Oct', days: 4, status: 'Approved' },
    { id: 4, employee: 'Arjun Gupta', branch: 'Anna Nagar', type: 'Casual Leave', from: '30 Sept', days: 5, status: 'Pending' },
    { id: 5, employee: 'Ayesha Sharma', branch: 'Gachibowli', type: 'Unpaid Leave', from: '01 Oct', days: 5, status: 'Pending' },
    { id: 6, employee: 'Ayesha Gupta', branch: 'Gachibowli', type: 'Casual Leave', from: '28 Sept', days: 1, status: 'Pending' },
    { id: 7, employee: 'Rajeev Subramaniam', branch: 'Whitefield', type: 'Sick Leave', from: '29 Sept', days: 3, status: 'Pending' },
    { id: 8, employee: 'Deepa Verma', branch: 'Gachibowli', type: 'Sick Leave', from: '28 Sept', days: 4, status: 'Pending' },
    { id: 9, employee: 'Zoya Sheikh', branch: 'Anna Nagar', type: 'Sick Leave', from: '24 Sept', days: 5, status: 'Pending' },
    { id: 10, employee: 'Kabir Joshi', branch: 'Sector 18', type: 'Casual Leave', from: '27 Sept', days: 5, status: 'Pending' },

    { id: 11, employee: 'Sameer Sen', branch: 'Vashi', type: 'Sick Leave', from: '24 Sept', days: 3, status: 'Pending' },
    { id: 12, employee: 'Riya Bose', branch: 'Vashi', type: 'Unpaid Leave', from: '24 Sept', days: 3, status: 'Pending' },
    { id: 13, employee: 'Sanya Khan', branch: 'Anna Nagar', type: 'Unpaid Leave', from: '20 Sept', days: 4, status: 'Pending' },
    { id: 14, employee: 'Kabir Kapoor', branch: 'Gachibowli', type: 'Casual Leave', from: '19 Sept', days: 1, status: 'Pending' },
    { id: 15, employee: 'Ritika Patil', branch: 'Whitefield', type: 'Unpaid Leave', from: '17 Sept', days: 4, status: 'Pending' },
    { id: 16, employee: 'Ishaan Kulkarni', branch: 'Vashi', type: 'Casual Leave', from: '11 Sept', days: 4, status: 'Pending' },
    { id: 17, employee: 'Ananya Reddy', branch: 'Anna Nagar', type: 'Sick Leave', from: '12 Sept', days: 4, status: 'Pending' },
    { id: 18, employee: 'Dev Sharma', branch: 'Sector 18', type: 'Unpaid Leave', from: '10 Sept', days: 5, status: 'Pending' },
    { id: 19, employee: 'Ritika Patil', branch: 'Whitefield', type: 'Casual Leave', from: '12 Sept', days: 4, status: 'Approved' },
    { id: 20, employee: 'Manish Verma', branch: 'Sector 18', type: 'Unpaid Leave', from: '11 Sept', days: 1, status: 'Pending' },

    { id: 21, employee: 'Rohan Sheikh', branch: 'Sector 18', type: 'Casual Leave', from: '10 Sept', days: 3, status: 'Pending' },
    { id: 22, employee: 'Imran Reddy', branch: 'Vashi', type: 'Unpaid Leave', from: '09 Sept', days: 3, status: 'Pending' },
    { id: 23, employee: 'Sameer Menon', branch: 'Whitefield', type: 'Unpaid Leave', from: '07 Sept', days: 4, status: 'Approved' },
    { id: 24, employee: 'Ayesha Sharma', branch: 'Gachibowli', type: 'Sick Leave', from: '04 Sept', days: 3, status: 'Pending' },
    { id: 25, employee: 'Dev Gupta', branch: 'Vashi', type: 'Sick Leave', from: '04 Sept', days: 4, status: 'Pending' },
    { id: 26, employee: 'Riya Joshi', branch: 'Whitefield', type: 'Casual Leave', from: '05 Sept', days: 4, status: 'Pending' },
    { id: 27, employee: 'Isha Iyer', branch: 'Sector 18', type: 'Sick Leave', from: '31 Aug', days: 2, status: 'Pending' },
    { id: 28, employee: 'Pooja Bose', branch: 'Anna Nagar', type: 'Unpaid Leave', from: '02 Sept', days: 3, status: 'Pending' },
    { id: 29, employee: 'Neha Sheikh', branch: 'Whitefield', type: 'Sick Leave', from: '31 Aug', days: 2, status: 'Pending' },
    { id: 30, employee: 'Riya Chawla', branch: 'Vashi', type: 'Unpaid Leave', from: '26 Aug', days: 2, status: 'Pending' },

    { id: 31, employee: 'Aditya Rao', branch: 'Gachibowli', type: 'Earned Leave', from: '28 Aug', days: 4, status: 'Pending' },
    { id: 32, employee: 'Ayesha Deshmukh', branch: 'Anna Nagar', type: 'Casual Leave', from: '26 Aug', days: 3, status: 'Pending' },
    { id: 33, employee: 'Divya Nair', branch: 'Vashi', type: 'Unpaid Leave', from: '25 Aug', days: 3, status: 'Pending' },
    { id: 34, employee: 'Vivaan Sheikh', branch: 'Gachibowli', type: 'Sick Leave', from: '27 Aug', days: 3, status: 'Approved' },
    { id: 35, employee: 'Dev Khan', branch: 'Anna Nagar', type: 'Casual Leave', from: '24 Aug', days: 2, status: 'Pending' },
    { id: 36, employee: 'Isha Khan', branch: 'Anna Nagar', type: 'Sick Leave', from: '24 Aug', days: 2, status: 'Pending' },
    { id: 37, employee: 'Ananya Reddy', branch: 'Anna Nagar', type: 'Casual Leave', from: '25 Aug', days: 5, status: 'Approved' },
    { id: 38, employee: 'Dev Sharma', branch: 'Sector 18', type: 'Unpaid Leave', from: '23 Aug', days: 1, status: 'Rejected' },
    { id: 39, employee: 'Zoya Sheikh', branch: 'Anna Nagar', type: 'Sick Leave', from: '19 Aug', days: 1, status: 'Approved' },
    { id: 40, employee: 'Suresh Joshi', branch: 'Vashi', type: 'Unpaid Leave', from: '19 Aug', days: 1, status: 'Approved' },

    { id: 41, employee: 'Anjali Rao', branch: 'Whitefield', type: 'Earned Leave', from: '19 Aug', days: 5, status: 'Approved' },
    { id: 42, employee: 'Farhan Deshmukh', branch: 'Vashi', type: 'Casual Leave', from: '18 Aug', days: 5, status: 'Approved' },
    { id: 43, employee: 'Riya Chawla', branch: 'Whitefield', type: 'Unpaid Leave', from: '19 Aug', days: 4, status: 'Approved' },
    { id: 44, employee: 'Lakshmi Kulkarni', branch: 'Anna Nagar', type: 'Casual Leave', from: '18 Aug', days: 4, status: 'Approved' },
    { id: 45, employee: 'Ayesha Subramaniam', branch: 'Anna Nagar', type: 'Casual Leave', from: '13 Aug', days: 5, status: 'Approved' },
    { id: 46, employee: 'Dev Chawla', branch: 'Sector 18', type: 'Casual Leave', from: '15 Aug', days: 5, status: 'Approved' },
    { id: 47, employee: 'Ayesha Nair', branch: 'Gachibowli', type: 'Sick Leave', from: '11 Aug', days: 4, status: 'Approved' },
    { id: 48, employee: 'Arjun Sharma', branch: 'Sector 18', type: 'Casual Leave', from: '14 Aug', days: 2, status: 'Approved' },
    { id: 49, employee: 'Sanya Khan', branch: 'Anna Nagar', type: 'Unpaid Leave', from: '11 Aug', days: 2, status: 'Rejected' },
    { id: 50, employee: 'Imran Rao', branch: 'Sector 18', type: 'Unpaid Leave', from: '08 Aug', days: 1, status: 'Approved' },

    { id: 51, employee: 'Riya Joshi', branch: 'Whitefield', type: 'Sick Leave', from: '09 Aug', days: 3, status: 'Approved' },
    { id: 52, employee: 'Sanya Verma', branch: 'Gachibowli', type: 'Unpaid Leave', from: '09 Aug', days: 4, status: 'Approved' },
    { id: 53, employee: 'Lakshmi Rao', branch: 'Gachibowli', type: 'Sick Leave', from: '04 Aug', days: 3, status: 'Approved' },
    { id: 54, employee: 'Riya Joshi', branch: 'Whitefield', type: 'Unpaid Leave', from: '05 Aug', days: 2, status: 'Approved' },
    { id: 55, employee: 'Suresh Iyer', branch: 'Gachibowli', type: 'Unpaid Leave', from: '04 Aug', days: 2, status: 'Approved' },
];

type AttendanceRecord = {
    id: number;
    employee: string;
    branch: string;
    checkIn: string;
    checkOut: string;
    status: 'Present' | 'Late' | 'Absent' | 'On Leave';
};


const attendanceRecords: AttendanceRecord[] = [
    { id: 1, employee: 'Manish Sheikh', branch: 'Whitefield', checkIn: '9:12 AM', checkOut: '6:11 PM', status: 'Present' },
    { id: 2, employee: 'Ayesha Subramaniam', branch: 'Whitefield', checkIn: '9:25 AM', checkOut: '6:12 PM', status: 'Present' },
    { id: 3, employee: 'Sunita Deshmukh', branch: 'Whitefield', checkIn: '9:02 AM', checkOut: '7:46 PM', status: 'Present' },
    { id: 4, employee: 'Rajeev Subramaniam', branch: 'Whitefield', checkIn: '9:24 AM', checkOut: '6:40 PM', status: 'Present' },
    { id: 5, employee: 'Riya Chawla', branch: 'Whitefield', checkIn: '9:29 AM', checkOut: '7:13 PM', status: 'Present' },
    { id: 6, employee: 'Ritika Patil', branch: 'Whitefield', checkIn: '9:54 AM', checkOut: '6:19 PM', status: 'Present' },
    { id: 7, employee: 'Ritika Patil', branch: 'Whitefield', checkIn: '9:26 AM', checkOut: '8:23 PM', status: 'Present' },
    { id: 8, employee: 'Neha Sheikh', branch: 'Whitefield', checkIn: '9:54 AM', checkOut: '7:49 PM', status: 'Present' },
    { id: 9, employee: 'Vikram Subramanian', branch: 'Whitefield', checkIn: '9:27 AM', checkOut: '8:22 PM', status: 'Present' },
    { id: 10, employee: 'Aarav Chawla', branch: 'Whitefield', checkIn: '10:56 AM', checkOut: '6:14 PM', status: 'Late' },
    { id: 11, employee: 'Sameer Kulkarni', branch: 'Whitefield', checkIn: '9:52 AM', checkOut: '7:18 PM', status: 'Present' },
    { id: 12, employee: 'Ayesha Sharma', branch: 'Whitefield', checkIn: '9:50 AM', checkOut: '6:59 PM', status: 'Present' },
    { id: 13, employee: 'Dev Sheikh', branch: 'Whitefield', checkIn: '9:01 AM', checkOut: '7:01 PM', status: 'Present' },
    { id: 14, employee: 'Arjun Joshi', branch: 'Whitefield', checkIn: '9:15 AM', checkOut: '8:24 PM', status: 'Present' },
    { id: 15, employee: 'Meera Sharma', branch: 'Whitefield', checkIn: '9:00 AM', checkOut: '7:54 PM', status: 'Present' },
    { id: 16, employee: 'Anjali Rao', branch: 'Whitefield', checkIn: '9:25 AM', checkOut: '7:56 PM', status: 'Present' },
    { id: 17, employee: 'Imran Mehta', branch: 'Whitefield', checkIn: '9:59 AM', checkOut: '8:48 PM', status: 'Present' },
    { id: 18, employee: 'Meera Verma', branch: 'Whitefield', checkIn: '9:36 AM', checkOut: '7:13 PM', status: 'Present' },
    { id: 19, employee: 'Arjun Khan', branch: 'Whitefield', checkIn: '9:38 AM', checkOut: '8:56 PM', status: 'Present' },
    { id: 20, employee: 'Meera Joshi', branch: 'Whitefield', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 21, employee: 'Sameer Sharma', branch: 'Whitefield', checkIn: '9:30 AM', checkOut: '8:46 PM', status: 'Present' },
    { id: 22, employee: 'Lakshmi Chawla', branch: 'Whitefield', checkIn: '9:44 AM', checkOut: '7:15 PM', status: 'Present' },
    { id: 23, employee: 'Isha Mehta', branch: 'Whitefield', checkIn: '—', checkOut: '—', status: 'On Leave' },
    { id: 24, employee: 'Riya Joshi', branch: 'Whitefield', checkIn: '9:15 AM', checkOut: '6:07 PM', status: 'Present' },
    { id: 25, employee: 'Sameer Menon', branch: 'Whitefield', checkIn: '9:17 AM', checkOut: '7:21 PM', status: 'Present' },
    { id: 26, employee: 'Vikram Menon', branch: 'Whitefield', checkIn: '9:34 AM', checkOut: '7:20 PM', status: 'Present' },
    { id: 27, employee: 'Farhan Mehta', branch: 'Gachibowli', checkIn: '—', checkOut: '—', status: 'On Leave' },
    { id: 28, employee: 'Suresh Iyer', branch: 'Gachibowli', checkIn: '9:03 AM', checkOut: '7:43 PM', status: 'Present' },
    { id: 29, employee: 'Pooja Bose', branch: 'Gachibowli', checkIn: '10:02 AM', checkOut: '6:18 PM', status: 'Late' },
    { id: 30, employee: 'Vivaan Sheikh', branch: 'Gachibowli', checkIn: '9:40 AM', checkOut: '6:29 PM', status: 'Present' },
    { id: 31, employee: 'Karthik Mehta', branch: 'Gachibowli', checkIn: '9:56 AM', checkOut: '7:24 PM', status: 'Present' },
    { id: 32, employee: 'Nikhil Menon', branch: 'Gachibowli', checkIn: '9:52 AM', checkOut: '6:07 PM', status: 'Present' },
    { id: 33, employee: 'Anjali Rao', branch: 'Gachibowli', checkIn: '9:47 AM', checkOut: '7:49 PM', status: 'Present' },
    { id: 34, employee: 'Arjun Menon', branch: 'Gachibowli', checkIn: '9:34 AM', checkOut: '7:01 PM', status: 'Present' },
    { id: 35, employee: 'Lakshmi Rao', branch: 'Gachibowli', checkIn: '9:29 AM', checkOut: '6:35 PM', status: 'Present' },
    { id: 36, employee: 'Deepa Verma', branch: 'Gachibowli', checkIn: '9:58 AM', checkOut: '8:07 PM', status: 'Present' },
    { id: 37, employee: 'Aditya Sharma', branch: 'Gachibowli', checkIn: '9:17 AM', checkOut: '7:37 PM', status: 'Present' },
    { id: 38, employee: 'Ayesha Nair', branch: 'Gachibowli', checkIn: '9:16 AM', checkOut: '8:07 PM', status: 'Present' },
    { id: 39, employee: 'Aditya Rao', branch: 'Gachibowli', checkIn: '9:53 AM', checkOut: '8:21 PM', status: 'Late' },
    { id: 40, employee: 'Imran Kapoor', branch: 'Gachibowli', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 41, employee: 'Karthik Iyer', branch: 'Gachibowli', checkIn: '9:36 AM', checkOut: '6:43 PM', status: 'Present' },
    { id: 42, employee: 'Ishaan Kulkarni', branch: 'Gachibowli', checkIn: '9:50 AM', checkOut: '7:27 PM', status: 'Present' },
    { id: 43, employee: 'Ayesha Gupta', branch: 'Gachibowli', checkIn: '9:14 AM', checkOut: '7:05 PM', status: 'Present' },
    { id: 44, employee: 'Ayesha Sharma', branch: 'Gachibowli', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 45, employee: 'Nikhil Bose', branch: 'Gachibowli', checkIn: '9:01 AM', checkOut: '7:37 PM', status: 'Present' },
    { id: 46, employee: 'Kabir Kapoor', branch: 'Gachibowli', checkIn: '9:25 AM', checkOut: '7:23 PM', status: 'Present' },
    { id: 47, employee: 'Divya Mehta', branch: 'Gachibowli', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 48, employee: 'Imran Patil', branch: 'Gachibowli', checkIn: '9:17 AM', checkOut: '7:59 PM', status: 'Present' },
    { id: 49, employee: 'Sanya Verma', branch: 'Gachibowli', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 50, employee: 'Zoya Patil', branch: 'Gachibowli', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 51, employee: 'Divya Nair', branch: 'Gachibowli', checkIn: '9:31 AM', checkOut: '8:41 PM', status: 'Present' },
    { id: 52, employee: 'Kabir Subramaniam', branch: 'Gachibowli', checkIn: '9:01 AM', checkOut: '6:54 PM', status: 'Present' },
    { id: 53, employee: 'Riya Bose', branch: 'Vashi', checkIn: '9:22 AM', checkOut: '8:38 PM', status: 'Present' },
    { id: 54, employee: 'Deepa Gupta', branch: 'Vashi', checkIn: '9:00 AM', checkOut: '6:20 PM', status: 'Present' },
    { id: 55, employee: 'Divya Deshmukh', branch: 'Vashi', checkIn: '9:00 AM', checkOut: '8:15 PM', status: 'Present' },
    { id: 56, employee: 'Meera Patil', branch: 'Vashi', checkIn: '9:14 AM', checkOut: '6:27 PM', status: 'Present' },
    { id: 57, employee: 'Ayesha Menon', branch: 'Vashi', checkIn: '10:24 AM', checkOut: '7:02 PM', status: 'Late' },
    { id: 58, employee: 'Sunita Menon', branch: 'Vashi', checkIn: '9:04 AM', checkOut: '6:24 PM', status: 'Present' },
    { id: 59, employee: 'Imran Reddy', branch: 'Vashi', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 60, employee: 'Divya Reddy', branch: 'Vashi', checkIn: '9:03 AM', checkOut: '6:58 PM', status: 'Present' },
    { id: 61, employee: 'Aarav Nair', branch: 'Vashi', checkIn: '9:47 AM', checkOut: '6:29 PM', status: 'Present' },
    { id: 62, employee: 'Karthik Iyer', branch: 'Vashi', checkIn: '9:22 AM', checkOut: '8:53 PM', status: 'Late' },
    { id: 63, employee: 'Dev Gupta', branch: 'Vashi', checkIn: '10:54 AM', checkOut: '7:30 PM', status: 'Late' },
    { id: 64, employee: 'Vikram Gupta', branch: 'Vashi', checkIn: '9:57 AM', checkOut: '6:42 PM', status: 'Present' },
    { id: 65, employee: 'Sameer Sen', branch: 'Vashi', checkIn: '9:39 AM', checkOut: '8:07 PM', status: 'Present' },
    { id: 66, employee: 'Dev Verma', branch: 'Vashi', checkIn: '9:00 AM', checkOut: '6:47 PM', status: 'Present' },
    { id: 67, employee: 'Neha Kapoor', branch: 'Vashi', checkIn: '9:35 AM', checkOut: '7:34 PM', status: 'Present' },
    { id: 68, employee: 'Farhan Deshmukh', branch: 'Vashi', checkIn: '9:22 AM', checkOut: '6:27 PM', status: 'Present' },
    { id: 69, employee: 'Ramesh Kulkarni', branch: 'Vashi', checkIn: '9:10 AM', checkOut: '6:25 PM', status: 'Late' },
    { id: 70, employee: 'Riya Chawla', branch: 'Vashi', checkIn: '9:25 AM', checkOut: '6:57 PM', status: 'Present' },
    { id: 71, employee: 'Ishaan Kulkarni', branch: 'Vashi', checkIn: '—', checkOut: '—', status: 'On Leave' },
    { id: 72, employee: 'Manish Chawla', branch: 'Vashi', checkIn: '9:50 AM', checkOut: '6:09 PM', status: 'Present' },
    { id: 73, employee: 'Riya Nair', branch: 'Vashi', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 74, employee: 'Pooja Rao', branch: 'Vashi', checkIn: '9:26 AM', checkOut: '7:39 PM', status: 'Present' },
    { id: 75, employee: 'Arjun Verma', branch: 'Vashi', checkIn: '9:55 AM', checkOut: '7:38 PM', status: 'Present' },
    { id: 76, employee: 'Suresh Joshi', branch: 'Vashi', checkIn: '9:09 AM', checkOut: '8:38 PM', status: 'Present' },
    { id: 77, employee: 'Priya Nair', branch: 'Vashi', checkIn: '9:14 AM', checkOut: '6:36 PM', status: 'Present' },
    { id: 78, employee: 'Arjun Chawla', branch: 'Vashi', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 79, employee: 'Sanya Khan', branch: 'Anna Nagar', checkIn: '9:59 AM', checkOut: '7:32 PM', status: 'Present' },
    { id: 80, employee: 'Nikhil Kapoor', branch: 'Anna Nagar', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 81, employee: 'Arjun Gupta', branch: 'Anna Nagar', checkIn: '9:30 AM', checkOut: '8:23 PM', status: 'Present' },
    { id: 82, employee: 'Ananya Iyer', branch: 'Anna Nagar', checkIn: '9:35 AM', checkOut: '8:51 PM', status: 'Present' },
    { id: 83, employee: 'Dev Khan', branch: 'Anna Nagar', checkIn: '9:48 AM', checkOut: '7:47 PM', status: 'Present' },
    { id: 84, employee: 'Vivaan Rao', branch: 'Anna Nagar', checkIn: '9:38 AM', checkOut: '8:29 PM', status: 'Present' },
    { id: 85, employee: 'Aarav Sharma', branch: 'Anna Nagar', checkIn: '9:56 AM', checkOut: '7:36 PM', status: 'Present' },
    { id: 86, employee: 'Aarav Reddy', branch: 'Anna Nagar', checkIn: '9:16 AM', checkOut: '8:28 PM', status: 'Present' },
    { id: 87, employee: 'Pooja Deshmukh', branch: 'Anna Nagar', checkIn: '9:57 AM', checkOut: '7:42 PM', status: 'Present' },
    { id: 88, employee: 'Imran Kapoor', branch: 'Anna Nagar', checkIn: '9:47 AM', checkOut: '8:16 PM', status: 'Present' },
    { id: 89, employee: 'Priya Verma', branch: 'Anna Nagar', checkIn: '9:50 AM', checkOut: '6:14 PM', status: 'Present' },
    { id: 90, employee: 'Kabir Khan', branch: 'Anna Nagar', checkIn: '9:39 AM', checkOut: '8:31 PM', status: 'Present' },
    { id: 91, employee: 'Karthik Rao', branch: 'Anna Nagar', checkIn: '9:35 AM', checkOut: '6:41 PM', status: 'Present' },
    { id: 92, employee: 'Sanya Verma', branch: 'Anna Nagar', checkIn: '9:13 AM', checkOut: '6:22 PM', status: 'Present' },
    { id: 93, employee: 'Priya Menon', branch: 'Anna Nagar', checkIn: '9:53 AM', checkOut: '8:25 PM', status: 'Present' },
    { id: 94, employee: 'Ramesh Iyer', branch: 'Anna Nagar', checkIn: '9:50 AM', checkOut: '6:34 PM', status: 'Present' },
    { id: 95, employee: 'Sameer Chawla', branch: 'Anna Nagar', checkIn: '9:53 AM', checkOut: '7:43 PM', status: 'Present' },
    { id: 96, employee: 'Aarav Menon', branch: 'Anna Nagar', checkIn: '9:39 AM', checkOut: '6:10 PM', status: 'Present' },
    { id: 97, employee: 'Riya Sharma', branch: 'Anna Nagar', checkIn: '9:18 AM', checkOut: '7:15 PM', status: 'Present' },
    { id: 98, employee: 'Suresh Mehta', branch: 'Anna Nagar', checkIn: '9:42 AM', checkOut: '8:10 PM', status: 'Present' },
    { id: 99, employee: 'Neha Rao', branch: 'Anna Nagar', checkIn: '9:25 AM', checkOut: '6:45 PM', status: 'Present' },
    { id: 100, employee: 'Kabir Sharma', branch: 'Anna Nagar', checkIn: '9:36 AM', checkOut: '7:22 PM', status: 'Present' },
    { id: 101, employee: 'Meera Nair', branch: 'Anna Nagar', checkIn: '9:10 AM', checkOut: '6:50 PM', status: 'Present' },
    { id: 102, employee: 'Arjun Rao', branch: 'Anna Nagar', checkIn: '9:55 AM', checkOut: '7:40 PM', status: 'Present' },
    { id: 103, employee: 'Priya Sharma', branch: 'Anna Nagar', checkIn: '9:20 AM', checkOut: '6:35 PM', status: 'Present' },
    { id: 104, employee: 'Vikram Joshi', branch: 'Anna Nagar', checkIn: '9:45 AM', checkOut: '8:05 PM', status: 'Present' },
    { id: 105, employee: 'Isha Rao', branch: 'Anna Nagar', checkIn: '9:05 AM', checkOut: '6:25 PM', status: 'Present' },
    { id: 106, employee: 'Sameer Verma', branch: 'Anna Nagar', checkIn: '9:30 AM', checkOut: '7:10 PM', status: 'Present' },
    { id: 107, employee: 'Ananya Mehta', branch: 'Anna Nagar', checkIn: '9:50 AM', checkOut: '7:30 PM', status: 'Present' },
    { id: 108, employee: 'Rohan Kapoor', branch: 'Anna Nagar', checkIn: '9:15 AM', checkOut: '6:55 PM', status: 'Present' },
    { id: 109, employee: 'Manish Kapoor', branch: 'Sector 18', checkIn: '9:39 AM', checkOut: '6:56 PM', status: 'Present' },
    { id: 110, employee: 'Anjali Joshi', branch: 'Sector 18', checkIn: '9:48 AM', checkOut: '8:06 PM', status: 'Present' },
    { id: 111, employee: 'Sunita Reddy', branch: 'Sector 18', checkIn: '9:12 AM', checkOut: '8:34 PM', status: 'Present' },
    { id: 112, employee: 'Neha Joshi', branch: 'Sector 18', checkIn: '9:53 AM', checkOut: '6:00 PM', status: 'Present' },
    { id: 113, employee: 'Sanya Mehta', branch: 'Sector 18', checkIn: '9:52 AM', checkOut: '8:20 PM', status: 'Present' },
    { id: 114, employee: 'Dev Sharma', branch: 'Sector 18', checkIn: '10:56 AM', checkOut: '8:18 PM', status: 'Late' },
    { id: 115, employee: 'Ritika Deshmukh', branch: 'Sector 18', checkIn: '9:53 AM', checkOut: '7:32 PM', status: 'Present' },
    { id: 116, employee: 'Pooja Deshmukh', branch: 'Sector 18', checkIn: '10:59 AM', checkOut: '6:10 PM', status: 'Late' },
    { id: 117, employee: 'Pooja Joshi', branch: 'Sector 18', checkIn: '10:39 AM', checkOut: '7:46 PM', status: 'Late' },
    { id: 118, employee: 'Ananya Sharma', branch: 'Sector 18', checkIn: '9:01 AM', checkOut: '6:51 PM', status: 'Present' },
    { id: 119, employee: 'Isha Deshmukh', branch: 'Sector 18', checkIn: '9:37 AM', checkOut: '6:05 PM', status: 'Late' },
    { id: 120, employee: 'Isha Iyer', branch: 'Sector 18', checkIn: '9:13 AM', checkOut: '6:53 PM', status: 'Present' },
    { id: 121, employee: 'Imran Rao', branch: 'Sector 18', checkIn: '9:36 AM', checkOut: '8:19 PM', status: 'Present' },
    { id: 122, employee: 'Ritika Sen', branch: 'Sector 18', checkIn: '9:04 AM', checkOut: '8:25 PM', status: 'Present' },
    { id: 123, employee: 'Divya Sheikh', branch: 'Sector 18', checkIn: '9:35 AM', checkOut: '6:33 PM', status: 'Present' },
    { id: 124, employee: 'Priya Subramaniam', branch: 'Sector 18', checkIn: '9:32 AM', checkOut: '6:52 PM', status: 'Present' },
    { id: 125, employee: 'Suresh Sharma', branch: 'Sector 18', checkIn: '—', checkOut: '—', status: 'Absent' },
    { id: 126, employee: 'Arjun Sharma', branch: 'Sector 18', checkIn: '9:58 AM', checkOut: '8:29 PM', status: 'Present' },
    { id: 127, employee: 'Vikram Deshmukh', branch: 'Sector 18', checkIn: '9:15 AM', checkOut: '8:30 PM', status: 'Present' },
    { id: 128, employee: 'Manish Verma', branch: 'Sector 18', checkIn: '9:20 AM', checkOut: '8:40 PM', status: 'Present' },
    { id: 129, employee: 'Anjali Patil', branch: 'Sector 18', checkIn: '9:16 AM', checkOut: '7:58 PM', status: 'Present' },
    { id: 130, employee: 'Dev Chawla', branch: 'Sector 18', checkIn: '9:33 AM', checkOut: '6:59 PM', status: 'Present' },
];


function HRPayroll() {
    const [activeSection, setActiveSection] =
        useState<HRSection>('Employees');

    const [attendanceSearch, setAttendanceSearch] = useState('');
    const [attendanceBranch] = useState('All');
    const [attendanceStatus, setAttendanceStatus] = useState('All');
    const [attendancePage, setAttendancePage] = useState(1);

    const [search, setSearch] = useState('');


    const filteredAttendanceRecords = attendanceRecords.filter((record) => {
        const matchesSearch =
            record.employee.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
            record.branch.toLowerCase().includes(attendanceSearch.toLowerCase());

        const matchesBranch =
            attendanceBranch === 'All' || record.branch === attendanceBranch;

        const matchesStatus =
            attendanceStatus === 'All' || record.status === attendanceStatus;

        return matchesSearch && matchesBranch && matchesStatus;
    });

    const [incentiveSearch, setIncentiveSearch] = useState('');
    const [incentiveType, setIncentiveType] = useState('All');
    const [incentiveStatus, setIncentiveStatus] = useState('All');
    const [incentivePage, setIncentivePage] = useState(1);

    const incentiveRowsPerPage = 12;

    const filteredIncentives = useMemo(() => {
        return incentiveRecords.filter((record) => {
            const query = incentiveSearch.trim().toLowerCase();

            const matchesSearch =
                !query ||
                [
                    record.employee,
                    record.branch,
                    record.type,
                    record.basis,
                    record.amount,
                    record.date,
                    record.status,
                ]
                    .join(' ')
                    .toLowerCase()
                    .includes(query);

            const matchesType =
                incentiveType === 'All' ||
                record.type === incentiveType;

            const matchesStatus =
                incentiveStatus === 'All' ||
                record.status === incentiveStatus;

            return matchesSearch && matchesType && matchesStatus;
        });
    }, [incentiveSearch, incentiveType, incentiveStatus]);

    const incentiveTotalPages = Math.max(
        1,
        Math.ceil(filteredIncentives.length / incentiveRowsPerPage)
    );

    const visibleIncentives = filteredIncentives.slice(
        (incentivePage - 1) * incentiveRowsPerPage,
        incentivePage * incentiveRowsPerPage
    );






    const attendancePageSize = 12;

    const totalAttendancePages = Math.max(
        1,
        Math.ceil(filteredAttendanceRecords.length / attendancePageSize),
        11
    );

    const paginatedAttendanceRecords = filteredAttendanceRecords.slice(
        (attendancePage - 1) * attendancePageSize,
        attendancePage * attendancePageSize
    );

    const [onRollSearch, setOnRollSearch] = useState('');
    const [dailyWageSearch, setDailyWageSearch] = useState('');
    const [contractStaffSearch, setContractStaffSearch] = useState('');

    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);

    const [leaveSearch, setLeaveSearch] = useState('');
    const [leaveStatusFilter, setLeaveStatusFilter] = useState('All');
    const [leaveTypeFilter, setLeaveTypeFilter] = useState('All');
    const [leavePage, setLeavePage] = useState(1);

    const leavePageSize = 10;

    const [payrollPeriod, setPayrollPeriod] = useState("Aug '26 — Processed");
    const [payrollSearch, setPayrollSearch] = useState('');
    const [payrollPage, setPayrollPage] = useState(1);
    const [showPayslip, setShowPayslip] = useState<PayslipRecord | null>(null);

    const payrollPageSize = 10;

    const [onRollPage, setOnRollPage] = useState(1);
    const [dailyWagePage, setDailyWagePage] = useState(1);
    const [contractPage, setContractPage] = useState(1);
    const rowsPerPage = 8;

    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formOpenings, setFormOpenings] = useState(1);
    const [formDepartment, setFormDepartment] = useState('Sales');
    const [formBranch, setFormBranch] = useState('Whitefield');
    const [formType, setFormType] = useState('On-Roll');
    const [formRole, setFormRole] = useState('');
    const [extraVacancies, setExtraVacancies] = useState<Vacancy[]>([]);

    const isEmployees = activeSection === 'Employees';
    const isVacancies = activeSection === 'Vacancies';


    const filteredLeaveRequests = leaveRequests.filter((request) => {
        const matchesSearch =
            `${request.employee} ${request.branch} ${request.type} ${request.status}`
                .toLowerCase()
                .includes(leaveSearch.toLowerCase().trim());

        const matchesStatus =
            leaveStatusFilter === 'All' ||
            request.status === leaveStatusFilter;

        const matchesType =
            leaveTypeFilter === 'All' ||
            request.type === leaveTypeFilter;

        return matchesSearch && matchesStatus && matchesType;
    });

    const leaveTotalPages = Math.max(
        1,
        Math.ceil(filteredLeaveRequests.length / leavePageSize)
    );

    const visibleLeaveRequests = filteredLeaveRequests.slice(
        (leavePage - 1) * leavePageSize,
        leavePage * leavePageSize
    );


    const filteredPayrollRecords = payrollRecords.filter((record) =>
        `${record.name} ${record.role} ${record.branch}`
            .toLowerCase()
            .includes(payrollSearch.toLowerCase().trim())
    );

    const payrollTotalPages = Math.max(
        1,
        Math.ceil(filteredPayrollRecords.length / payrollPageSize)
    );

    const visiblePayrollRecords = filteredPayrollRecords.slice(
        (payrollPage - 1) * payrollPageSize,
        payrollPage * payrollPageSize
    );
    const isOnRollDailyWages =
        activeSection === 'On-Roll & Daily Wages';

    const onRollEmployees = [
        {
            id: 'EMP-101',
            name: 'Amit Sharma',
            department: 'Sales',
            designation: 'Sales Executive',
            branch: 'Pune',
            monthlySalary: 35000,
            status: 'Active',
        },
        {
            id: 'EMP-102',
            name: 'Priya Patil',
            department: 'HR',
            designation: 'HR Executive',
            branch: 'Mumbai',
            monthlySalary: 32000,
            status: 'Active',
        },
        {
            id: 'EMP-103',
            name: 'Rahul Deshmukh',
            department: 'Finance',
            designation: 'Accountant',
            branch: 'Pune',
            monthlySalary: 38000,
            status: 'On Leave',
        },
    ];

    const dailyWageRecords = [
        {
            id: 'DW-101',
            name: 'Suresh Jadhav',
            branch: 'Pune',
            ratePerDay: 700,
            daysPresent: 24,
            daysAbsent: 2,
            paymentStatus: 'Paid',
        },
        {
            id: 'DW-102',
            name: 'Ramesh More',
            branch: 'Mumbai',
            ratePerDay: 650,
            daysPresent: 22,
            daysAbsent: 4,
            paymentStatus: 'Pending Disbursal',
        },
        {
            id: 'DW-103',
            name: 'Ganesh Shinde',
            branch: 'Pune',
            ratePerDay: 750,
            daysPresent: 26,
            daysAbsent: 0,
            paymentStatus: 'Paid',
        },
    ];

    const contractStaffRecords = [
        {
            id: 'CS-101',
            name: 'Vikas Enterprises',
            branch: 'Pune',
            monthlyFee: 45000,
            status: 'Active',
        },
        {
            id: 'CS-102',
            name: 'Secure Services',
            branch: 'Mumbai',
            monthlyFee: 38000,
            status: 'Active',
        },
        {
            id: 'CS-103',
            name: 'CleanPro Services',
            branch: 'Pune',
            monthlyFee: 25000,
            status: 'Under Review',
        },
    ];

    // const totalOnRollSalary = onRollEmployees.reduce(
    //     (total, employee) => total + employee.monthlySalary,
    //     0
    // );

    const totalDailyWage = dailyWageRecords.reduce(
        (total, record) =>
            total + record.ratePerDay * record.daysPresent,
        0
    );

    // const totalContractFee = contractStaffRecords.reduce(
    //     (total, staff) => total + staff.monthlyFee,
    //     0
    // );


    const filteredOnRollEmployees = onRollEmployees.filter((employee) =>
        [
            employee.id,
            employee.name,
            employee.department,
            employee.designation,
            employee.branch,
            employee.status,
        ]
            .join(' ')
            .toLowerCase()
            .includes(onRollSearch.toLowerCase().trim())
    );

    const onRollTotalPages = Math.max(
        1,
        Math.ceil(filteredOnRollEmployees.length / rowsPerPage)
    );

    const paginatedOnRollEmployees = filteredOnRollEmployees.slice(
        (onRollPage - 1) * rowsPerPage,
        onRollPage * rowsPerPage
    );


    const filteredDailyWageRecords = dailyWageRecords.filter((record) =>
        [
            record.id,
            record.name,
            record.branch,
            record.paymentStatus,
        ]
            .join(' ')
            .toLowerCase()
            .includes(dailyWageSearch.toLowerCase().trim())
    );


    const dailyWageTotalPages = Math.max(
        1,
        Math.ceil(filteredDailyWageRecords.length / rowsPerPage)
    );

    const paginatedDailyWageRecords = filteredDailyWageRecords.slice(
        (dailyWagePage - 1) * rowsPerPage,
        dailyWagePage * rowsPerPage
    );

    const filteredContractStaffRecords = contractStaffRecords.filter((staff) =>
        [
            staff.id,
            staff.name,
            staff.branch,
            staff.status,
        ]
            .join(' ')
            .toLowerCase()
            .includes(contractStaffSearch.toLowerCase().trim())
    );

    const contractTotalPages = Math.max(
        1,
        Math.ceil(filteredContractStaffRecords.length / rowsPerPage)
    );

    const paginatedContractStaffRecords = filteredContractStaffRecords.slice(
        (contractPage - 1) * rowsPerPage,
        contractPage * rowsPerPage
    );



    const isHiringPipeline = activeSection === 'Hiring Pipeline';

    const hiringStages = [
        { name: 'Applied', count: 10 },
        { name: 'Screening', count: 8 },
        { name: 'Interview Scheduled', count: 7 },
        { name: 'Interview Completed', count: 4 },
        { name: 'Offer Extended', count: 3 },
        { name: 'Offer Accepted', count: 5 },
        { name: 'Hired', count: 4 },
    ];

    type Candidate = {
        id: number;
        name: string;
        role: string;
        branch: string;
        source: string;
        score: number;
        applied: string;
        stage: string;
    };

    const candidates: Candidate[] = [
        { id: 1, name: 'Sameer Iyer', role: 'Accounts Executive', branch: 'Sector 18', source: 'Walk-in', score: 86, applied: '21 Aug', stage: 'Interview Completed' },
        { id: 2, name: 'Vikram Reddy', role: 'Accounts Executive', branch: 'Gachibowli', source: 'Walk-in', score: 74, applied: '19 Aug', stage: 'Interview Scheduled' },
        { id: 3, name: 'Meera Khan', role: 'Sales Executive', branch: 'Sector 18', source: 'LinkedIn', score: 70, applied: '19 Aug', stage: 'Screening' },
        { id: 4, name: 'Rajeev Rao', role: 'Body Shop Technician', branch: 'Vashi', source: 'Consultancy', score: 87, applied: '19 Aug', stage: 'Offer Extended' },
        { id: 5, name: 'Sunita Kulkarni', role: 'HR Executive', branch: 'Sector 18', source: 'Naukri', score: 76, applied: '18 Aug', stage: 'Rejected' },
        { id: 6, name: 'Arjun Gupta', role: 'Technician', branch: 'Sector 18', source: 'Campus Drive', score: 88, applied: '15 Aug', stage: 'Offer Accepted' },
        { id: 7, name: 'Ananya Deshmukh', role: 'Accounts Executive', branch: 'Gachibowli', source: 'Walk-in', score: 86, applied: '15 Aug', stage: 'Rejected' },
        { id: 8, name: 'Karthik Joshi', role: 'HR Executive', branch: 'Sector 18', source: 'Consultancy', score: 79, applied: '15 Aug', stage: 'Applied' },
        { id: 9, name: 'Kavya Rao', role: 'Accounts Executive', branch: 'Gachibowli', source: 'LinkedIn', score: 57, applied: '15 Aug', stage: 'Applied' },
        { id: 10, name: 'Imran Sharma', role: 'Service Advisor', branch: 'Whitefield', source: 'Employee Referral', score: 51, applied: '14 Aug', stage: 'Rejected' },
        { id: 11, name: 'Ritika Sharma', role: 'Body Shop Technician', branch: 'Vashi', source: 'Consultancy', score: 48, applied: '14 Aug', stage: 'Interview Scheduled' },
        { id: 12, name: 'Divya Mehta', role: 'Branch Manager', branch: 'Sector 18', source: 'Consultancy', score: 95, applied: '14 Aug', stage: 'Hired' },
    ];

    const filteredEmployees = useMemo(() => {
        return employees.filter((employee) => {
            const matchesSearch =
                `${employee.name} ${employee.role} ${employee.branch}`
                    .toLowerCase()
                    .includes(search.toLowerCase());

            return (
                matchesSearch &&
                (departmentFilter === 'All' ||
                    employee.department === departmentFilter) &&
                (typeFilter === 'All' || employee.type === typeFilter) &&
                (statusFilter === 'All' || employee.status === statusFilter)
            );
        });
    }, [search, departmentFilter, typeFilter, statusFilter]);

    const allVacancies = useMemo(
        () => [...vacancies, ...extraVacancies],
        [extraVacancies]
    );

    const filteredVacancies = useMemo(() => {
        return allVacancies.filter((vacancy) => {
            const matchesSearch =
                `${vacancy.position} ${vacancy.department} ${vacancy.branch}`
                    .toLowerCase()
                    .includes(search.toLowerCase());

            return (
                matchesSearch &&
                (departmentFilter === 'All' ||
                    vacancy.department === departmentFilter) &&
                (statusFilter === 'All' || vacancy.status === statusFilter)
            );
        });
    }, [allVacancies, search, departmentFilter, statusFilter]);

    const pageSize = 10;
    const currentRecords = isEmployees
        ? filteredEmployees
        : filteredVacancies;
    const totalPages = Math.max(1, Math.ceil(currentRecords.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const visibleRecords = currentRecords.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize
    );

    const resetFilters = () => {
        setSearch('');
        setDepartmentFilter('All');
        setTypeFilter('All');
        setStatusFilter('All');
        setPage(1);
    };

    const changeSection = (section: HRSection) => {
        setActiveSection(section);
        resetFilters();
        setShowForm(false);
    };

    const openForm = () => {
        setFormName('');
        setFormRole('');
        setFormDepartment('Sales');
        setFormBranch('Whitefield');
        setFormType('On-Roll');
        setShowForm(true);
    };

    const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!formRole.trim()) return;

        if (isVacancies) {
            const newVacancy: Vacancy = {
                id: Date.now(),
                position: formRole.trim(),
                department: formDepartment,
                branch: formBranch,
                openings: 1,
                filled: 0,
                type: formType,
                status: 'Open',
            };
            setExtraVacancies((previous) => [...previous, newVacancy]);
        } else {
            window.alert(
                `Employee onboarding form saved for ${formName || formRole}. This demo does not connect to a backend.`
            );
        }

        setShowForm(false);
        resetFilters();
    };






    return (
        <div className="hr-page">
            <div className="hr-page-heading">
                <div>
                    <h1>HR &amp; Payroll</h1>
                    <p>
                        Recruitment, onboarding, attendance, leave, payroll and
                        incentives — the full HRMS lifecycle.
                    </p>
                </div>

                <button
                    type="button"
                    className="hr-primary-button"
                    onClick={openForm}
                >
                    + {isVacancies ? 'Post Opening' : 'Onboard Employee'}
                </button>
            </div>

            <nav className="hr-section-tabs" aria-label="HR sections">
                {sections.map((section) => (
                    <button
                        type="button"
                        key={section.label}
                        className={`hr-section-tab ${activeSection === section.label ? 'active' : ''
                            }`}
                        onClick={() => changeSection(section.label)}
                    >
                        <span>{section.icon}</span>
                        {section.label}
                    </button>
                ))}
            </nav>

            {isEmployees && (
                <>
                    <div className="hr-summary-grid">
                        <div className="hr-summary-card">
                            <span>HEADCOUNT</span>
                            <strong>130</strong>
                        </div>
                        <div className="hr-summary-card">
                            <span>ON LEAVE TODAY</span>
                            <strong>3</strong>
                        </div>
                        <div className="hr-summary-card">
                            <span>AVG. ATTENDANCE</span>
                            <strong>91.5%</strong>
                        </div>
                        <div className="hr-summary-card">
                            <span>AVG. TARGET ACHIEVEMENT</span>
                            <strong>90%</strong>
                        </div>
                    </div>

                    <section className="hr-department-panel">
                        <h2>Headcount by Department</h2>
                        <div className="hr-department-list">
                            {departments.map((department) => (
                                <div
                                    className="hr-department-item"
                                    key={department.name}
                                >
                                    <div className="hr-department-label">
                                        <span>{department.name}</span>
                                        <strong>{department.count}</strong>
                                    </div>
                                    <div className="hr-progress-track">
                                        <div
                                            className="hr-progress-fill"
                                            style={{ width: `${(department.count / 43) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}

            {isVacancies && (
                <>
                    <div className="hr-summary-grid">
                        <div className="hr-summary-card">
                            <span>OPEN POSITIONS</span>
                            <strong>8</strong>
                        </div>
                        <div className="hr-summary-card">
                            <span>TOTAL VACANT SEATS</span>
                            <strong>18</strong>
                        </div>
                        <div className="hr-summary-card">
                            <span>CANDIDATES IN PIPELINE</span>
                            <strong>37</strong>
                        </div>
                        <div className="hr-summary-card">
                            <span>FILLED (ALL TIME)</span>
                            <strong>4</strong>
                        </div>
                    </div>

                    <section className="hr-department-panel">
                        <h2>Openings by Department</h2>
                        <div className="hr-department-list">
                            {vacancyDepartments.map((department) => (
                                <div
                                    className="hr-department-item"
                                    key={department.name}
                                >
                                    <div className="hr-department-label">
                                        <span>{department.name}</span>
                                        <strong>{department.count}</strong>
                                    </div>
                                    <div className="hr-progress-track">
                                        <div
                                            className="hr-progress-fill"
                                            style={{
                                                width: `${(department.count / 18) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}

            {(isEmployees || isVacancies) && (
                <section className="hr-records-section">

                    <div className="hr-filter-row">
                        <input
                            type="search"
                            className="hr-search-input"
                            placeholder="⌕  Search..."
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setPage(1);
                            }}
                        />

                        {isEmployees && (
                            <select
                                value={typeFilter}
                                onChange={(event) => {
                                    setTypeFilter(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="Filter by employee type"
                            >
                                <option value="All">Type: All</option>
                                <option value="On-Roll">On-Roll</option>
                                <option value="Contract">Contract</option>
                            </select>
                        )}

                        <select
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value);
                                setPage(1);
                            }}
                            aria-label="Filter by status"
                        >
                            <option value="All">Status: All</option>
                            {(isEmployees
                                ? ['Active', 'Inactive']
                                : ['Open', 'On Hold', 'Filled']
                            ).map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>

                        <select
                            value={departmentFilter}
                            onChange={(event) => {
                                setDepartmentFilter(event.target.value);
                                setPage(1);
                            }}
                            aria-label="Filter by department"
                        >
                            <option value="All">Dept.: All</option>
                            {[
                                'Executive',
                                'Sales',
                                'Finance',
                                'Service',
                                'Parts',
                                'HR',
                                'Ops',
                            ].map((department) => (
                                <option key={department} value={department}>
                                    {department}
                                </option>
                            ))}
                        </select>

                        <span className="hr-record-count">
                            {isEmployees ? 130 : 16 + extraVacancies.length}{' '}
                            records
                        </span>

                        {isVacancies && (
                            <button
                                type="button"
                                className="hr-primary-button"
                                onClick={openForm}
                            >
                                + Post Opening
                            </button>
                        )}
                    </div>


                    <div className="hr-table-wrapper">
                        {isEmployees ? (
                            <table className="hr-table">
                                <thead>
                                    <tr>
                                        <th>EMPLOYEE</th>
                                        <th>BRANCH</th>
                                        <th>TYPE</th>
                                        <th>ATTENDANCE</th>
                                        <th>TARGETS</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(visibleRecords as Employee[]).map(
                                        (employee) => (
                                            <tr key={employee.id}>
                                                <td>
                                                    <div className="hr-person-name">
                                                        {employee.name}
                                                    </div>
                                                    <div className="hr-secondary-text">
                                                        {employee.role}
                                                    </div>
                                                </td>
                                                <td>{employee.branch}</td>
                                                <td>
                                                    <span className="hr-type-badge">
                                                        {employee.type}
                                                    </span>
                                                </td>
                                                <td className="hr-center-cell">
                                                    {employee.attendance}%
                                                </td>
                                                <td className="hr-center-cell">
                                                    {employee.targets}%
                                                </td>
                                                <td>
                                                    <span
                                                        className={`hr-status-badge ${employee.status ===
                                                            'Active'
                                                            ? 'success'
                                                            : 'neutral'
                                                            }`}
                                                    >
                                                        ● {employee.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                    {visibleRecords.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="hr-empty-state"
                                            >
                                                No employees match your filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="hr-table">
                                <thead>
                                    <tr>
                                        <th>POSITION</th>
                                        <th>BRANCH</th>
                                        <th>OPENINGS</th>
                                        <th>FILLED</th>
                                        <th>TYPE</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(visibleRecords as Vacancy[]).map(
                                        (vacancy) => (
                                            <tr key={vacancy.id}>
                                                <td>
                                                    <div className="hr-person-name">
                                                        {vacancy.position}
                                                    </div>
                                                    <div className="hr-secondary-text">
                                                        {vacancy.department}
                                                    </div>
                                                </td>
                                                <td>{vacancy.branch}</td>
                                                <td className="hr-center-cell">
                                                    {vacancy.openings}
                                                </td>
                                                <td className="hr-center-cell">
                                                    {vacancy.filled}
                                                </td>
                                                <td>{vacancy.type}</td>
                                                <td>
                                                    <span
                                                        className={`hr-status-badge ${vacancy.status ===
                                                            'Open'
                                                            ? 'open'
                                                            : vacancy.status ===
                                                                'Filled'
                                                                ? 'success'
                                                                : 'warning'
                                                            }`}
                                                    >
                                                        ● {vacancy.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                    {visibleRecords.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="hr-empty-state"
                                            >
                                                No vacancies match your filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        <div className="hr-table-footer">
                            <span>
                                Page {safePage} of {totalPages}
                            </span>
                            <div className="hr-pagination">
                                <button
                                    type="button"
                                    disabled={safePage <= 1}
                                    onClick={() =>
                                        setPage((previous) =>
                                            Math.max(1, previous - 1)
                                        )
                                    }
                                >
                                    ← Prev
                                </button>
                                <button
                                    type="button"
                                    disabled={safePage >= totalPages}
                                    onClick={() =>
                                        setPage((previous) =>
                                            Math.min(totalPages, previous + 1)
                                        )
                                    }
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            )}


            {isHiringPipeline && (
                <section className="hr-hiring-section">
                    <div className="hr-recruitment-panel">
                        <div className="hr-panel-heading">
                            <h2>Recruitment Funnel</h2>
                            <span>Applied → Hired, end-to-end</span>
                        </div>

                        <div className="hr-hiring-stages">
                            {hiringStages.map((stage) => (
                                <div className="hr-hiring-stage" key={stage.name}>
                                    <span className="hr-hiring-stage-name">
                                        {stage.name}
                                    </span>

                                    <div className="hr-hiring-track">
                                        <div
                                            className="hr-hiring-fill"
                                            style={{
                                                width: `${(stage.count / 10) * 100}%`,
                                            }}
                                        >
                                            <strong>{stage.count}</strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <section className="hr-candidates-section">
                        <div className="hr-candidate-toolbar">
                            <input
                                type="search"
                                className="hr-search-input"
                                placeholder="⌕  Search..."
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                            />

                            <select
                                value={statusFilter}
                                onChange={(event) => {
                                    setStatusFilter(event.target.value);
                                    setPage(1);
                                }}
                                aria-label="Filter candidates by stage"
                            >
                                <option value="All">Stage: All</option>
                                {[
                                    'Applied',
                                    'Screening',
                                    'Interview Scheduled',
                                    'Interview Completed',
                                    'Offer Extended',
                                    'Offer Accepted',
                                    'Hired',
                                    'Rejected',
                                ].map((stage) => (
                                    <option key={stage} value={stage}>
                                        {stage}
                                    </option>
                                ))}
                            </select>

                            <span className="hr-record-count">
                                {candidates.filter((candidate) => {
                                    const matchesSearch =
                                        `${candidate.name} ${candidate.role} ${candidate.branch} ${candidate.source}`
                                            .toLowerCase()
                                            .includes(search.toLowerCase());

                                    const matchesStage =
                                        statusFilter === 'All' ||
                                        candidate.stage === statusFilter;

                                    return matchesSearch && matchesStage;
                                }).length === 12 && !search && statusFilter === 'All'
                                    ? '48 records'
                                    : candidates.filter((candidate) => {
                                        const matchesSearch =
                                            `${candidate.name} ${candidate.role} ${candidate.branch} ${candidate.source}`
                                                .toLowerCase()
                                                .includes(search.toLowerCase());

                                        const matchesStage =
                                            statusFilter === 'All' ||
                                            candidate.stage === statusFilter;

                                        return matchesSearch && matchesStage;
                                    }).length + ' records'}
                            </span>
                        </div>

                        <div className="hr-table-wrapper">
                            <table className="hr-table hr-candidates-table">
                                <thead>
                                    <tr>
                                        <th>CANDIDATE</th>
                                        <th>BRANCH</th>
                                        <th>SOURCE</th>
                                        <th>SCORE</th>
                                        <th>APPLIED</th>
                                        <th>STAGE</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {candidates
                                        .filter((candidate) => {
                                            const matchesSearch =
                                                `${candidate.name} ${candidate.role} ${candidate.branch} ${candidate.source}`
                                                    .toLowerCase()
                                                    .includes(search.toLowerCase());

                                            const matchesStage =
                                                statusFilter === 'All' ||
                                                candidate.stage === statusFilter;

                                            return matchesSearch && matchesStage;
                                        })
                                        .slice((page - 1) * 10, page * 10)
                                        .map((candidate) => (
                                            <tr key={candidate.id}>
                                                <td>
                                                    <div className="hr-person-name">
                                                        {candidate.name}
                                                    </div>
                                                    <div className="hr-secondary-text">
                                                        {candidate.role}
                                                    </div>
                                                </td>
                                                <td>{candidate.branch}</td>
                                                <td>{candidate.source}</td>
                                                <td>{candidate.score}/100</td>
                                                <td>{candidate.applied}</td>
                                                <td>
                                                    <span
                                                        className={`hr-candidate-stage ${candidate.stage.toLowerCase().replaceAll(' ', '-')}`}
                                                    >
                                                        ● {candidate.stage}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}

                                    {candidates.filter((candidate) => {
                                        const matchesSearch =
                                            `${candidate.name} ${candidate.role} ${candidate.branch} ${candidate.source}`
                                                .toLowerCase()
                                                .includes(search.toLowerCase());

                                        const matchesStage =
                                            statusFilter === 'All' ||
                                            candidate.stage === statusFilter;

                                        return matchesSearch && matchesStage;
                                    }).length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="hr-empty-state">
                                                    No candidates match your filters.
                                                </td>
                                            </tr>
                                        )}
                                </tbody>
                            </table>

                            <div className="hr-table-footer">
                                <span>Page {page} of {Math.max(1, Math.ceil(candidates.filter((candidate) => {
                                    const matchesSearch =
                                        `${candidate.name} ${candidate.role} ${candidate.branch} ${candidate.source}`
                                            .toLowerCase()
                                            .includes(search.toLowerCase());
                                    const matchesStage =
                                        statusFilter === 'All' ||
                                        candidate.stage === statusFilter;
                                    return matchesSearch && matchesStage;
                                }).length / 10))}</span>

                                <div className="hr-pagination">
                                    <button
                                        type="button"
                                        disabled={page <= 1}
                                        onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                                    >
                                        ← Prev
                                    </button>
                                    <button
                                        type="button"
                                        disabled={page >= Math.max(1, Math.ceil(candidates.filter((candidate) => {
                                            const matchesSearch =
                                                `${candidate.name} ${candidate.role} ${candidate.branch} ${candidate.source}`
                                                    .toLowerCase()
                                                    .includes(search.toLowerCase());
                                            const matchesStage =
                                                statusFilter === 'All' ||
                                                candidate.stage === statusFilter;
                                            return matchesSearch && matchesStage;
                                        }).length / 10))}
                                        onClick={() => setPage((previous) => previous + 1)}
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </section>
            )}


            {activeSection === 'Onboarding' && (
                <section className="hr-onboarding-section">
                    <div className="hr-onboarding-summary">
                        <div className="hr-onboarding-summary-card">
                            <span>IN ONBOARDING</span>
                            <strong>9</strong>
                        </div>

                        <div className="hr-onboarding-summary-card">
                            <span>COMPLETED</span>
                            <strong>0</strong>
                        </div>

                        <div className="hr-onboarding-summary-card">
                            <span>AVG. PROGRESS</span>
                            <strong>33%</strong>
                        </div>

                        <div className="hr-onboarding-summary-card">
                            <span>JOINING THIS MONTH</span>
                            <strong>9</strong>
                        </div>
                    </div>

                    <div className="hr-onboarding-list">
                        {[
                            {
                                name: 'Nikhil Kapoor',
                                role: 'Technician',
                                branch: 'Sector 18',
                                progress: 7,
                                joining: '07 Aug',
                            },
                            {
                                name: 'Manish Sen',
                                role: 'Branch Manager',
                                branch: 'Sector 18',
                                progress: 0,
                                joining: '16 Aug',
                            },
                            {
                                name: 'Anjali Bose',
                                role: 'Accounts Executive',
                                branch: 'Gachibowli',
                                progress: 0,
                                joining: '29 Aug',
                            },
                            {
                                name: 'Arjun Gupta',
                                role: 'Technician',
                                branch: 'Sector 18',
                                progress: 2,
                                joining: '29 Aug',
                            },
                            {
                                name: 'Farhan Sheikh',
                                role: 'Sales Executive',
                                branch: 'Vashi',
                                progress: 0,
                                joining: '04 Aug',
                            },
                            {
                                name: 'Aarav Subramaniam',
                                role: 'Branch Manager',
                                branch: 'Sector 18',
                                progress: 4,
                                joining: '04 Aug',
                            },
                            {
                                name: 'Divya Mehta',
                                role: 'Branch Manager',
                                branch: 'Sector 18',
                                progress: 5,
                                joining: '13 Aug',
                            },
                            {
                                name: 'Ayesha Sheikh',
                                role: 'Body Shop Technician',
                                branch: 'Vashi',
                                progress: 2,
                                joining: '19 Aug',
                            },
                            {
                                name: 'Deepa Gupta',
                                role: 'Service Advisor',
                                branch: 'Vashi',
                                progress: 4,
                                joining: '04 Aug',
                            },
                        ].map((employee) => (
                            <div
                                className="hr-onboarding-card"
                                key={employee.name}
                            >
                                <div className="hr-onboarding-card-heading">
                                    <div>
                                        <strong>{employee.name}</strong>
                                        <span>
                                            {' '}· {employee.role} · {employee.branch}
                                        </span>
                                    </div>

                                    <span className="hr-onboarding-status">
                                        ● In Progress
                                    </span>
                                </div>

                                <div className="hr-onboarding-progress-track">
                                    <div
                                        className="hr-onboarding-progress-fill"
                                        style={{
                                            width: `${(employee.progress / 8) * 100}%`,
                                        }}
                                    />
                                </div>

                                <p className="hr-onboarding-progress-text">
                                    {employee.progress} / 8 steps complete
                                    {' '}· Joining {employee.joining}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}


            {isOnRollDailyWages && (
                <section className="hr-wages-section">

                    <div className="hr-wages-summary">

                        <div className="hr-wages-card">
                            <span>ON-ROLL EMPLOYEES</span>
                            <h2>108</h2>
                        </div>

                        <div className="hr-wages-card">
                            <span>DAILY WAGE WORKERS</span>
                            <h2>16</h2>
                        </div>

                        <div className="hr-wages-card">
                            <span>CONTRACT STAFF</span>
                            <h2>{contractStaffRecords.length}</h2>
                        </div>

                        <div className="hr-wages-card">
                            <span>DAILY WAGE PAYOUT (MONTH)</span>
                            <h2>
                                ₹{(totalDailyWage / 100000).toFixed(2)} L
                            </h2>
                        </div>

                    </div>

                    <section className="hr-wages-panel">





                        <div className="hr-wages-heading-row">
                            <h2>On-Roll Employees</h2>
                            <span>
                                Monthly CTC-based salary: ₹1,05,000
                            </span>
                        </div>






                        <div className="hr-wages-search-row">
                            <div className="hr-wages-search-box">
                                <span className="hr-wages-search-icon">⌕</span>
                                <input
                                    type="text"
                                    className="hr-wages-search"
                                    placeholder="Search..."
                                    value={onRollSearch}
                                    onChange={(e) => {
                                        setOnRollSearch(e.target.value);
                                        setOnRollPage(1);
                                    }}
                                />
                            </div>

                            <span className="hr-wages-record-count">108 records</span>
                        </div>



                        <div className="hr-wages-table-wrapper">
                            <table className="hr-wages-table">
                                <thead>
                                    <tr>

                                        <th>Employee</th>
                                        <th>Branch</th>
                                        <th>Annual CTC</th>
                                        <th>Monthly Gross</th>
                                        <th>Status</th>

                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedOnRollEmployees.map((employee) => (

                                        <tr key={employee.id}>
                                            <td>
                                                <div className="hr-wages-employee-name">
                                                    {employee.name}
                                                </div>
                                                <div className="hr-wages-employee-designation">
                                                    {employee.designation}
                                                </div>
                                            </td>
                                            <td>{employee.branch}</td>
                                            <td>
                                                ₹{(employee.monthlySalary * 12).toLocaleString('en-IN')}
                                            </td>
                                            <td>
                                                ₹{employee.monthlySalary.toLocaleString('en-IN')}
                                            </td>
                                            <td>
                                                <span
                                                    className={`hr-wages-status ${employee.status === 'Active'
                                                        ? 'hr-wages-status-paid'
                                                        : 'hr-wages-status-pending'
                                                        }`}
                                                >
                                                    {employee.status}
                                                </span>
                                            </td>
                                        </tr>

                                    ))}
                                </tbody>
                            </table>

                            <div className="hr-wages-pagination">
                                <span>
                                    Page {onRollPage} of {onRollTotalPages}
                                </span>

                                <div className="hr-wages-pagination-buttons">
                                    <button
                                        type="button"
                                        disabled={onRollPage === 1}
                                        onClick={() =>
                                            setOnRollPage((current) => current - 1)
                                        }
                                    >
                                        Previous
                                    </button>

                                    <button
                                        type="button"
                                        disabled={onRollPage === onRollTotalPages}
                                        onClick={() =>
                                            setOnRollPage((current) => current + 1)
                                        }
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>

                        </div>
                    </section>

                    <section className="hr-wages-panel">

                        <div className="hr-wages-heading-row">
                            <h2>Daily Wage Register — Aug '26</h2>
                            <span>Attendance-based payout</span>
                        </div>

                        <div className="hr-wages-search-row">
                            <div className="hr-wages-search-box">
                                <span className="hr-wages-search-icon">⌕</span>
                                <input
                                    type="text"
                                    className="hr-wages-search"
                                    placeholder="Search..."
                                    value={dailyWageSearch}
                                    onChange={(e) => {
                                        setDailyWageSearch(e.target.value);
                                        setDailyWagePage(1);
                                    }}
                                />
                            </div>
                            <span className="hr-wages-record-count">
                                {filteredDailyWageRecords.length} records
                            </span>
                        </div>



                        <div className="hr-wages-table-wrapper">
                            <table className="hr-wages-table">
                                <thead>
                                    <tr>
                                        <th>Worker ID</th>
                                        <th>Name</th>
                                        <th>Branch</th>
                                        <th>Rate / Day</th>
                                        <th>Days Present</th>
                                        <th>Days Absent</th>
                                        <th>Gross Pay</th>
                                        <th>Payment Status</th>
                                    </tr>
                                </thead>
                                <tbody>

                                    {paginatedDailyWageRecords.map((record) => (

                                        <tr key={record.id}>
                                            <td>{record.id}</td>
                                            <td>{record.name}</td>
                                            <td>{record.branch}</td>
                                            <td>
                                                ₹{record.ratePerDay.toLocaleString('en-IN')}
                                            </td>
                                            <td>{record.daysPresent}</td>
                                            <td>{record.daysAbsent}</td>
                                            <td>
                                                ₹{(record.ratePerDay * record.daysPresent).toLocaleString('en-IN')}
                                            </td>

                                            <td>
                                                <span
                                                    className={`hr-wages-status ${record.paymentStatus === 'Paid'
                                                        ? 'hr-wages-status-paid'
                                                        : 'hr-wages-status-pending'
                                                        }`}
                                                >
                                                    {record.paymentStatus}
                                                </span>
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="hr-wages-pagination">
                                <span>
                                    Page {dailyWagePage} of {dailyWageTotalPages}
                                </span>

                                <div className="hr-wages-pagination-buttons">
                                    <button
                                        type="button"
                                        disabled={dailyWagePage === 1}
                                        onClick={() =>
                                            setDailyWagePage((current) => current - 1)
                                        }
                                    >
                                        Previous
                                    </button>

                                    <button
                                        type="button"
                                        disabled={dailyWagePage === dailyWageTotalPages}
                                        onClick={() =>
                                            setDailyWagePage((current) => current + 1)
                                        }
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>

                        </div>
                    </section>

                    <section className="hr-wages-panel">

                        <div className="hr-wages-heading-row">
                            <h2>Contract Staff</h2>
                            <span>6 records</span>
                        </div>

                        <div className="hr-wages-search-row">
                            <div className="hr-wages-search-box">
                                <span className="hr-wages-search-icon">⌕</span>
                                <input
                                    type="text"
                                    className="hr-wages-search"
                                    placeholder="Search..."
                                    value={contractStaffSearch}
                                    onChange={(e) => {
                                        setContractStaffSearch(e.target.value);
                                        setContractPage(1);
                                    }}
                                />
                            </div>
                        </div>



                        <div className="hr-wages-table-wrapper">
                            <table className="hr-wages-table">
                                <thead>
                                    <tr>
                                        <th>Contract ID</th>
                                        <th>Provider Name</th>
                                        <th>Branch</th>
                                        <th>Monthly Fee</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>

                                    {paginatedContractStaffRecords.map((staff) => (

                                        <tr key={staff.id}>
                                            <td>{staff.id}</td>
                                            <td>{staff.name}</td>
                                            <td>{staff.branch}</td>
                                            <td>
                                                ₹{staff.monthlyFee.toLocaleString('en-IN')}
                                            </td>

                                            <td>
                                                <span
                                                    className={`hr-wages-status ${staff.status === 'Active'
                                                        ? 'hr-wages-status-paid'
                                                        : 'hr-wages-status-pending'
                                                        }`}
                                                >
                                                    {staff.status}
                                                </span>
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="hr-wages-pagination">
                                <span>
                                    Page {contractPage} of {contractTotalPages}
                                </span>

                                <div className="hr-wages-pagination-buttons">
                                    <button
                                        type="button"
                                        disabled={contractPage === 1}
                                        onClick={() =>
                                            setContractPage((current) => current - 1)
                                        }
                                    >
                                        Previous
                                    </button>

                                    <button
                                        type="button"
                                        disabled={contractPage === contractTotalPages}
                                        onClick={() =>
                                            setContractPage((current) => current + 1)
                                        }
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>

                        </div>
                    </section>

                </section>
            )}

            {activeSection === 'Payroll Runs' && (
                <section className="hr-payroll-section">
                    <div className="hr-payroll-toolbar">
                        <label htmlFor="payroll-period">Payroll Run:</label>

                        <select
                            id="payroll-period"
                            value={payrollPeriod}
                            onChange={(event) => {
                                setPayrollPeriod(event.target.value);
                                setPayrollPage(1);
                            }}
                        >
                            <option value="Aug '26 — Processed">Aug '26 — Processed</option>
                            <option value="Jul '26 — Processed">Jul '26 — Processed</option>
                            <option value="Sep '26 — Draft">Sep '26 — Draft</option>
                        </select>

                        <button
                            type="button"
                            className="hr-payroll-process-button"
                            onClick={() =>
                                window.alert(
                                    `Process Run selected for ${payrollPeriod}. This demo is not connected to a payroll backend.`
                                )
                            }
                        >
                            Process Run
                        </button>
                    </div>

                    <div className="hr-payroll-summary">
                        <article className="hr-payroll-summary-card">
                            <span>EMPLOYEES PAID</span>
                            <strong>105</strong>
                        </article>

                        <article className="hr-payroll-summary-card">
                            <span>GROSS PAY</span>
                            <strong>₹77.06 L</strong>
                        </article>

                        <article className="hr-payroll-summary-card">
                            <span>DEDUCTIONS</span>
                            <strong>₹8.86 L</strong>
                        </article>

                        <article className="hr-payroll-summary-card">
                            <span>NET PAY</span>
                            <strong>₹68.20 L</strong>
                        </article>
                    </div>

                    <div className="hr-payroll-payslips">
                        <div className="hr-payroll-payslips-heading">
                            <h2>Payslips — {payrollPeriod.split(' — ')[0]}</h2>
                            <span>View the full payslip breakdown for any employee</span>
                        </div>

                        <div className="hr-payroll-search-row">
                            <input
                                type="text"
                                className="hr-payroll-search"
                                placeholder="⌕  Search..."
                                value={payrollSearch}
                                onChange={(event) => {
                                    setPayrollSearch(event.target.value);
                                    setPayrollPage(1);
                                }}
                                aria-label="Search payslips"
                            />

                            <span className="hr-payroll-record-count">
                                {payrollSearch.trim()
                                    ? filteredPayrollRecords.length
                                    : 105}{' '}
                                records
                            </span>
                        </div>

                        <div className="hr-payroll-table-wrapper">
                            <table className="hr-payroll-table">
                                <thead>
                                    <tr>
                                        <th>EMPLOYEE</th>
                                        <th>BRANCH</th>
                                        <th>GROSS</th>
                                        <th>DEDUCTIONS</th>
                                        <th>NET PAY</th>
                                        <th aria-label="Actions"></th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {visiblePayrollRecords.length > 0 ? (
                                        visiblePayrollRecords.map((record) => (
                                            <tr key={record.id}>
                                                <td>
                                                    <div className="hr-payroll-employee-name">
                                                        {record.name}
                                                    </div>
                                                    <div className="hr-payroll-employee-role">
                                                        {record.role}
                                                    </div>
                                                </td>
                                                <td>{record.branch}</td>
                                                <td>{formatPayrollMoney(record.gross)}</td>
                                                <td>{formatPayrollMoney(record.deductions)}</td>
                                                <td>{formatPayrollMoney(record.netPay)}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="hr-payroll-view-button"
                                                        onClick={() => setShowPayslip(record)}
                                                    >
                                                        View Payslip
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="hr-payroll-empty">
                                                No payslips found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            <div className="hr-payroll-pagination">
                                <span>
                                    Page {payrollPage} of {payrollTotalPages}
                                </span>

                                <div>
                                    <button
                                        type="button"
                                        disabled={payrollPage <= 1}
                                        onClick={() =>
                                            setPayrollPage((current) => current - 1)
                                        }
                                    >
                                        ← Prev
                                    </button>

                                    <button
                                        type="button"
                                        disabled={payrollPage >= payrollTotalPages}
                                        onClick={() =>
                                            setPayrollPage((current) => current + 1)
                                        }
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>


                    {showPayslip && (
                        <div
                            className="hr-payslip-overlay"
                            onClick={() => setShowPayslip(null)}
                        >
                            <aside
                                className="hr-payslip-drawer"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="hr-payslip-title"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="hr-payslip-header">
                                    <div>
                                        <h2 id="hr-payslip-title">{showPayslip.name}</h2>
                                        <p>Payslip — {payrollPeriod.split(' — ')[0]}</p>
                                    </div>

                                    <button
                                        type="button"
                                        className="hr-payslip-close"
                                        onClick={() => setShowPayslip(null)}
                                        aria-label="Close payslip"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="hr-payslip-content">
                                    <div className="hr-payslip-info-row">
                                        <span>Employee ID</span>
                                        <strong>EMP-{String(showPayslip.id).padStart(3, '0')}</strong>
                                    </div>

                                    <div className="hr-payslip-info-row">
                                        <span>Role</span>
                                        <strong>{showPayslip.role}</strong>
                                    </div>

                                    <div className="hr-payslip-info-row">
                                        <span>Branch</span>
                                        <strong>
                                            {showPayslip.branch}
                                            {showPayslip.branch === 'Whitefield'
                                                ? ' (Bengaluru)'
                                                : ''}
                                        </strong>
                                    </div>

                                    <section className="hr-payslip-detail-card">
                                        <h3>Earnings</h3>

                                        <div className="hr-payslip-detail-row">
                                            <span>Basic</span>
                                            <strong>
                                                {formatPayrollMoney(
                                                    Math.round(showPayslip.gross * 0.5)
                                                )}
                                            </strong>
                                        </div>

                                        <div className="hr-payslip-detail-row">
                                            <span>HRA</span>
                                            <strong>
                                                {formatPayrollMoney(
                                                    Math.round(showPayslip.gross * 0.2)
                                                )}
                                            </strong>
                                        </div>

                                        <div className="hr-payslip-detail-row">
                                            <span>Special Allowance</span>
                                            <strong>
                                                {formatPayrollMoney(
                                                    showPayslip.gross -
                                                    Math.round(showPayslip.gross * 0.5) -
                                                    Math.round(showPayslip.gross * 0.2)
                                                )}
                                            </strong>
                                        </div>

                                        <div className="hr-payslip-detail-row hr-payslip-total">
                                            <span>Gross Pay</span>
                                            <strong>{formatPayrollMoney(showPayslip.gross)}</strong>
                                        </div>
                                    </section>

                                    <section className="hr-payslip-detail-card">
                                        <h3>Deductions</h3>

                                        <div className="hr-payslip-detail-row">
                                            <span>Provident Fund (12% of Basic)</span>
                                            <strong>
                                                {formatPayrollMoney(
                                                    Math.round(
                                                        Math.round(showPayslip.gross * 0.5) * 0.12
                                                    )
                                                )}
                                            </strong>
                                        </div>

                                        <div className="hr-payslip-detail-row">
                                            <span>Professional Tax</span>
                                            <strong>{formatPayrollMoney(200)}</strong>
                                        </div>

                                        <div className="hr-payslip-detail-row">
                                            <span>TDS</span>
                                            <strong>
                                                {formatPayrollMoney(
                                                    Math.max(
                                                        0,
                                                        showPayslip.deductions -
                                                        Math.round(
                                                            Math.round(showPayslip.gross * 0.5) *
                                                            0.12
                                                        ) -
                                                        200
                                                    )
                                                )}
                                            </strong>
                                        </div>

                                        <div className="hr-payslip-detail-row hr-payslip-total">
                                            <span>Total Deductions</span>
                                            <strong>
                                                {formatPayrollMoney(showPayslip.deductions)}
                                            </strong>
                                        </div>
                                    </section>

                                    <div className="hr-payslip-net-pay">
                                        <span>Net Pay</span>
                                        <strong>{formatPayrollMoney(showPayslip.netPay)}</strong>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    )}

                </section>
            )}


            {activeSection === 'Leave' && (
                <section className="hr-leave-section">
                    <div className="hr-leave-summary">
                        <article className="hr-leave-summary-card">
                            <span>PENDING REQUESTS</span>
                            <strong>32</strong>
                        </article>
                        <article className="hr-leave-summary-card">
                            <span>APPROVED (ALL TIME)</span>
                            <strong>21</strong>
                        </article>
                        <article className="hr-leave-summary-card">
                            <span>ON LEAVE TODAY</span>
                            <strong>3</strong>
                        </article>
                        <article className="hr-leave-summary-card">
                            <span>TOTAL REQUESTS</span>
                            <strong>55</strong>
                        </article>
                    </div>

                    <div className="hr-leave-chart">
                        <h2>Requests by Leave Type</h2>

                        {[
                            { label: 'Casual Leave', count: 17 },
                            { label: 'Sick Leave', count: 16 },
                            { label: 'Earned Leave', count: 3 },
                            { label: 'Unpaid Leave', count: 19 },
                        ].map((item) => (
                            <div className="hr-leave-chart-item" key={item.label}>
                                <div className="hr-leave-chart-label">
                                    <span>{item.label}</span>
                                    <strong>{item.count}</strong>
                                </div>
                                <div className="hr-leave-progress-track">
                                    <div
                                        className="hr-leave-progress-fill"
                                        style={{ width: `${(item.count / 20) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="hr-leave-toolbar">
                        <input
                            type="text"
                            className="hr-leave-search"
                            placeholder="⌕  Search..."
                            aria-label="Search leave requests"
                            value={leaveSearch}
                            onChange={(event) => {
                                setLeaveSearch(event.target.value);
                                setLeavePage(1);
                            }}
                        />

                        <select
                            value={leaveStatusFilter}
                            aria-label="Filter by leave status"
                            onChange={(event) => {
                                setLeaveStatusFilter(event.target.value);
                                setLeavePage(1);
                            }}
                        >
                            <option value="All">Status: All</option>
                            <option value="Pending">Status: Pending</option>
                            <option value="Approved">Status: Approved</option>
                            <option value="Rejected">Status: Rejected</option>
                        </select>

                        <select
                            value={leaveTypeFilter}
                            aria-label="Filter by leave type"
                            onChange={(event) => {
                                setLeaveTypeFilter(event.target.value);
                                setLeavePage(1);
                            }}
                        >
                            <option value="All">Type: All</option>
                            <option value="Casual Leave">Casual Leave</option>
                            <option value="Sick Leave">Sick Leave</option>
                            <option value="Earned Leave">Earned Leave</option>
                            <option value="Unpaid Leave">Unpaid Leave</option>
                        </select>

                        <span className="hr-leave-record-count">
                            {filteredLeaveRequests.length} records
                        </span>
                    </div>

                    <div className="hr-leave-table-wrapper">
                        <table className="hr-leave-table">
                            <thead>
                                <tr>
                                    <th>EMPLOYEE</th>
                                    <th>BRANCH</th>
                                    <th>TYPE</th>
                                    <th>FROM</th>
                                    <th>DAYS</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>

                            <tbody>
                                {visibleLeaveRequests.length > 0 ? (
                                    visibleLeaveRequests.map((request) => (
                                        <tr key={request.id}>
                                            <td>{request.employee}</td>
                                            <td>{request.branch}</td>
                                            <td>{request.type}</td>
                                            <td>{request.from}</td>
                                            <td>{request.days}</td>
                                            <td>
                                                <span
                                                    className={`hr-leave-status hr-leave-status-${request.status.toLowerCase()}`}
                                                >
                                                    <span className="hr-leave-status-dot" />
                                                    {request.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="hr-leave-empty">
                                            No leave requests found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="hr-leave-pagination">
                            <span>
                                Page {leavePage} of {leaveTotalPages}
                            </span>

                            <div>
                                <button
                                    type="button"
                                    disabled={leavePage <= 1}
                                    onClick={() => setLeavePage((current) => current - 1)}
                                >
                                    ← Prev
                                </button>

                                <button
                                    type="button"
                                    disabled={leavePage >= leaveTotalPages}
                                    onClick={() => setLeavePage((current) => current + 1)}
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            )}


            {activeSection === 'Attendance' && (
                <section className="hr-attendance">
                    <div className="hr-attendance-metrics">
                        <div className="hr-attendance-metric">
                            <span>PRESENT TODAY</span>
                            <strong>101</strong>
                        </div>

                        <div className="hr-attendance-metric">
                            <span>LATE</span>
                            <strong>12</strong>
                        </div>

                        <div className="hr-attendance-metric">
                            <span>ABSENT</span>
                            <strong>14</strong>
                        </div>

                        <div className="hr-attendance-metric">
                            <span>ON LEAVE</span>
                            <strong>3</strong>
                        </div>
                    </div>


                    <div className="hr-attendance-chart-card">
                        <h3>Today's Attendance Mix</h3>

                        <div className="hr-attendance-chart-content">
                            <div className="hr-attendance-donut">
                                <div className="hr-attendance-donut-center">
                                    <strong>130</strong>
                                    <span>employees</span>
                                </div>
                            </div>

                            <div className="hr-attendance-legend">
                                <div>
                                    <span className="hr-attendance-legend-dot present"></span>
                                    <span>Present</span>
                                    <strong>101</strong>
                                </div>

                                <div>
                                    <span className="hr-attendance-legend-dot late"></span>
                                    <span>Late</span>
                                    <strong>12</strong>
                                </div>

                                <div>
                                    <span className="hr-attendance-legend-dot absent"></span>
                                    <span>Absent</span>
                                    <strong>14</strong>
                                </div>

                                <div>
                                    <span className="hr-attendance-legend-dot leave"></span>
                                    <span>On Leave</span>
                                    <strong>3</strong>
                                </div>
                            </div>
                        </div>
                    </div>



                    <div className="hr-attendance-toolbar">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={attendanceSearch}
                            onChange={(event) => {
                                setAttendanceSearch(event.target.value);
                                setAttendancePage(1);
                            }}
                        />

                        <select
                            value={attendanceStatus}
                            onChange={(event) => {
                                setAttendanceStatus(event.target.value);
                                setAttendancePage(1);
                            }}
                        >
                            <option value="All">Status: All</option>
                            <option value="Present">Present</option>
                            <option value="Late">Late</option>
                            <option value="Absent">Absent</option>
                            <option value="On Leave">On Leave</option>
                        </select>

                        <span className="hr-attendance-record-count">
                            {filteredAttendanceRecords.length} records
                        </span>
                    </div>


                    <div className="hr-attendance-table-wrapper">
                        <table className="hr-attendance-table">

                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Branch</th>
                                    <th>Check-in</th>
                                    <th>Check-out</th>
                                    <th>Status</th>
                                </tr>
                            </thead>


                            <tbody>
                                {paginatedAttendanceRecords.length > 0 ? (
                                    paginatedAttendanceRecords.map((record) => (
                                        <tr key={record.id}>
                                            <td>{record.employee}</td>
                                            <td>{record.branch}</td>
                                            <td>{record.checkIn}</td>
                                            <td>{record.checkOut}</td>
                                            <td>
                                                <span
                                                    className={`hr-attendance-status hr-attendance-status-${record.status
                                                        .toLowerCase()
                                                        .replace(' ', '-')}`}
                                                >
                                                    {record.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="hr-attendance-empty">
                                            No attendance records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>


                    <div className="hr-attendance-pagination">
                        <span className="hr-attendance-page-info">
                            Page {attendancePage} of {totalAttendancePages}
                        </span>

                        <div>
                            <button
                                disabled={attendancePage <= 1}
                                onClick={() =>
                                    setAttendancePage((page) => Math.max(1, page - 1))
                                }
                            >
                                ← Prev
                            </button>

                            <button
                                disabled={attendancePage >= totalAttendancePages}
                                onClick={() =>
                                    setAttendancePage((page) =>
                                        Math.min(totalAttendancePages, page + 1)
                                    )
                                }
                            >
                                Next →
                            </button>
                        </div>
                    </div>

                </section>
            )}


            {activeSection === 'Incentives & Commissions' && (
                <section className="hr-incentives-section">

                    {/* Summary cards */}
                    <div className="hr-incentive-summary">
                        <div className="hr-incentive-card">
                            <span>TOTAL CREDITED</span>
                            <strong>₹4.23 L</strong>
                        </div>

                        <div className="hr-incentive-card">
                            <span>PENDING PAYOUT</span>
                            <strong>4</strong>
                        </div>

                        <div className="hr-incentive-card">
                            <span>PAYOUT EVENTS</span>
                            <strong>56</strong>
                        </div>

                        <div className="hr-incentive-card">
                            <span>AVG. PAYOUT</span>
                            <strong>₹8.2K</strong>
                        </div>
                    </div>

                    {/* Payout chart */}
                    <div className="hr-incentive-payout-panel">
                        <h2>Payout by Type</h2>

                        <div className="hr-incentive-progress-item">
                            <div className="hr-incentive-progress-label">
                                <span>Sales Incentive</span>
                                <strong>₹3.35 L</strong>
                            </div>
                            <div className="hr-incentive-progress-track">
                                <div className="hr-incentive-progress-fill sales" />
                            </div>
                        </div>

                        <div className="hr-incentive-progress-item">
                            <div className="hr-incentive-progress-label">
                                <span>Finance Commission</span>
                                <strong>₹1.25 L</strong>
                            </div>
                            <div className="hr-incentive-progress-track">
                                <div className="hr-incentive-progress-fill finance" />
                            </div>
                        </div>
                    </div>

                    {/* Search and filters */}
                    <div className="hr-incentive-toolbar">
                        <input
                            type="text"
                            placeholder="⌕  Search..."
                            value={incentiveSearch}
                            onChange={(event) => {
                                setIncentiveSearch(event.target.value);
                                setIncentivePage(1);
                            }}
                        />

                        <select
                            value={incentiveType}
                            onChange={(event) => {
                                setIncentiveType(event.target.value);
                                setIncentivePage(1);
                            }}
                        >
                            <option value="All">Type: All</option>
                            <option value="Sales Incentive">Sales Incentive</option>
                            <option value="Finance Commission">Finance Commission</option>
                        </select>

                        <select
                            value={incentiveStatus}
                            onChange={(event) => {
                                setIncentiveStatus(event.target.value);
                                setIncentivePage(1);
                            }}
                        >
                            <option value="All">Status: All</option>
                            <option value="Credited">Credited</option>
                            <option value="Pending Payout">Pending Payout</option>
                        </select>

                        <span className="hr-incentive-record-count">
                            {filteredIncentives.length} records
                        </span>
                    </div>

                    {/* Incentive records table */}
                    <div className="hr-incentive-table-wrapper">
                        <table className="hr-incentive-table">
                            <thead>
                                <tr>
                                    <th>EMPLOYEE</th>
                                    <th>BRANCH</th>
                                    <th>TYPE</th>
                                    <th>BASIS</th>
                                    <th>AMOUNT</th>
                                    <th>DATE</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>

                            <tbody>
                                {visibleIncentives.length > 0 ? (
                                    visibleIncentives.map((record) => (
                                        <tr key={record.id}>
                                            <td>{record.employee}</td>
                                            <td>{record.branch}</td>
                                            <td>{record.type}</td>
                                            <td className="hr-incentive-basis">
                                                {record.basis}
                                            </td>
                                            <td className="hr-incentive-amount">
                                                {formatIncentiveMoney(record.amount)}
                                            </td>
                                            <td>{record.date}</td>
                                            <td>
                                                <span
                                                    className={`hr-incentive-status ${record.status === 'Credited'
                                                        ? 'credited'
                                                        : 'pending'
                                                        }`}
                                                >
                                                    <i />
                                                    {record.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="hr-incentive-empty">
                                            No incentive records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div className="hr-incentive-pagination">
                            <span>
                                Page {incentivePage} of {incentiveTotalPages}
                            </span>

                            <div>
                                <button
                                    type="button"
                                    disabled={incentivePage <= 1}
                                    onClick={() =>
                                        setIncentivePage((page) =>
                                            Math.max(1, page - 1)
                                        )
                                    }
                                >
                                    ← Prev
                                </button>

                                <button
                                    type="button"
                                    disabled={incentivePage >= incentiveTotalPages}
                                    onClick={() =>
                                        setIncentivePage((page) =>
                                            Math.min(
                                                incentiveTotalPages,
                                                page + 1
                                            )
                                        )
                                    }
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            )}






            {showForm && (
                <div
                    className="hr-modal-overlay"
                    onClick={() => setShowForm(false)}
                >

                    <form
                        className="hr-form-modal"
                        onSubmit={submitForm}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="hr-form-header">
                            <h2>
                                {isVacancies ? 'Post Opening' : 'Onboard Employee'}
                            </h2>

                            <button
                                type="button"
                                className="hr-close-button"
                                onClick={() => setShowForm(false)}
                                aria-label="Close form"
                            >
                                ×
                            </button>
                        </div>

                        {!isVacancies && (
                            <label className="hr-form-field">
                                Employee Name
                                <input
                                    value={formName}
                                    onChange={(event) => setFormName(event.target.value)}
                                    placeholder="e.g. Tanvi Joshi"
                                    required
                                />
                            </label>
                        )}

                        <label className="hr-form-field">
                            {isVacancies ? 'Job Title' : 'Role'}

                            <select
                                value={formRole}
                                onChange={(event) => setFormRole(event.target.value)}
                                required
                            >
                                {(
                                    isVacancies
                                        ? [
                                            'Sales Executive',
                                            'Service Advisor',
                                            'Technician',
                                            'Parts Executive',
                                            'Accounts Executive',
                                            'Branch Manager',
                                        ]
                                        : [
                                            'Super Admin',
                                            'Branch Manager',
                                            'Sales Manager',
                                            'Sales Executive',
                                            'Service Advisor',
                                            'Accounts Executive',
                                            'HR Executive',
                                        ]
                                ).map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="hr-form-field">
                            Branch
                            <select
                                value={formBranch}
                                onChange={(event) => setFormBranch(event.target.value)}
                                required
                            >
                                {[
                                    'Whitefield',
                                    'Sector 18',
                                    'Vashi',
                                    'Gachibowli',
                                ].map((branch) => (
                                    <option key={branch} value={branch}>
                                        {branch}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {isVacancies && (
                            <label className="hr-form-field">
                                No. of Openings
                                <input
                                    type="number"
                                    min="1"
                                    value={formOpenings}
                                    onChange={(event) =>
                                        setFormOpenings(Number(event.target.value))
                                    }
                                    required
                                />
                            </label>
                        )}

                        <div className="hr-form-actions">
                            <button
                                type="button"
                                className="hr-cancel-button"
                                onClick={() => setShowForm(false)}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="hr-primary-button"
                            >
                                {isVacancies ? 'Post Opening' : 'Onboard'}
                            </button>
                        </div>
                    </form>

                </div>
            )}
        </div>
    );
}

export default HRPayroll;
