import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import Dashboard from '../modules/dashboard/Dashboard';
import FinanceLoan from '../modules/finance-loan/FinanceLoan';
import FinanceAccounting from '../modules/finance-accounting/FinanceAccounting';
import TDSCompliance from '../modules/tds-tcs/TDSCompliance';
import HRPayroll from '../modules/hr-payroll/HRPayroll';
import ExchangeVehicles from '../modules/exchange-vehicles/ExchangeVehicles';
import { useAuth } from '../context/AuthContext';
import { getAllowedRoutes } from './roleRoutes';

interface ProtectedRouteProps {
    path: string;
    children: ReactElement;
}

function ProtectedRoute({ path, children }: ProtectedRouteProps) {
    const { user } = useAuth();
    const allowed = getAllowedRoutes(user?.roles);

    if (allowed && !allowed.has(path)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
                path="/finance-loan"
                element={
                    <ProtectedRoute path="/finance-loan">
                        <FinanceLoan />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/finance-accounting"
                element={
                    <ProtectedRoute path="/finance-accounting">
                        <FinanceAccounting />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/tds-tcs"
                element={
                    <ProtectedRoute path="/tds-tcs">
                        <TDSCompliance />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/hr-payroll"
                element={
                    <ProtectedRoute path="/hr-payroll">
                        <HRPayroll />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/exchange-vehicles"
                element={
                    <ProtectedRoute path="/exchange-vehicles">
                        <ExchangeVehicles />
                    </ProtectedRoute>
                }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

export default AppRoutes;
