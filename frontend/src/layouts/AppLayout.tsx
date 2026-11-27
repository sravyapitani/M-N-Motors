
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './AppLayout.css';
import ArtifactToolbar from '../components/ArtifactToolbar';
import { useAuth } from '../context/AuthContext';
import AICopilot from '../components/AICopilot';
import { getAllowedRoutes } from '../routes/roleRoutes';
import { PayoutAlertsBell, usePayoutAlertsCount } from '../modules/finance-loan/PayoutAlertsBell';

type AppLayoutProps = {
    children: ReactNode;
};

const navigationGroups = [
    {
        title: 'OVERVIEW',
        items: [
            { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
        ],
    },
    {
        title: 'FINANCE & ACCOUNTS',
        items: [
            { label: 'Finance & Loan Desk', href: '/finance-loan', icon: '💳' },
            { label: 'Finance & Accounting', href: '/finance-accounting', icon: '💰' },
            { label: 'TDS & TCS Compliance', href: '/tds-tcs', icon: '📄', badge: '9' },
        ],
    },
    {
        title: 'HUMAN RESOURCES',
        items: [
            { label: 'HR & Payroll', href: '/hr-payroll', icon: '👨‍💼' },
        ],
    },
    {
        title: 'EXCHANGE & USED VEHICLES',
        items: [
            { label: 'Exchange / Used Vehicles', href: '/exchange-vehicles', icon: '🔄' },
        ],
    },
];

function AppLayout({ children }: AppLayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();

    const { user, selectedBranchId, setSelectedBranchId, logout } = useAuth();
    const [searchText, setSearchText] = useState('');
    const [darkMode, setDarkMode] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const alertCount = usePayoutAlertsCount();

    const userRoles = user?.roles && user.roles.length > 0 ? user.roles : ['STAFF'];
    const primaryRole = userRoles[0];
    const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : 'User';
    const initials = user
        ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
        : 'U';

    const allowedRoutes = getAllowedRoutes(user?.roles);

    // If a user lands on a route they are not authorized for, redirect immediately to dashboard
    useEffect(() => {
        if (allowedRoutes && !allowedRoutes.has(location.pathname)) {
            navigate('/dashboard', { replace: true });
        }
    }, [allowedRoutes, location.pathname, navigate]);

    const handleLogout = () => {
        setShowProfileMenu(false);
        logout();
        navigate('/dashboard', { replace: true });
    };

    useEffect(() => {
        if (!showProfileMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
                setShowProfileMenu(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowProfileMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showProfileMenu]);

    const visibleGroups = navigationGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => !allowedRoutes || allowedRoutes.has(item.href)),
        }))
        .filter((group) => group.items.length > 0);

    const currentPage =
        navigationGroups
            .flatMap((group) => group.items)
            .find((item) => location.pathname === item.href)?.label
        ?? 'Dashboard';

    return (
        <>
            <ArtifactToolbar />
            <div className={`app-layout ${darkMode ? 'app-dark-mode' : ''}`}>
                <aside className="app-sidebar">
                    <a className="app-brand" href="/dashboard">
                        <span className="app-brand-icon">N</span>

                        <span className="app-brand-text">
                            <strong>Nexus ERP</strong>
                            <small>DEALERSHIP PLATFORM</small>
                        </span>
                    </a>

                    <nav className="app-navigation">
                        {visibleGroups.map((group) => (
                            <div className="nav-group" key={group.title}>
                                <p className="nav-group-title">{group.title}</p>

                                {group.items.map((item) => {
                                    const isActive =
                                        location.pathname === item.href ||
                                        (item.href === '/dashboard' &&
                                            location.pathname === '/');

                                    return (
                                        <a
                                            key={item.href}
                                            href={item.href}
                                            className={`nav-link ${isActive ? 'active' : ''
                                                }`}
                                        >
                                            <span className="nav-icon">
                                                {item.icon}
                                            </span>

                                            <span className="nav-label">
                                                {item.label}
                                            </span>

                                            {item.badge && (
                                                <span className="nav-badge">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </a>
                                    );
                                })}
                            </div>
                        ))}
                    </nav>
                </aside>

                <div className="app-main">
                    <header className="app-header">
                        <div className="header-breadcrumb">
                            <span>Nexus ERP</span>
                            <span className="breadcrumb-separator">/</span>
                            <strong>{currentPage}</strong>
                        </div>

                        <div className="header-controls">
                            <label className="global-search">
                                <span className="search-icon">⌕</span>

                                <input
                                    type="search"
                                    placeholder="Search customers, VIN, bookings..."
                                    value={searchText}
                                    onChange={(event) =>
                                        setSearchText(event.target.value)
                                    }
                                    aria-label="Search customers, VIN, and bookings"
                                />

                                {searchText && (
                                    <button
                                        type="button"
                                        className="clear-search"
                                        onClick={() => setSearchText('')}
                                        aria-label="Clear search"
                                    >
                                        ×
                                    </button>
                                )}
                            </label>

                            {user?.branches && user.branches.length > 1 ? (
                                <select
                                    className="header-select branch-select"
                                    value={selectedBranchId}
                                    onChange={(event) => setSelectedBranchId(event.target.value)}
                                    aria-label="Select branch"
                                >
                                    <option value="ALL">All Branches</option>
                                    {user.branches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                            ) : user?.branches && user.branches.length === 1 ? (
                                <div className="header-branch-fixed" title="Assigned Branch">
                                    <span className="branch-icon">🏢</span>
                                    <span className="branch-name">{user.branches[0].name}</span>
                                </div>
                            ) : null}

                            <button
                                type="button"
                                className="header-icon-button theme-button"
                                onClick={() => setDarkMode(!darkMode)}
                                title="Toggle theme"
                                aria-label="Toggle theme"
                            >
                                {darkMode ? '☀' : '◐'}
                            </button>

                            <div className="notification-wrapper">
                                <button
                                    type="button"
                                    className="header-icon-button notification-button"
                                    onClick={() =>
                                        setShowNotifications(!showNotifications)
                                    }
                                    aria-label="Toggle notifications"
                                    aria-expanded={showNotifications}
                                >
                                    🔔{alertCount > 0 && <span className="notification-dot" />}
                                </button>

                                {showNotifications && (
                                    <>
                                        <div
                                            className="notification-overlay"
                                            onClick={() => setShowNotifications(false)}
                                        />

                                        <aside
                                            className="notification-panel"
                                            aria-label="Notifications"
                                        >
                                            <div className="notification-panel-header">
                                                <div>
                                                    <h2>Notifications</h2>
                                                    <p>Recent alerts</p>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="notification-close-button"
                                                    onClick={() => setShowNotifications(false)}
                                                    aria-label="Close notifications"
                                                >
                                                    ×
                                                </button>
                                            </div>

                                            <div className="notification-list">
                                                <PayoutAlertsBell isOpen={showNotifications} />
                                                <div className="notification-item">
                                                    <span className="notification-icon">🚨</span>
                                                    <div>
                                                        <p>
                                                            RC Book scan flagged a used-vehicle intake as
                                                            High Risk — possible tampering
                                                        </p>
                                                        <small>12 min ago</small>
                                                    </div>
                                                </div>

                                                <div className="notification-item">
                                                    <span className="notification-icon">💰</span>
                                                    <div>
                                                        <p>Receivables over 60 days increased to ₹18.4L</p>
                                                        <small>38 min ago</small>
                                                    </div>
                                                </div>

                                                <div className="notification-item">
                                                    <span className="notification-icon">✅</span>
                                                    <div>
                                                        <p>TDS certificate generated and ready for download</p>
                                                        <small>1 hr ago</small>
                                                    </div>
                                                </div>

                                                <div className="notification-item">
                                                    <span className="notification-icon">🏢</span>
                                                    <div>
                                                        <p>
                                                            New finance application sanctioned — awaiting
                                                            disbursement
                                                        </p>
                                                        <small>2 hr ago</small>
                                                    </div>
                                                </div>

                                                <div className="notification-item">
                                                    <span className="notification-icon">👨‍💼</span>
                                                    <div>
                                                        <p>3 employees pending leave approval this week</p>
                                                        <small>3 hr ago</small>
                                                    </div>
                                                </div>

                                                <div className="notification-item">
                                                    <span className="notification-icon">📄</span>
                                                    <div>
                                                        <p>
                                                            GST 2A/2B reconciliation found 2 mismatched
                                                            vendor invoices
                                                        </p>
                                                        <small>5 hr ago</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </aside>
                                    </>
                                )}
                            </div>

                            <div className="user-profile-wrapper" ref={profileMenuRef}>
                                <button
                                    type="button"
                                    className="user-profile"
                                    onClick={() => setShowProfileMenu((prev) => !prev)}
                                    title={`Signed in as ${displayName}`}
                                    aria-label="User profile menu"
                                    aria-expanded={showProfileMenu}
                                    aria-haspopup="true"
                                >
                                    <span className="user-avatar">{initials}</span>

                                    <span className="user-details">
                                        <strong>{displayName}</strong>
                                        <small>{primaryRole}</small>
                                    </span>
                                </button>

                                {showProfileMenu && (
                                    <div className="user-profile-dropdown" role="menu">
                                        <div className="profile-dropdown-header">
                                            <strong className="profile-dropdown-name">{displayName}</strong>
                                            <span className="profile-dropdown-email">{user?.email || ''}</span>
                                            <span className="profile-dropdown-role">{primaryRole}</span>
                                        </div>
                                        <div className="profile-dropdown-divider" />
                                        <button
                                            type="button"
                                            className="profile-dropdown-signout"
                                            onClick={handleLogout}
                                            role="menuitem"
                                        >
                                            Sign out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    <main className="app-content">{children}</main>

                    <AICopilot />

                </div>
            </div>
        </>
    );
}

export default AppLayout;
