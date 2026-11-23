import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { useAuth } from "../../context/AuthContext";

type AccountUser = {
    name: string;
    email: string;
    password: string;
    role: string;
    initials: string;
    branchTag?: string;
    branchName?: string;
    avatarClass?: string;
};

const branchUsers: AccountUser[] = [
    {
        name: "Bharathi Kakinada",
        email: "bharathi.kkd@nexus.local",
        password: "ChooseATemporaryPassword",
        role: "Branch Head",
        initials: "BK",
        branchTag: "KKD",
        branchName: "Kakinada",
        avatarClass: "branch-avatar-kkd",
    },
    {
        name: "Dharshan Tanuku",
        email: "dharshan.tnk@nexus.local",
        password: "ChooseATemporaryPassword",
        role: "Branch Head",
        initials: "DT",
        branchTag: "TNK",
        branchName: "Tanuku",
        avatarClass: "branch-avatar-tnk",
    },
    {
        name: "Suresh Narasapuram",
        email: "suresh.nrp@nexus.local",
        password: "ChooseATemporaryPassword",
        role: "Branch Head",
        initials: "SN",
        branchTag: "NRP",
        branchName: "Narasapuram",
        avatarClass: "branch-avatar-nrp",
    },
    {
        name: "Swathi Eluru",
        email: "swathi.elr@nexus.local",
        password: "ChooseATemporaryPassword",
        role: "Branch Head",
        initials: "SE",
        branchTag: "ELR",
        branchName: "Eluru",
        avatarClass: "branch-avatar-elr",
    },
    {
        name: "Rahul Eluru",
        email: "rahul.elr@nexus.local",
        password: "ChooseATemporaryPassword",
        role: "Loan Officer",
        initials: "RE",
        branchTag: "ELR",
        branchName: "Eluru",
        avatarClass: "branch-avatar-lo",
    },
];

const headOfficeUsers: AccountUser[] = [
    {
        name: "Suresh Achanta",
        email: "admin@nexuserp.demo",
        password: "Admin@123",
        role: "Super Admin",
        initials: "SA",
    },
    {
        name: "Neha Kulkarni",
        email: "finance.manager@nexuserp.demo",
        password: "Finance@123",
        role: "Finance Manager",
        initials: "NK",
    },
    {
        name: "Rohan Patil",
        email: "finance.executive@nexuserp.demo",
        password: "Executive@123",
        role: "Finance Executive",
        initials: "RP",
    },
    {
        name: "Pooja Joshi",
        email: "hr.manager@nexuserp.demo",
        password: "HR@123",
        role: "HR Manager",
        initials: "PJ",
    },
    {
        name: "Kunal Shah",
        email: "vehicles@nexuserp.demo",
        password: "Vehicles@123",
        role: "Used Vehicles Executive",
        initials: "KS",
    },
    {
        name: "Riya Desai",
        email: "compliance@nexuserp.demo",
        password: "Compliance@123",
        role: "Compliance Officer",
        initials: "RD",
    },
];

export default function Login() {
    const navigate = useNavigate();
    const { login, isLoading } = useAuth();
    const [activeCategory, setActiveCategory] = useState<'branch' | 'roles'>('branch');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleLogin = async (userEmail: string, userPass: string) => {
        setError("");
        setSubmitting(true);
        try {
            await login(userEmail.trim().toLowerCase(), userPass);
            navigate('/dashboard', { replace: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Invalid email or password. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDemoClick = (user: AccountUser) => {
        setEmail(user.email);
        setPassword(user.password);
        handleLogin(user.email, user.password);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleLogin(email, password);
    };

    return (
        <main className="login-page">
            <div className="login-shell">
                <section className="login-form-panel">
                    <div className="login-form-container">
                        <div className="login-brand">
                            <div className="login-brand-mark">N</div>
                            <div className="login-brand-copy">
                                <h1>Nexus ERP</h1>
                                <p>DEALERSHIP PLATFORM</p>
                            </div>
                        </div>

                        <div className="login-form-heading">
                            <span className="login-welcome-label">WELCOME BACK</span>
                            <h2>Sign in to your account</h2>
                            <p>Enter your work credentials to access Nexus ERP.</p>
                        </div>

                        <form className="login-form" onSubmit={handleSubmit}>
                            <div className="login-field">
                                <label htmlFor="login-email">Work email</label>
                                <input
                                    id="login-email"
                                    type="email"
                                    placeholder="name@company.com"
                                    autoComplete="username"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                />
                            </div>

                            <div className="login-field">
                                <div className="login-password-label">
                                    <label htmlFor="login-password">Password</label>
                                    <button
                                        type="button"
                                        className="login-text-button"
                                        onClick={() =>
                                            alert(
                                                "Please contact your system administrator to reset your password."
                                            )
                                        }
                                    >
                                        Forgot password?
                                    </button>
                                </div>

                                <div className="login-password-input">
                                    <input
                                        id="login-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="login-show-password"
                                        onClick={() =>
                                            setShowPassword((previous) => !previous)
                                        }
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </div>

                            <label className="login-remember">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(event) => setRememberMe(event.target.checked)}
                                />
                                <span>Remember me</span>
                            </label>

                            {error && (
                                <p className="login-error" role="alert">
                                    {error}
                                </p>
                            )}

                            <button className="login-submit-button" type="submit" disabled={isLoading || submitting}>
                                {isLoading || submitting ? "Signing in..." : "Sign in"} <span aria-hidden="true">→</span>
                            </button>
                        </form>

                        <div className="login-divider">
                            <span />
                            <small>SECURE ACCESS</small>
                            <span />
                        </div>

                        <div className="login-security-note">
                            <span className="login-security-icon" aria-hidden="true">✓</span>
                            <p>
                                Protected access for authorised dealership users.
                            </p>
                        </div>

                        <p className="login-help-text">
                            Need access? Contact your system administrator.
                        </p>
                    </div>
                </section>

                <section className="login-demo-panel">
                    <div className="login-demo-heading">
                        <div className="login-quick-access-top">
                            <span className="login-demo-eyebrow">QUICK ACCESS</span>
                            <div className="login-tab-switcher">
                                <button
                                    type="button"
                                    className={`login-tab-btn ${activeCategory === 'branch' ? 'active' : ''}`}
                                    onClick={() => setActiveCategory('branch')}
                                >
                                    🏢 Branch Accounts ({branchUsers.length})
                                </button>
                                <button
                                    type="button"
                                    className={`login-tab-btn ${activeCategory === 'roles' ? 'active' : ''}`}
                                    onClick={() => setActiveCategory('roles')}
                                >
                                    👑 Head Office ({headOfficeUsers.length})
                                </button>
                            </div>
                        </div>
                        <h2>{activeCategory === 'branch' ? 'Branch accounts' : 'Demo accounts'}</h2>
                        <p>
                            {activeCategory === 'branch'
                                ? 'Sign in as a Branch Head or Loan Officer to access branch-specific operations.'
                                : 'Choose an account to explore its role-based dashboard.'}
                        </p>
                    </div>

                    <div className="login-demo-grid">
                        {(activeCategory === 'branch' ? branchUsers : headOfficeUsers).map((user, index) => (
                            <button
                                type="button"
                                className={`login-demo-card ${user.avatarClass ? '' : `login-demo-card-${index + 1}`}`}
                                key={user.email}
                                onClick={() => handleDemoClick(user)}
                                disabled={isLoading || submitting}
                                title={`Sign in as ${user.role} (${user.email})`}
                            >
                                <div className="login-demo-card-top">
                                    <div className={`login-demo-avatar ${user.avatarClass || ''}`}>
                                        {user.initials}
                                    </div>

                                    <div className="login-demo-user-info">
                                        <strong>{user.name}</strong>
                                        <span className="login-demo-role">
                                            {user.role}
                                            {user.branchTag && (
                                                <span className="login-branch-tag">{user.branchTag}</span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <span className="login-demo-email">{user.email}</span>

                                <span className="login-demo-action">
                                    Click to sign in
                                    <span className="login-demo-arrow" aria-hidden="true">→</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    <p className="login-demo-footer">
                        <span aria-hidden="true">ⓘ</span>
                        {activeCategory === 'branch'
                            ? 'Branch-scoped access · Data limited to designated branch'
                            : 'Temporary demo access · Six role-based accounts'}
                    </p>
                </section>
            </div>
        </main>
    );
}