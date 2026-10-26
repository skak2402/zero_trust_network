import { useMemo, useState, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpen, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Cpu, Download, FileClock, Fingerprint, LockKeyhole,
  Network, RotateCcw, Search, Shield, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles,
  Trash2, UserRound, X, Laptop, Database, Bell, LayoutDashboard, Users, Boxes, Settings2,
  Menu, CheckCheck, ArrowRight, CircleDot, CircleX, CircleCheck,
} from 'lucide-react';

type Role = 'Student' | 'Faculty' | 'IT Admin';
type User = { id: string; name: string; role: Role; active: boolean };
type Device = { id: string; name: string; registered: boolean; posture: string; networkSegment: string };
type Resource = { id: string; name: string; sensitivity: 'Low' | 'Medium' | 'High'; allowedRoles: Role[] };
type AccessRequest = { id: string; userId: string; deviceId: string; resourceId: string; unusualTime: boolean; failedAttempts: number; requestedAt: string };
type Policy = { unknownDeviceWeight: number; unusualTimeWeight: number; failedAttemptsWeight: number; sensitiveResourceWeight: number; lowThreshold: number; mediumThreshold: number };
type Decision = { riskScore: number; riskBand: 'Low' | 'Medium' | 'High'; outcome: 'Allow' | 'Step-up' | 'Deny'; reasons: string[]; evaluatedAt: string };
type AuditEvent = { id: string; user: string; device: string; resource: string; outcome: Decision['outcome']; riskScore: number; reasons: string[]; createdAt: string; role: Role };

const users: User[] = [
  { id: 'u1', name: 'Maya Chen', role: 'Student', active: true },
  { id: 'u2', name: 'Dr. Elias Brooks', role: 'Faculty', active: true },
  { id: 'u3', name: 'Jordan Rivera', role: 'Student', active: true },
  { id: 'u4', name: 'Nina Patel', role: 'IT Admin', active: true },
];
const devices: Device[] = [
  { id: 'd1', name: 'Maya · MacBook Air', registered: true, posture: 'Compliant', networkSegment: 'Campus Wi-Fi' },
  { id: 'd2', name: 'Elias · Personal laptop', registered: false, posture: 'Unknown', networkSegment: 'Guest network' },
  { id: 'd3', name: 'Jordan · iPhone 14', registered: true, posture: 'Compliant', networkSegment: 'Campus Wi-Fi' },
  { id: 'd4', name: 'Unknown endpoint', registered: false, posture: 'Unverified', networkSegment: 'Off-campus' },
  { id: 'd5', name: 'Nina · Admin workstation', registered: true, posture: 'Compliant', networkSegment: 'IT operations' },
];
const resources: Resource[] = [
  { id: 'r1', name: 'Student Portal', sensitivity: 'Low', allowedRoles: ['Student', 'Faculty', 'IT Admin'] },
  { id: 'r2', name: 'Faculty Research Drive', sensitivity: 'Medium', allowedRoles: ['Faculty', 'IT Admin'] },
  { id: 'r3', name: 'Campus Admin Console', sensitivity: 'High', allowedRoles: ['IT Admin'] },
  { id: 'r4', name: 'Registrar Records', sensitivity: 'High', allowedRoles: ['Faculty', 'IT Admin'] },
];
const initialRequests: AccessRequest[] = [
  { id: 'REQ-2048', userId: 'u1', deviceId: 'd1', resourceId: 'r1', unusualTime: false, failedAttempts: 0, requestedAt: 'Today · 10:42 AM' },
  { id: 'REQ-2049', userId: 'u2', deviceId: 'd2', resourceId: 'r2', unusualTime: false, failedAttempts: 0, requestedAt: 'Today · 10:48 AM' },
  { id: 'REQ-2050', userId: 'u3', deviceId: 'd3', resourceId: 'r3', unusualTime: false, failedAttempts: 0, requestedAt: 'Today · 11:03 AM' },
  { id: 'REQ-2051', userId: 'u1', deviceId: 'd4', resourceId: 'r4', unusualTime: true, failedAttempts: 3, requestedAt: 'Today · 2:17 AM' },
];
const defaults: Policy = { unknownDeviceWeight: 30, unusualTimeWeight: 20, failedAttemptsWeight: 30, sensitiveResourceWeight: 20, lowThreshold: 30, mediumThreshold: 60 };
const makeSampleEvents = (): AuditEvent[] => {
  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  return [
    { id: 'DEMO-001', user: 'Maya Chen', device: 'Maya · MacBook Air', resource: 'Student Portal', role: 'Student', outcome: 'Allow', riskScore: 0, reasons: ['No risk signals detected; identity, device, time, and resource match policy.'], createdAt: minutesAgo(4) },
    { id: 'DEMO-002', user: 'Nina Patel', device: 'Nina · Admin workstation', resource: 'Campus Admin Console', role: 'IT Admin', outcome: 'Allow', riskScore: 20, reasons: ['High-sensitivity resource requested (+20)'], createdAt: minutesAgo(9) },
    { id: 'DEMO-003', user: 'Dr. Elias Brooks', device: 'Elias · Personal laptop', resource: 'Registrar Records', role: 'Faculty', outcome: 'Step-up', riskScore: 50, reasons: ['Device is not registered (+30)', 'High-sensitivity resource requested (+20)'], createdAt: minutesAgo(15) },
    { id: 'DEMO-004', user: 'Jordan Rivera', device: 'Jordan · iPhone 14', resource: 'Student Portal', role: 'Student', outcome: 'Step-up', riskScore: 50, reasons: ['Request is outside normal campus hours (+20)', '2 recent failed sign-in attempts (+30)'], createdAt: minutesAgo(22) },
    { id: 'DEMO-005', user: 'Jordan Rivera', device: 'Jordan · iPhone 14', resource: 'Campus Admin Console', role: 'Student', outcome: 'Deny', riskScore: 20, reasons: ['Student role is not permitted for this resource — hard deny', 'High-sensitivity resource requested (+20)', 'Score does not override role-based resource permissions.'], createdAt: minutesAgo(31) },
    { id: 'DEMO-006', user: 'Maya Chen', device: 'Unknown endpoint', resource: 'Registrar Records', role: 'Student', outcome: 'Deny', riskScore: 100, reasons: ['Student role is not permitted for this resource — hard deny', 'Device is not registered (+30)', 'Request is outside normal campus hours (+20)', '3 recent failed sign-in attempts (+30)', 'High-sensitivity resource requested (+20)', 'Score does not override role-based resource permissions.'], createdAt: minutesAgo(42) },
  ];
};
const scenarios = [
  { id: 'student', label: 'Known student', sub: 'Registered device · Student Portal', icon: UserRound, request: initialRequests[0] },
  { id: 'unknown', label: 'Unknown device', sub: 'Faculty · unregistered laptop', icon: Cpu, request: initialRequests[1] },
  { id: 'role', label: 'Role mismatch', sub: 'Student · admin console', icon: LockKeyhole, request: initialRequests[2] },
  { id: 'suspicious', label: 'Off-hours + retries', sub: 'Sensitive records · 3 failures', icon: AlertTriangle, request: initialRequests[3] },
];
const safeRead = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
};
const readEvents = (): AuditEvent[] => {
  try {
    const saved = localStorage.getItem('zt-events');
    if (saved !== null) { localStorage.setItem('zt-events-initialized', 'true'); return JSON.parse(saved) as AuditEvent[]; }
    if (localStorage.getItem('zt-events-initialized') === 'true') return [];
    const samples = makeSampleEvents();
    localStorage.setItem('zt-events', JSON.stringify(samples));
    localStorage.setItem('zt-events-initialized', 'true');
    return samples;
  } catch { return makeSampleEvents(); }
};
const roleColor = (role: Role) => role === 'IT Admin' ? 'role-admin' : role === 'Faculty' ? 'role-faculty' : 'role-student';
const formatTime = (date: string) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (date: string) => new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
const persistEvents = (events: AuditEvent[]) => { localStorage.setItem('zt-events', JSON.stringify(events)); localStorage.setItem('zt-events-initialized', 'true'); };
const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/simulator', label: 'Request simulator', icon: ShieldCheck },
  { href: '/identity', label: 'Identity & devices', icon: Users },
  { href: '/resources', label: 'Campus resources', icon: Boxes },
  { href: '/policies', label: 'Risk policy', icon: SlidersHorizontal },
  { href: '/activity', label: 'Activity history', icon: FileClock },
  { href: '/alerts', label: 'Risk alerts', icon: Bell },
];

function App() {
  const [policy, setPolicy] = useState<Policy>(() => ({ ...defaults, ...safeRead<Partial<Policy>>('zt-policy', {}) }));
  const [events, setEvents] = useState<AuditEvent[]>(readEvents);
  const [request, setRequest] = useState<AccessRequest>(initialRequests[0]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [activeScenario, setActiveScenario] = useState('student');
  const [toast, setToast] = useState('');
  const [acknowledged, setAcknowledged] = useState<string[]>(() => safeRead('zt-alert-acks', []));
  const [location] = useLocation();
  const totals = useMemo(() => events.reduce((acc, e) => {
    acc.total++; if (e.outcome === 'Allow') acc.allowed++; if (e.outcome === 'Deny') acc.denied++; if (e.outcome === 'Step-up') acc.stepup++; return acc;
  }, { total: 0, allowed: 0, denied: 0, stepup: 0 }), [events]);
  const policyUpdate = (key: keyof Policy, value: number) => {
    const next = { ...policy, [key]: value }; setPolicy(next); localStorage.setItem('zt-policy', JSON.stringify(next));
  };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const chooseScenario = (id: string) => {
    const found = scenarios.find(item => item.id === id); if (!found) return;
    setActiveScenario(id); setRequest({ ...found.request }); setDecision(null);
  };
  const updateRequest = (key: keyof AccessRequest, value: string | boolean | number) => {
    setRequest(current => ({ ...current, [key]: value })); setDecision(null);
  };
  const evaluate = () => {
    const user = users.find(item => item.id === request.userId)!;
    const device = devices.find(item => item.id === request.deviceId)!;
    const resource = resources.find(item => item.id === request.resourceId)!;
    let riskScore = 0; const reasons: string[] = [];
    if (!device.registered) { riskScore += policy.unknownDeviceWeight; reasons.push(`Device is not registered (+${policy.unknownDeviceWeight})`); }
    if (request.unusualTime) { riskScore += policy.unusualTimeWeight; reasons.push(`Request is outside normal campus hours (+${policy.unusualTimeWeight})`); }
    if (request.failedAttempts > 0) { riskScore += policy.failedAttemptsWeight; reasons.push(`${request.failedAttempts} recent failed sign-in attempts (+${policy.failedAttemptsWeight})`); }
    if (resource.sensitivity === 'High') { riskScore += policy.sensitiveResourceWeight; reasons.push(`High-sensitivity resource requested (+${policy.sensitiveResourceWeight})`); }
    riskScore = Math.min(100, riskScore);
    const roleDenied = !resource.allowedRoles.includes(user.role);
    const riskBand: Decision['riskBand'] = riskScore <= policy.lowThreshold ? 'Low' : riskScore <= policy.mediumThreshold ? 'Medium' : 'High';
    let outcome: Decision['outcome'] = riskBand === 'Low' ? 'Allow' : riskBand === 'Medium' ? 'Step-up' : 'Deny';
    if (roleDenied) { outcome = 'Deny'; reasons.unshift(`${user.role} role is not permitted for this resource — hard deny`); }
    if (!reasons.length) reasons.push('No risk signals detected; identity, device, time, and resource match policy.');
    if (roleDenied) reasons.push('Score does not override role-based resource permissions.');
    const evaluatedAt = new Date().toISOString();
    const result: Decision = { riskScore, riskBand, outcome, reasons, evaluatedAt };
    setDecision(result);
    const event: AuditEvent = { id: `EVT-${Date.now()}`, user: user.name, device: device.name, resource: resource.name, role: user.role, outcome, riskScore, reasons, createdAt: evaluatedAt };
    setEvents(previous => { const next = [event, ...previous]; persistEvents(next); return next; });
  };
  const clearHistory = () => {
    if (window.confirm('Clear all simulated event history? This cannot be undone.')) {
      setEvents([]); persistEvents([]); notify('Event history cleared. Samples will not return.');
    }
  };
  const resetPolicy = () => { setPolicy(defaults); localStorage.setItem('zt-policy', JSON.stringify(defaults)); notify('Policy reset to teaching defaults.'); };
  const acknowledge = (id: string) => {
    setAcknowledged(current => { const next = current.includes(id) ? current : [...current, id]; localStorage.setItem('zt-alert-acks', JSON.stringify(next)); return next; });
  };
  const countAlerts = events.filter(e => e.outcome === 'Deny' || e.riskScore >= policy.mediumThreshold).length;
  const routeTitle = navItems.find(item => item.href === location)?.label ?? 'Campus policy lab';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" data-testid="link-brand">
          <div className="brand-mark"><Network size={19} strokeWidth={2.2} /></div>
          <div><div className="brand-name">NORTHFIELD<span> / IT</span></div><div className="brand-caption">CAMPUS NETWORK LAB</div></div>
        </Link>
        <div className="sidebar-label">LEARNING CONSOLE</div>
        <nav className="side-nav" aria-label="Primary navigation">
          {navItems.map(item => {
            const Icon = item.icon; const active = item.href === location;
            return <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} data-testid={`link-nav-${item.href === '/' ? 'overview' : item.href.slice(1)}`}>
              <Icon size={17} /><span>{item.label}</span>{item.href === '/alerts' && countAlerts > 0 && <span className="nav-count">{countAlerts}</span>}
            </Link>;
          })}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-label">LAB STATUS</div>
        <div className="status-card"><div className="status-top"><span className="status-dot" /> SIMULATION ACTIVE</div><p>All decisions run locally with synthetic campus data.</p><div className="status-foot"><span>NETWORK TRAFFIC</span><strong>NOT CONNECTED</strong></div></div>
        <div className="sidebar-bottom"><BookOpen size={15} /><span>Teaching environment</span><span className="mono">v1.0</span></div>
      </aside>
      <main className="main-area topo-grid">
        <header className="topbar">
          <div className="crumb"><span>Campus IT</span><span className="crumb-slash">/</span><strong>{routeTitle}</strong></div>
          <div className="topbar-right"><span className="session-tag"><span className="status-dot" /> LOCAL SESSION</span><div className="avatar">IT</div></div>
        </header>
        <div className="page-wrap">
          <Switch>
            <Route path="/"><Overview events={events} totals={totals} policy={policy} /></Route>
            <Route path="/simulator"><Simulator request={request} decision={decision} activeScenario={activeScenario} onChoose={chooseScenario} onUpdate={updateRequest} onEvaluate={evaluate} policy={policy} /></Route>
            <Route path="/identity"><IdentityPage /></Route>
            <Route path="/resources"><ResourcesPage /></Route>
            <Route path="/policies"><PolicyPage policy={policy} onChange={policyUpdate} onReset={resetPolicy} /></Route>
            <Route path="/activity"><ActivityPage events={events} onClear={clearHistory} /></Route>
            <Route path="/alerts"><AlertsPage events={events} acknowledged={acknowledged} onAcknowledge={acknowledge} mediumThreshold={policy.mediumThreshold} /></Route>
            <Route component={NotFound} />
          </Switch>
          <footer className="page-footer"><span>NORTHFIELD UNIVERSITY <span className="foot-sep">/</span> IT OPERATIONS TEACHING LAB</span><span>Zero Trust is a design principle, not a product.</span></footer>
        </div>
      </main>
      {toast && <div className="toast-message" role="status" data-testid="toast-message"><CheckCircle2 size={16} />{toast}</div>}
    </div>
  );
}

function PageHeading({ kicker, title, italic, copy, action }: { kicker: string; title: string; italic?: string; copy: string; action?: ReactNode }) {
  return <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {kicker} <span className="eyebrow-dot">·</span> SYNTHETIC DATASET</div><h1>{title}{italic && <> <em>{italic}</em></>}</h1><p className="heading-copy">{copy}</p></div>{action ?? <div className="heading-badge"><span className="badge-icon"><Fingerprint size={19} /></span><div><b>ZERO TRUST</b><small>Never trust. Always verify.</small></div></div>}</section>;
}
function PanelTitle({ number, title, sub, action }: { number?: string; title: string; sub?: string; action?: ReactNode }) {
  return <div className="panel-heading"><div>{number && <span className="section-number">{number}</span>}<div><h2>{title}</h2>{sub && <p>{sub}</p>}</div></div>{action}</div>;
}
function Metric({ icon, label, value, detail, color, testid }: { icon: ReactNode; label: string; value: number; detail: string; color: string; testid: string }) {
  return <div className="metric-card" data-testid={testid}><div className={`metric-icon ${color}`}>{icon}</div><div className="metric-main"><span>{label}</span><strong>{value}</strong></div><small>{detail}</small></div>;
}
function OutcomeBadge({ outcome }: { outcome: Decision['outcome'] }) {
  return <span className={`outcome-badge outcome-${outcome.toLowerCase().replace('-', '')}`} data-testid={`status-outcome-${outcome.toLowerCase().replace('-', '')}`}><i />{outcome}</span>;
}
function TableEmpty({ title, copy }: { title: string; copy: string }) {
  return <div className="log-empty"><div className="log-empty-icon"><FileClock size={20} /></div><b>{title}</b><p>{copy}</p></div>;
}
function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-link" data-testid={`link-${href.slice(1) || 'overview'}-more`}>{children}<ArrowRight size={14} /></Link>;
}

function Overview({ events, totals, policy }: { events: AuditEvent[]; totals: { total: number; allowed: number; denied: number; stepup: number }; policy: Policy }) {
  const alerts = events.filter(e => e.outcome === 'Deny' || e.riskScore >= policy.mediumThreshold).slice(0, 4);
  const recent = events.slice(0, 5);
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const cutoff = Date.now() - (6 - index) * 10 * 60_000;
    const count = events.filter(event => Date.parse(event.createdAt) >= cutoff && Date.parse(event.createdAt) < cutoff + 10 * 60_000).length;
    return { label: `${(6 - index) * 10}m`, count };
  });
  const max = Math.max(1, ...buckets.map(b => b.count));
  return <>
    <PageHeading kicker="OPERATIONS OVERVIEW" title="Access," italic="by design." copy="A living view of how synthetic campus identities, devices, and policies shape access decisions." />
    <section className="metrics" aria-label="Decision totals">
      <Metric icon={<Activity size={17} />} label="EVALUATED" value={totals.total} detail="event history" color="teal" testid="metric-evaluated" />
      <Metric icon={<CheckCircle2 size={17} />} label="ALLOWED" value={totals.allowed} detail="policy matched" color="green" testid="metric-allowed" />
      <Metric icon={<ShieldAlert size={17} />} label="STEP-UP" value={totals.stepup} detail="additional check" color="amber" testid="metric-stepup" />
      <Metric icon={<X size={17} />} label="DENIED" value={totals.denied} detail="policy denied" color="red" testid="metric-denied" />
    </section>
    <div className="overview-grid">
      <section className="panel trend-panel">
        <PanelTitle number="01" title="Decision pulse" sub="Recent simulated activity · 10 minute windows" action={<span className="sim-tag"><span /> LOCAL HISTORY</span>} />
        <div className="trend-content" data-testid="activity-trend">
          <div className="trend-chart">{buckets.map((bucket, i) => <div className="trend-column" key={bucket.label}><span className="trend-count">{bucket.count || ''}</span><div className="trend-bar-wrap"><i style={{ height: `${Math.max(7, bucket.count / max * 100)}%` }} className={i === 5 ? 'current' : ''} /></div><small>{bucket.label}</small></div>)}</div>
          <div className="outcome-breakdown"><span><i className="key-allow" />Allow <b>{totals.allowed}</b></span><span><i className="key-step" />Step-up <b>{totals.stepup}</b></span><span><i className="key-deny" />Deny <b>{totals.denied}</b></span></div>
        </div>
      </section>
      <section className="panel alert-preview">
        <PanelTitle number="02" title="Needs a closer look" sub="Denied or elevated-risk decisions" action={<SectionLink href="/alerts">All alerts</SectionLink>} />
        {alerts.length ? <div className="preview-list">{alerts.slice(0, 3).map(event => <Link key={event.id} href="/activity" className="preview-row" data-testid={`link-alert-event-${event.id}`}><span className={`preview-icon ${event.outcome === 'Deny' ? 'deny' : 'step'}`}><AlertTriangle size={15} /></span><span className="preview-main"><b>{event.user}</b><small>{event.resource} · risk {event.riskScore}</small></span><OutcomeBadge outcome={event.outcome} /><ArrowUpRight size={14} className="preview-arrow" /></Link>)}</div> : <TableEmpty title="Nothing elevated" copy="Higher-risk or denied events will appear here." />}
      </section>
    </div>
    <section className="panel recent-panel">
      <PanelTitle number="03" title="Recent decisions" sub="Latest events across the local history" action={<SectionLink href="/activity">Full history</SectionLink>} />
      {recent.length ? <EventTable events={recent} compact /> : <TableEmpty title="No decisions yet" copy="Run a request in the simulator to see a decision here." />}
      <div className="overview-footer-note"><CircleHelp size={14} /> This educational model is synthetic. It does not inspect or enforce network access.</div>
    </section>
    <section className="quick-links"><div><span className="quick-kicker">CONTINUE THE LAB</span><h2>Test a policy idea.</h2><p>Change one signal at a time, then compare how the decision moves.</p></div><SectionLink href="/simulator">Open request simulator</SectionLink></section>
  </>;
}

function Simulator({ request, decision, activeScenario, onChoose, onUpdate, onEvaluate, policy }: { request: AccessRequest; decision: Decision | null; activeScenario: string; onChoose: (id: string) => void; onUpdate: (key: keyof AccessRequest, value: string | boolean | number) => void; onEvaluate: () => void; policy: Policy }) {
  const user = users.find(item => item.id === request.userId)!;
  const device = devices.find(item => item.id === request.deviceId)!;
  const resource = resources.find(item => item.id === request.resourceId)!;
  return <>
    <PageHeading kicker="REQUEST SIMULATOR" title="Make a request." italic="Read the result." copy="Change the synthetic context, evaluate it against the local policy, and inspect every contributing signal." />
    <section className="scenario-section">
      <div className="section-head"><div><span className="section-number">01</span><h2>Start with a scenario</h2></div><span className="section-hint"><Sparkles size={13} /> FOUR TEACHING EXAMPLES</span></div>
      <div className="scenario-grid">{scenarios.map(item => { const Icon = item.icon; return <button key={item.id} className={`scenario-chip ${activeScenario === item.id ? 'selected' : ''}`} onClick={() => onChoose(item.id)} data-testid={`scenario-${item.id}`}><span className="scenario-icon"><Icon size={17} /></span><span className="scenario-text"><b>{item.label}</b><small>{item.sub}</small></span><ArrowDownRight className="scenario-arrow" size={15} /></button>; })}</div>
    </section>
    <div className="workspace-grid">
      <section className="panel request-panel"><PanelTitle number="02" title="Access request" sub="Adjust details, then evaluate the local policy." action={<span className="request-id mono" data-testid="request-id">{request.id}</span>} />
        <div className="request-form">
          <Field label="IDENTITY" icon={<UserRound size={14} />}><select value={request.userId} onChange={e => onUpdate('userId', e.target.value)} data-testid="select-user">{users.map(item => <option key={item.id} value={item.id}>{item.name} · {item.role}</option>)}</select></Field>
          <Field label="DEVICE" icon={<Cpu size={14} />}><select value={request.deviceId} onChange={e => onUpdate('deviceId', e.target.value)} data-testid="select-device">{devices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="RESOURCE" icon={<LockKeyhole size={14} />}><select value={request.resourceId} onChange={e => onUpdate('resourceId', e.target.value)} data-testid="select-resource">{resources.map(item => <option key={item.id} value={item.id}>{item.name} · {item.sensitivity} sensitivity</option>)}</select></Field>
          <div className="context-row"><label className="toggle-field"><span><Clock3 size={14} /> Unusual time</span><input type="checkbox" checked={request.unusualTime} onChange={e => onUpdate('unusualTime', e.target.checked)} data-testid="toggle-unusual-time" /><i /></label><label className="failed-field"><span>FAILED ATTEMPTS</span><div className="stepper"><button onClick={() => onUpdate('failedAttempts', Math.max(0, request.failedAttempts - 1))} aria-label="Decrease failed attempts" data-testid="button-attempt-decrease">−</button><b className="mono" data-testid="value-failed-attempts">{request.failedAttempts}</b><button onClick={() => onUpdate('failedAttempts', Math.min(9, request.failedAttempts + 1))} aria-label="Increase failed attempts" data-testid="button-attempt-increase">+</button></div></label></div>
          <div className="entity-strip"><div className="entity"><span className="entity-key">ROLE</span><span className={`role-pill ${roleColor(user.role)}`}>{user.role}</span></div><div className="entity"><span className="entity-key">DEVICE TRUST</span><span className={device.registered ? 'trust-good' : 'trust-unknown'}><i />{device.registered ? 'Registered' : 'Unregistered'}</span></div><div className="entity"><span className="entity-key">SEGMENT</span><span className="segment-value">{device.networkSegment}</span></div></div>
          <div className="resource-permission-note"><span>ROLE ACCESS</span>{resource.allowedRoles.includes(user.role) ? <b className="permission-good"><Check size={13} /> Permitted by resource matrix</b> : <b className="permission-deny"><X size={13} /> Role mismatch · hard deny</b>}</div>
          <button className="evaluate-button" onClick={onEvaluate} data-testid="button-evaluate"><Shield size={17} /> Evaluate access <span className="button-end">RUN SIMULATION <ArrowUpRight size={14} /></span></button>
          <div className="safe-note"><CircleHelp size={13} /> Simulated only. No network access is inspected, changed, or enforced.</div>
        </div>
      </section>
      <section className={`panel decision-panel ${decision ? 'has-result fade-in' : ''}`} aria-live="polite"><PanelTitle number="03" title="Decision explanation" sub="Transparent reasoning, no black boxes." action={<span className="sim-tag"><span /> SIMULATED</span>} />
        {!decision ? <div className="empty-decision" data-testid="decision-empty"><div className="empty-orbit"><ShieldCheck size={26} /></div><b>Ready to evaluate</b><p>Run a request to see its outcome and the policy signals that contributed.</p><div className="empty-rule"><span /> WAITING FOR REQUEST <span /></div></div> : <DecisionResult decision={decision} policy={policy} resource={resource} />}
      </section>
    </div>
    <div className="learning-note"><BookOpen size={16} /><div><b>How to read this model</b><span>Risk bands map to Allow, Step-up, or Deny. Resource role permissions are checked independently: a role mismatch remains a hard deny at any score.</span></div><SectionLink href="/policies">Review policy</SectionLink></div>
  </>;
}
function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return <label className="field"><span className="field-label">{icon}{label}</span><span className="select-wrap">{children}<ChevronDown size={14} /></span></label>;
}
function DecisionResult({ decision, policy, resource }: { decision: Decision; policy: Policy; resource: Resource }) {
  const bandClass = decision.riskBand.toLowerCase(); const fill = decision.riskScore === 0 ? 3 : decision.riskScore;
  const outcomeCopy = decision.outcome === 'Allow' ? 'Access permitted' : decision.outcome === 'Step-up' ? 'Additional verification' : 'Access blocked';
  return <div className="result-content fade-in" data-testid="decision-result">
    <div className={`result-banner ${decision.outcome.toLowerCase().replace('-', '')}`}><div className="result-icon">{decision.outcome === 'Allow' ? <CheckCircle2 size={21} /> : decision.outcome === 'Step-up' ? <AlertTriangle size={21} /> : <ShieldAlert size={21} />}</div><div className="result-banner-copy"><span>SIMULATED OUTCOME</span><b data-testid="decision-outcome">{outcomeCopy}</b></div><span className={`risk-band ${bandClass}`}>{decision.riskBand} risk</span></div>
    <div className="score-area"><div className="score-head"><div><span>COMPOSITE RISK SCORE</span><small>Role authorization checked independently</small></div><div className={`score-value ${bandClass}`} data-testid="decision-score">{decision.riskScore}<small>/100</small></div></div><div className="score-track"><span className={`score-fill ${bandClass}`} style={{ width: `${fill}%` }} /></div><div className="score-markers"><span>0</span><span>LOW ≤ {policy.lowThreshold}</span><span>MEDIUM ≤ {policy.mediumThreshold}</span><span>100</span></div></div>
    <div className="reason-title"><span>WHY THIS DECISION</span><span>{decision.reasons.length} SIGNAL{decision.reasons.length === 1 ? '' : 'S'}</span></div><div className="reason-list">{decision.reasons.map((reason, index) => <div className={`reason-item ${reason.includes('hard deny') ? 'hard-reason' : ''}`} key={`${reason}-${index}`}><span className="reason-dot">{reason.includes('hard deny') ? <X size={11} /> : <Check size={11} />}</span><span>{reason}</span></div>)}</div>
    <div className="decision-meta"><span><LockKeyhole size={12} /> {resource.sensitivity.toUpperCase()} SENSITIVITY</span><span><Clock3 size={12} /> {formatTime(decision.evaluatedAt)}</span></div>
  </div>;
}

function PolicyPage({ policy, onChange, onReset }: { policy: Policy; onChange: (key: keyof Policy, value: number) => void; onReset: () => void }) {
  return <>
    <PageHeading kicker="POLICY CONTROLS" title="Tune the" italic="decision model." copy="A small teaching model makes each score legible. Changes save in this browser and apply to future simulations." />
    <section className="panel policy-panel policy-page-panel">
      <PanelTitle number="01" title="Risk signals" sub="Adjust the point contribution for each synthetic request signal." action={<button className="reset-button" onClick={onReset} data-testid="button-reset-policy"><RotateCcw size={13} /> Reset defaults</button>} />
      <div className="policy-layout"><div className="factors">
        <Factor label="Unknown device" desc="Endpoint has no campus registration" value={policy.unknownDeviceWeight} onChange={v => onChange('unknownDeviceWeight', v)} testid="weight-unknown-device" />
        <Factor label="Unusual time" desc="Request falls outside normal campus hours" value={policy.unusualTimeWeight} onChange={v => onChange('unusualTimeWeight', v)} testid="weight-unusual-time" />
        <Factor label="Repeated failed attempts" desc="Recent authentication failures detected" value={policy.failedAttemptsWeight} onChange={v => onChange('failedAttemptsWeight', v)} testid="weight-failed-attempts" />
        <Factor label="Sensitive resource" desc="High-sensitivity records or systems" value={policy.sensitiveResourceWeight} onChange={v => onChange('sensitiveResourceWeight', v)} testid="weight-sensitive-resource" />
      </div><div className="threshold-box"><div className="threshold-title"><SlidersHorizontal size={15} /><b>RISK THRESHOLDS</b><span className="mono">0—100</span></div>
        <Threshold label="Low → allow up to" value={policy.lowThreshold} max={policy.mediumThreshold - 1} onChange={v => onChange('lowThreshold', v)} tint="teal" testid="threshold-low" />
        <Threshold label="Medium → restrict up to" value={policy.mediumThreshold} min={policy.lowThreshold + 1} max={100} onChange={v => onChange('mediumThreshold', v)} tint="amber" testid="threshold-medium" />
        <div className="threshold-key"><span><i className="key-low" />0–{policy.lowThreshold} allow</span><span><i className="key-mid" />{policy.lowThreshold + 1}–{policy.mediumThreshold} step-up</span><span><i className="key-high" />{policy.mediumThreshold + 1}–100 deny</span></div>
      </div></div>
      <div className="policy-foot"><span><CircleHelp size={13} /> Role permissions are always a hard deny, independent of risk score.</span><span className="policy-saved"><Check size={13} /> SAVED LOCALLY</span></div>
    </section>
    <section className="policy-explainer"><div className="explainer-mark"><Shield size={20} /></div><div><span className="quick-kicker">MODEL GUARDRAIL</span><h2>Risk score is not authorization.</h2><p>The score represents contextual risk only. If a user's role is absent from a resource's allowed-role matrix, the result is denied even when the risk score falls in the low band.</p><SectionLink href="/resources">Explore resource permissions</SectionLink></div></section>
    <div className="policy-defaults"><span>TEACHING DEFAULTS</span><span>Device +30</span><span>Time +20</span><span>Retries +30</span><span>Sensitivity +20</span><span>Thresholds 30 / 60</span></div>
  </>;
}
function Factor({ label, desc, value, onChange, testid }: { label: string; desc: string; value: number; onChange: (value: number) => void; testid: string }) {
  return <label className="factor"><span className="factor-copy"><b>{label}</b><small>{desc}</small></span><input type="range" min={0} max={60} step={5} value={value} onChange={e => onChange(Number(e.target.value))} data-testid={`input-${testid}`} /><span className="factor-value mono" data-testid={`value-${testid}`}>+{value}</span></label>;
}
function Threshold({ label, value, min = 0, max, onChange, tint, testid }: { label: string; value: number; min?: number; max: number; onChange: (value: number) => void; tint: string; testid: string }) {
  return <label className={`threshold-row ${tint}`}><span>{label}</span><span className="threshold-control"><input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} data-testid={`input-${testid}`} /><b className="mono" data-testid={`value-${testid}`}>{value}</b></span></label>;
}

function IdentityPage() {
  const [query, setQuery] = useState(''); const [role, setRole] = useState('All roles'); const [deviceStatus, setDeviceStatus] = useState('All devices');
  const filteredUsers = users.filter(user => `${user.name} ${user.role}`.toLowerCase().includes(query.toLowerCase()) && (role === 'All roles' || user.role === role));
  const filteredDevices = devices.filter(device => `${device.name} ${device.networkSegment} ${device.posture}`.toLowerCase().includes(query.toLowerCase()) && (deviceStatus === 'All devices' || (device.registered ? 'Registered' : 'Unregistered') === deviceStatus));
  return <>
    <PageHeading kicker="IDENTITY DIRECTORY" title="People and" italic="endpoints." copy="A synthetic inventory to explore how identity, registration, posture, and network segment become policy context." />
    <div className="directory-tools"><label className="search-box"><Search size={15} /><input type="search" placeholder="Search people, devices, segments…" value={query} onChange={e => setQuery(e.target.value)} data-testid="input-directory-search" /></label><span className="directory-label">FILTER USERS</span><select className="plain-select" value={role} onChange={e => setRole(e.target.value)} data-testid="select-identity-role"><option>All roles</option><option>Student</option><option>Faculty</option><option>IT Admin</option></select><select className="plain-select" value={deviceStatus} onChange={e => setDeviceStatus(e.target.value)} data-testid="select-device-status"><option>All devices</option><option>Registered</option><option>Unregistered</option></select></div>
    <section className="panel inventory-panel"><PanelTitle number="01" title="Synthetic identities" sub={`${filteredUsers.length} of ${users.length} people · role and account status`} />
      {filteredUsers.length ? <div className="identity-grid">{filteredUsers.map(user => <article className="identity-card" key={user.id} data-testid={`card-user-${user.id}`}><div className="identity-avatar">{user.name.split(' ').filter(x => x.length > 1).slice(0, 2).map(x => x[0]).join('')}</div><div className="identity-info"><b>{user.name}</b><span className={`role-pill ${roleColor(user.role)}`}>{user.role}</span></div><span className="active-state"><i />{user.active ? 'Active' : 'Inactive'}</span><small className="identity-id mono">IDENTITY / {user.id.toUpperCase()}</small></article>)}</div> : <TableEmpty title="No identities match" copy="Try another name or role filter." />}
    </section>
    <section className="panel device-panel"><PanelTitle number="02" title="Device posture" sub={`${filteredDevices.length} of ${devices.length} synthetic endpoints · registration is a risk signal`} />
      {filteredDevices.length ? <div className="table-wrap"><table><thead><tr><th>ENDPOINT</th><th>REGISTRATION</th><th>POSTURE</th><th>NETWORK SEGMENT</th><th>DEVICE ID</th></tr></thead><tbody>{filteredDevices.map(device => <tr key={device.id} data-testid={`row-device-${device.id}`}><td><div className="device-name"><span className="device-table-icon"><Laptop size={16} /></span><b>{device.name}</b></div></td><td><span className={`device-status ${device.registered ? 'registered' : 'unregistered'}`}><i />{device.registered ? 'Registered' : 'Unregistered'}</span></td><td><span className={`posture-pill ${device.posture.toLowerCase()}`}>{device.posture}</span></td><td>{device.networkSegment}</td><td className="mono device-code">{device.id.toUpperCase()}</td></tr>)}</tbody></table></div> : <TableEmpty title="No devices match" copy="Try another search or registration filter." />}
    </section>
    <div className="overview-footer-note"><CircleHelp size={14} /> Sample records are fictional and shared by the simulator and policy lab.</div>
  </>;
}

function ResourcesPage() {
  return <>
    <PageHeading kicker="RESOURCE CATALOG" title="Access follows" italic="the role." copy="Each synthetic campus resource has a sensitivity level and an explicit role matrix. A mismatch means hard deny, regardless of risk score." />
    <section className="resource-intro"><div className="resource-icon"><Database size={21} /></div><div><b>Authorization and risk are separate checks.</b><span>Role eligibility is not a risk signal. It cannot be offset by a low-risk device or favorable context.</span></div><span className="hard-deny-label"><LockKeyhole size={13} /> HARD DENY</span></section>
    <section className="resource-list">{resources.map((resource, index) => <article className="panel resource-card" key={resource.id} data-testid={`card-resource-${resource.id}`}><div className="resource-card-top"><span className="resource-index mono">0{index + 1}</span><div className="resource-title"><h2>{resource.name}</h2><span className={`sensitivity-tag ${resource.sensitivity.toLowerCase()}`}>{resource.sensitivity} sensitivity</span></div><div className="resource-id mono">{resource.id.toUpperCase()}</div></div><div className="role-matrix"><div className="matrix-label">ROLE ACCESS MATRIX</div>{(['Student', 'Faculty', 'IT Admin'] as Role[]).map(role => { const allowed = resource.allowedRoles.includes(role); return <div className={`matrix-role ${allowed ? 'allowed' : 'blocked'}`} key={role}><span className={`role-pill ${roleColor(role)}`}>{role}</span><span>{allowed ? <><CheckCircle2 size={15} /> Permitted</> : <><CircleX size={15} /> Not permitted</>}</span></div>; })}</div><div className="resource-card-foot"><span>{resource.sensitivity === 'High' ? 'High sensitivity contributes to the synthetic risk score.' : resource.sensitivity === 'Medium' ? 'Medium sensitivity is recorded; current model weights high sensitivity only.' : 'Low sensitivity; no sensitivity score added.'}</span><span className="resource-foot-mark"><CircleDot size={12} /> SYNTHETIC CATALOG</span></div></article>)}</section>
    <div className="learning-note"><BookOpen size={16} /><div><b>Try a role mismatch</b><span>Choose a Student identity and Campus Admin Console in the simulator. The hard deny remains in effect regardless of score.</span></div><SectionLink href="/simulator">Open simulator</SectionLink></div>
  </>;
}

function EventTable({ events, compact = false }: { events: AuditEvent[]; compact?: boolean }) {
  return <div className="table-wrap"><table><thead><tr><th>TIME</th><th>IDENTITY</th><th>DEVICE</th><th>RESOURCE</th><th>RISK</th><th>OUTCOME</th></tr></thead><tbody>{events.map(event => <tr key={event.id} data-testid={`event-row-${event.id}`}><td className="mono time-cell">{formatTime(event.createdAt)}</td><td><div className="table-user">{event.user}<small>{event.role}</small></div></td><td>{event.device}</td><td>{event.resource}</td><td><span className={`risk-number mono ${event.riskScore >= 61 ? 'high' : event.riskScore >= 31 ? 'medium' : ''}`} data-testid={`value-risk-${event.id}`}>{event.riskScore}<small>/100</small></span></td><td><OutcomeBadge outcome={event.outcome} /></td>{!compact && <td><details className="reason-details"><summary data-testid={`button-reasons-${event.id}`}>Reasons</summary><div>{event.reasons.map((reason, i) => <span key={`${event.id}-${i}`}>{reason}</span>)}</div></details></td>}</tr>)}</tbody></table></div>;
}
function ActivityPage({ events, onClear }: { events: AuditEvent[]; onClear: () => void }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('All outcomes');
  const filtered = events.filter(event => `${event.user} ${event.device} ${event.resource} ${event.role} ${event.reasons.join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All outcomes' || event.outcome === filter));
  const download = () => {
    const rows = [['Event ID', 'Created at', 'User', 'Role', 'Device', 'Resource', 'Outcome', 'Risk score', 'Reasons'], ...filtered.map(e => [e.id, e.createdAt, e.user, e.role, e.device, e.resource, e.outcome, String(e.riskScore), e.reasons.join(' | ')])];
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'northfield-simulated-activity.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  return <>
    <PageHeading kicker="LOCAL EVENT HISTORY" title="Every decision," italic="in the open." copy="Search the synthetic audit trail, inspect the reason chain, or export the currently filtered rows as CSV." action={<span className="sim-tag"><span /> {events.length} LOCAL EVENTS</span>} />
    <section className="panel log-panel activity-page-panel">
      <PanelTitle number="01" title="Simulated access events" sub="Sample history and new decisions · stored in this browser" action={<div className="button-cluster"><button className="outline-action" onClick={download} disabled={!filtered.length} data-testid="button-download-csv"><Download size={14} /> Download CSV</button><button className="clear-button" onClick={onClear} disabled={!events.length} data-testid="button-clear-history"><Trash2 size={14} /> Clear history</button></div>} />
      <div className="log-tools"><label className="search-box"><Search size={15} /><input type="search" placeholder="Search identity, device, resource, reason…" value={query} onChange={e => setQuery(e.target.value)} data-testid="input-log-search" /></label><label className="filter-select"><span>SHOW</span><select value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-log-filter"><option>All outcomes</option><option>Allow</option><option>Step-up</option><option>Deny</option></select><ChevronDown size={13} /></label><span className="log-count mono" data-testid="log-count">{filtered.length} EVENTS</span></div>
      {filtered.length ? <EventTable events={filtered} /> : <TableEmpty title={events.length ? 'No matching events' : 'No events yet'} copy={events.length ? 'Try another search or outcome filter.' : 'Evaluate a request and the local decision will appear here.'} />}
      <div className="log-foot"><span><span className="status-dot" /> SYNTHETIC EVENTS</span><span>Local browser storage <span className="foot-sep">·</span> Not transmitted</span></div>
    </section>
    <p className="confirm-note"><CircleHelp size={14} /> Clearing asks for confirmation and remains cleared on refresh. New simulations can add events again.</p>
  </>;
}
function AlertsPage({ events, acknowledged, onAcknowledge, mediumThreshold }: { events: AuditEvent[]; acknowledged: string[]; onAcknowledge: (id: string) => void; mediumThreshold: number }) {
  const [filter, setFilter] = useState('All alerts'); const [query, setQuery] = useState('');
  const alerts = events.filter(event => event.outcome === 'Deny' || event.riskScore >= mediumThreshold).filter(event => `${event.user} ${event.device} ${event.resource} ${event.reasons.join(' ')}`.toLowerCase().includes(query.toLowerCase())).filter(event => filter === 'All alerts' || (filter === 'Unacknowledged' ? !acknowledged.includes(event.id) : acknowledged.includes(event.id)));
  return <>
    <PageHeading kicker="RISK REVIEW" title="Signals worth" italic="a second look." copy="Alerts are derived from existing simulated events: any denied decision or score at or above the current medium threshold." action={<span className="sim-tag"><span /> DERIVED VIEW</span>} />
    <div className="alert-rule"><AlertTriangle size={17} /><div><b>Alert rule · Denied or risk ≥ {mediumThreshold}</b><span>Changing policy thresholds updates this view. Acknowledgement is a local review marker only and never edits the underlying event.</span></div></div>
    <div className="directory-tools alert-tools"><label className="search-box"><Search size={15} /><input type="search" placeholder="Search alerts…" value={query} onChange={e => setQuery(e.target.value)} data-testid="input-alert-search" /></label><select className="plain-select" value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-alert-filter"><option>All alerts</option><option>Unacknowledged</option><option>Acknowledged</option></select><span className="log-count mono">{alerts.length} MATCHING</span></div>
    {alerts.length ? <div className="alerts-list">{alerts.map(event => {
      const isAck = acknowledged.includes(event.id);
      return <article className={`panel alert-card ${isAck ? 'acknowledged' : ''}`} key={event.id} data-testid={`alert-${event.id}`}><div className={`alert-symbol ${event.outcome === 'Deny' ? 'deny' : 'step'}`}>{event.outcome === 'Deny' ? <ShieldAlert size={19} /> : <AlertTriangle size={19} />}</div><div className="alert-copy"><div className="alert-card-meta"><span className="mono">{event.id}</span><span>{formatDate(event.createdAt)} · {formatTime(event.createdAt)}</span><span className={`risk-number mono ${event.riskScore >= 61 ? 'high' : 'medium'}`}>RISK {event.riskScore}</span></div><h2>{event.user} <span>·</span> {event.resource}</h2><div className="alert-event-line"><span>{event.device}</span><span className="foot-sep">/</span><span className={`role-pill ${roleColor(event.role)}`}>{event.role}</span><OutcomeBadge outcome={event.outcome} /></div><ul className="alert-reasons">{event.reasons.slice(0, 3).map((reason, i) => <li key={`${event.id}-reason-${i}`}>{reason}</li>)}</ul><div className="alert-card-footer"><Link href="/activity" className="text-link" data-testid={`link-alert-history-${event.id}`}>View event history <ArrowRight size={13} /></Link>{isAck ? <span className="ack-state" data-testid={`status-ack-${event.id}`}><CheckCheck size={14} /> Acknowledged locally</span> : <button className="ack-button" onClick={() => onAcknowledge(event.id)} data-testid={`button-ack-${event.id}`}><Check size={14} /> Acknowledge</button>}</div></div></article>;
    })}</div> : <section className="panel alert-empty"><div className="empty-orbit"><ShieldCheck size={26} /></div><b>{events.length ? 'No alerts match these filters' : 'No events to review'}</b><p>{events.length ? 'Try a different search or acknowledgement filter.' : 'Simulated denied and elevated-risk events will appear here.'}</p></section>}
    <div className="overview-footer-note"><CircleHelp size={14} /> Acknowledging marks the alert as reviewed in this browser. The original decision and event reasons remain unchanged.</div>
  </>;
}
function NotFound() {
  return <section className="panel not-found"><span className="section-number">404</span><h1>That screen is off the map.</h1><p>This page is not part of the campus policy lab.</p><Link href="/" className="evaluate-button" data-testid="link-not-found-home">Return to overview <ArrowRight size={15} /></Link></section>;
}

export default App;
