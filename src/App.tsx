import { useState, useEffect, type ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, NavLink, useLocation, Link } from 'react-router-dom';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  CalendarDays,
  Wallet,
  LibraryBig,
  Settings,
  Award,
  MessageSquare,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  ArrowRight,
  User,
  Landmark,
  Monitor,
  PanelLeftClose,
  Sun,
  Moon,
  Receipt as ReceiptIcon,
  Printer as PrinterIcon,
} from 'lucide-react';
import { StoreProvider, useStore } from './store';
import { type Role } from './data';
import { Button, Toast, Avatar } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { Attendance } from './pages/Attendance';
import { Coursework, Reports } from './pages/Academics';
import { Timetable, Resources, Certificates, Community } from './pages/Learning';
import { AdminFinanceDashboard, Finance, Payroll } from './pages/Finance';
import { SettingsPage, UsersPage, Audit } from './pages/Settings';
import { TeacherClassGuard } from './components/TeacherClassGuard';
import { ClassroomDetail } from './pages/ClassroomDetail';
import {
  AccountantDashboard,
  StudentFinanceList,
  PaymentRecorder,
  FeeManagement,
  ExpenditurePage,
  BatchReceiptPrinter,
} from './pages/Accountant';
import {
  StudentStream,
  StudentAssignments,
  AssignmentDetail,
  StudentFees,
  ReportCardView,
  StudentCertificates,
  StudentPerformanceTracking,
  StudentSchedule,
} from './pages/StudentPortal';
const nav = [
  {
    label: 'Overview',
    path: '/',
    icon: LayoutDashboard,
    roles: ['Administrator', 'Teacher', 'Student', 'Accountant'],
  },
  { label: 'Student directory', path: '/students', icon: Users, roles: ['Administrator'] },
  {
    label: 'Attendance',
    path: '/attendance',
    icon: ClipboardCheck,
    roles: ['Administrator', 'Teacher'],
  },
  {
    label: 'Coursework',
    path: '/coursework',
    icon: BookOpen,
    roles: ['Administrator', 'Teacher'],
  },
  {
    label: 'Report cards',
    path: '/reports',
    icon: ShieldCheck,
    roles: ['Administrator', 'Teacher'],
  },
  {
    label: 'Timetable',
    path: '/timetable',
    icon: CalendarDays,
    roles: ['Administrator', 'Teacher'],
  },
  {
    label: 'Resource library',
    path: '/resources',
    icon: LibraryBig,
    roles: ['Administrator', 'Teacher'],
  },
  {
    label: 'Certificates',
    path: '/certificates',
    icon: Award,
    roles: ['Administrator', 'Teacher'],
  },
  {
    label: 'Classroom',
    path: '/community',
    icon: MessageSquare,
    roles: ['Administrator', 'Teacher'],
  },
  {
    label: 'Financial treasury',
    path: '/finance',
    icon: Wallet,
    roles: ['Administrator', 'Accountant'],
  },
  { label: 'Payroll', path: '/payroll', icon: Landmark, roles: ['Administrator', 'Accountant'] },
  { label: 'Users & access', path: '/users', icon: Users, roles: ['Administrator'] },
  { label: 'Activity log', path: '/audit', icon: ShieldCheck, roles: ['Administrator'] },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['Administrator'] },
];
const accountantNav = [
  { label: 'Financial Intelligence', path: '/', icon: LayoutDashboard, roles: ['Accountant'] },
  {
    label: 'Fee Roster & Debtors',
    path: '/accountant/students',
    icon: Users,
    roles: ['Accountant'],
  },
  {
    label: 'Fee Structures & Categories',
    path: '/accountant/fees',
    icon: Settings,
    roles: ['Accountant'],
  },
  {
    label: 'Expenditure & Outflows',
    path: '/accountant/expenditures',
    icon: Landmark,
    roles: ['Accountant'],
  },
  { label: 'Payroll Manager', path: '/accountant/payroll', icon: Wallet, roles: ['Accountant'] },
  {
    label: 'Record Student Payment',
    path: '/accountant/payments/new',
    icon: ReceiptIcon,
    roles: ['Accountant'],
  },
  {
    label: 'Batch Receipts (58mm)',
    path: '/accountant/batch-receipts',
    icon: PrinterIcon,
    roles: ['Accountant'],
  },
];
const studentNav = [
  { label: 'Class Stream', path: '/student/stream', icon: MessageSquare, roles: ['Student'] },
  { label: 'My Assignments', path: '/student/assignments', icon: BookOpen, roles: ['Student'] },
  { label: 'Fees & Financials', path: '/student/fees', icon: Wallet, roles: ['Student'] },
  {
    label: 'Terminal Report Card',
    path: '/student/report-cards',
    icon: ShieldCheck,
    roles: ['Student'],
  },
  {
    label: 'Performance Tracking',
    path: '/student/performance',
    icon: ClipboardCheck,
    roles: ['Student'],
  },
  { label: 'My Certificates', path: '/student/certificates', icon: Award, roles: ['Student'] },
  { label: 'My Schedule', path: '/student/schedule', icon: CalendarDays, roles: ['Student'] },
];
function Login() {
  const { setRole, theme, toggleTheme } = useStore();
  const [selected, setSelected] = useState<Role>('Administrator');
  const choices: [Role, typeof Users, string][] = [
    ['Administrator', Users, 'Lead your school'],
    ['Teacher', BookOpen, 'Inspire every learner'],
    ['Student', User, 'Learn and grow'],
    ['Accountant', Wallet, 'Keep finances in order'],
  ];
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <GraduationCap />
          </span>
          <div>
            AYISATU OWEN<small>SCHOOLS</small>
          </div>
          <button
            className="icon-btn theme-toggle login-theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <div className="login-story-main">
          <span className="story-tag">ONE SCHOOL. ENDLESS POSSIBILITIES.</span>
          <h1>
            A little more
            <br />
            connected.
            <br />
            <em>A lot more possible.</em>
          </h1>
          <p>
            A thoughtful space for learning, teaching, and everything that makes your school thrive.
          </p>
          <div className="school-art" aria-hidden="true">
            <div className="art-ring" />
            <div className="art-building">
              <GraduationCap size={68} />
              <div className="art-windows">
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
            </div>
            <div className="art-card art-card-one">
              <ClipboardCheck /> Every day counts<span>Attendance, made simple</span>
            </div>
            <div className="art-card art-card-two">
              <Award /> Room to grow<span>Celebrate every achievement</span>
            </div>
          </div>
        </div>
        <div className="login-footer">
          Knowledge is Power <span>Est. for a brighter tomorrow</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <div className="eyebrow">WELCOME TO YOUR SCHOOL</div>
          <h2>Good to have you here.</h2>
          <p>Choose your workspace to get started.</p>
          <div className="role-grid">
            {choices.map(([role, Icon, description]) => (
              <button
                key={role}
                aria-pressed={selected === role}
                className={`role-card ${selected === role ? 'selected' : ''}`}
                onClick={() => setSelected(role)}
              >
                <span className="role-icon">
                  <Icon size={24} />
                </span>
                <strong>{role}</strong>
                <small>{description}</small>
                {selected === role && <span className="selected-dot" />}
              </button>
            ))}
          </div>
          <Button className="login-continue" onClick={() => setRole(selected)}>
            Explore as {selected}
            <ArrowRight size={18} />
          </Button>
          <div className="demo-note">
            <Monitor size={20} />
            <div>
              <strong>Your interactive school preview</strong>
              <p>
                Explore with sample data. Changes stay in this browser. No account or password
                needed.
              </p>
            </div>
          </div>
          <div className="login-help">
            Ayisatu Owen Schools <span>·</span> Information System & LMS
          </div>
        </div>
      </section>
    </main>
  );
}
export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: Role[];
}) {
  const { role, user } = useStore();
  if (!role || !user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
function Guard({ path, children }: { path: string; children: ReactNode }) {
  const allowedRoles = nav.find((item) => item.path === path)?.roles as Role[] | undefined;
  return <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>;
}
function Unauthorized() {
  return (
    <section className="access-restricted">
      <ShieldCheck size={42} />
      <h1>Access denied</h1>
      <p>Your current role does not have permission to open this page.</p>
      <Link className="btn btn-primary" to="/">
        Return to your workspace
      </Link>
    </section>
  );
}
function BottomNav({ role, onOpenMenu }: { role: Role; onOpenMenu: () => void }) {
  const links =
    role === 'Student'
      ? [
          { label: 'Home', path: '/student/stream', icon: LayoutDashboard },
          { label: 'Assignments', path: '/student/assignments', icon: BookOpen },
          { label: 'Fees', path: '/student/fees', icon: Wallet },
          { label: 'Schedule', path: '/student/schedule', icon: CalendarDays },
        ]
      : role === 'Accountant'
        ? [
            { label: 'Home', path: '/', icon: LayoutDashboard },
            { label: 'Students', path: '/accountant/students', icon: Users },
            { label: 'Payments', path: '/accountant/payments/new', icon: ReceiptIcon },
            { label: 'Fees', path: '/accountant/fees', icon: Wallet },
          ]
        : role === 'Teacher'
          ? [
              { label: 'Home', path: '/', icon: LayoutDashboard },
              { label: 'Coursework', path: '/coursework', icon: BookOpen },
              { label: 'Classroom', path: '/community', icon: MessageSquare },
              { label: 'Resources', path: '/resources', icon: LibraryBig },
            ]
          : [
              { label: 'Home', path: '/', icon: LayoutDashboard },
              { label: 'Students', path: '/admin/students', icon: Users },
              { label: 'Classroom', path: '/community', icon: MessageSquare },
              { label: 'Resources', path: '/resources', icon: LibraryBig },
            ];

  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      {links.map(({ label, path, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
          aria-label={label}
        >
          <Icon size={19} />
          <span>{label}</span>
        </NavLink>
      ))}
      <button type="button" className="bottom-nav-link" onClick={onOpenMenu} aria-label="Open menu">
        <Menu size={19} />
        <span>Menu</span>
      </button>
    </nav>
  );
}

function Shell() {
  const { role, setRole, data, me, toast, storageError, theme, toggleTheme } = useStore();
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  const location = useLocation();
  useEffect(() => {
    if (!mobile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobile(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobile]);
  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobile]);
  if (!role) return <Login />;
  const items = (
    role === 'Accountant' ? accountantNav : role === 'Student' ? studentNav : nav
  ).filter((n) => n.roles.includes(role));
  return (
    <div className={`app-shell ${compact ? 'compact' : ''}`}>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      {mobile && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setMobile(false)}
          aria-label="Close navigation menu"
        />
      )}
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <Link to="/" className="brand" onClick={() => setMobile(false)}>
          <span className="brand-icon">
            <GraduationCap size={27} />
          </span>
          <div>
            Ayisatu Owen<small>SCHOOLS · SIS & LMS</small>
          </div>
        </Link>
        <button
          aria-label="Close navigation"
          className="mobile-close icon-btn"
          onClick={() => setMobile(false)}
        >
          <X />
        </button>
        <div className="nav-caption">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {items.map(({ label, path, icon: Icon }, i) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              title={compact ? label : undefined}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''} ${i === 9 ? 'nav-divider' : ''}`
              }
              onClick={() => setMobile(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {path === location.pathname && <ChevronRight size={15} className="nav-arrow" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="term-card">
            <span className="live-dot" /> ACTIVE ACADEMIC TERM
            <strong>
              Term {data.settings.term} <span>·</span> {data.settings.year}
            </strong>
            <small>Growing together, every day.</small>
          </div>
          <button className="profile-button" onClick={() => setRole(null)}>
            <Avatar name={me} />
            <span>
              <strong>{me}</strong>
              <small>{role}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <button
              className="icon-btn desktop-collapse"
              aria-label="Toggle compact navigation"
              onClick={() => setCompact(!compact)}
            >
              <PanelLeftClose size={18} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{items.find((n) => n.path === location.pathname)?.label || 'Overview'}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-badge">
              <span />
              Demo workspace
            </span>
            <button
              className="icon-btn theme-toggle"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Link
              to={
                role === 'Accountant'
                  ? '/finance'
                  : role === 'Student'
                    ? '/student/stream'
                    : '/community'
              }
              aria-label="Open school updates"
              className="notification"
            >
              <Bell size={19} />
              <i />
            </Link>
            <Avatar name={me} />
          </div>
        </div>
        <main id="main-content" tabIndex={-1}>
          {storageError && (
            <div className="notice warning" role="alert">
              {storageError}
            </div>
          )}
          <Routes>
            <Route
              path="/"
              element={
                role === 'Accountant' ? (
                  <AccountantDashboard />
                ) : role === 'Student' ? (
                  <Navigate to="/student/stream" replace />
                ) : (
                  <Dashboard />
                )
              }
            />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route
              path="/classes/:classId"
              element={
                <TeacherClassGuard>
                  <ClassroomDetail />
                </TeacherClassGuard>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finance"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <AdminFinanceDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/governance"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <Students />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/teachers"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/classes"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <Community />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/classes/:classId/roster"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <ClassroomDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/timetable"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <Timetable />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <Audit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['Administrator']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/stream"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <StudentStream />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/assignments"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <StudentAssignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/assignments/:id"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <AssignmentDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/fees"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <StudentFees />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/report-cards"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <ReportCardView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/certificates"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <StudentCertificates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/performance"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <StudentPerformanceTracking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/schedule"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <StudentSchedule />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accountant/students"
              element={
                <ProtectedRoute allowedRoles={['Accountant', 'Administrator']}>
                  <StudentFinanceList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accountant/fees"
              element={
                <ProtectedRoute allowedRoles={['Accountant', 'Administrator']}>
                  <FeeManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accountant/expenditures"
              element={
                <ProtectedRoute allowedRoles={['Accountant', 'Administrator']}>
                  <ExpenditurePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accountant/payroll"
              element={
                <ProtectedRoute allowedRoles={['Accountant', 'Administrator']}>
                  <Payroll />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accountant/payments/new"
              element={
                <ProtectedRoute allowedRoles={['Accountant', 'Administrator']}>
                  <PaymentRecorder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accountant/batch-receipts"
              element={
                <ProtectedRoute allowedRoles={['Accountant', 'Administrator']}>
                  <BatchReceiptPrinter />
                </ProtectedRoute>
              }
            />
            {[
              ['/students', <Students />],
              ['/attendance', <Attendance />],
              ['/coursework', <Coursework />],
              ['/reports', <Reports />],
              ['/timetable', <Timetable />],
              ['/resources', <Resources />],
              ['/certificates', <Certificates />],
              ['/community', <Community />],
              ['/finance', <Finance />],
              ['/payroll', <Payroll />],
              ['/settings', <SettingsPage />],
              ['/users', <UsersPage />],
              ['/audit', <Audit />],
            ].map(([path, el]) => (
              <Route
                key={path as string}
                path={path as string}
                element={<Guard path={path as string}>{el}</Guard>}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="workspace-footer">
            <span>Ayisatu Owen Schools</span>
            <span>Made for brighter school days.</span>
          </footer>
        </main>
      </div>
      <Toast message={toast} />
      <BottomNav role={role} onOpenMenu={() => setMobile(true)} />
    </div>
  );
}
export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}
