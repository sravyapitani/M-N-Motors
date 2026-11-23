/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from 'react';
import { apiRequest, getStoredToken, setStoredToken, onUnauthorized } from '../lib/api';

export interface BranchInfo {
    id: string;
    code: string;
    name: string;
}

export interface AuthUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    department: string | null;
    roles: string[];
    permissions: string[];
    branches: BranchInfo[];
}

interface LoginResponse {
    accessToken: string;
    tokenType: string;
    expiresInSeconds: number;
    user: AuthUser;
}

interface AuthContextValue {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    selectedBranchId: string;
    setSelectedBranchId: (id: string) => void;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const USER_STORAGE_KEY = 'nexus_erp_user';
const BRANCH_STORAGE_KEY = 'nexus_erp_selected_branch';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setTokenState] = useState<string | null>(() => getStoredToken());
    const [user, setUser] = useState<AuthUser | null>(() => {
        try {
            const saved = sessionStorage.getItem(USER_STORAGE_KEY);
            return saved ? (JSON.parse(saved) as AuthUser) : null;
        } catch {
            return null;
        }
    });
    const [selectedBranchId, setSelectedBranchIdState] = useState<string>(() => {
        try {
            const savedBranch = sessionStorage.getItem(BRANCH_STORAGE_KEY);
            return savedBranch || 'ALL';
        } catch {
            return 'ALL';
        }
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const setSelectedBranchId = useCallback((id: string) => {
        setSelectedBranchIdState(id);
        try {
            sessionStorage.setItem(BRANCH_STORAGE_KEY, id);
        } catch {
            // ignore
        }
    }, []);

    // Ensure selectedBranchId is consistent with user's branch access
    useEffect(() => {
        if (!user?.branches || user.branches.length === 0) {
            setSelectedBranchIdState('ALL');
            return;
        }

        if (user.branches.length === 1) {
            const singleId = user.branches[0].id;
            setSelectedBranchIdState(singleId);
            try {
                sessionStorage.setItem(BRANCH_STORAGE_KEY, singleId);
            } catch {
                // ignore
            }
        } else {
            // Multiple branches (e.g. SYSTEM_ADMIN or Sanjeev Sir)
            // If current selected branch is not 'ALL' and not in user's branches, reset to 'ALL'
            if (selectedBranchId !== 'ALL' && !user.branches.some((b) => b.id === selectedBranchId)) {
                setSelectedBranchIdState('ALL');
                try {
                    sessionStorage.setItem(BRANCH_STORAGE_KEY, 'ALL');
                } catch {
                    // ignore
                }
            }
        }
    }, [user, selectedBranchId]);

    const logout = useCallback(() => {
        setStoredToken(null);
        setTokenState(null);
        setUser(null);
        setSelectedBranchIdState('ALL');
        try {
            sessionStorage.removeItem(USER_STORAGE_KEY);
            sessionStorage.removeItem(BRANCH_STORAGE_KEY);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onUnauthorized(() => {
            logout();
        });
        return unsubscribe;
    }, [logout]);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const data = await apiRequest<LoginResponse>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            setStoredToken(data.accessToken);
            setTokenState(data.accessToken);
            setUser(data.user);
            try {
                sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
            } catch {
                // ignore
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: Boolean(token && user),
                isLoading,
                selectedBranchId,
                setSelectedBranchId,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

