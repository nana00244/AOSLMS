import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Download,
  Wallet,
  Receipt,
  Landmark,
  TrendingUp,
  Printer,
  Plus,
  Search,
  FileSpreadsheet,
  Zap,
  Building,
  Award,
  ShieldCheck,
  Users,
  FileText,
} from 'lucide-react';
import { useStore, csv } from '../store';
import { billed, money, today, type Payment, type State } from '../data';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Empty,
  Field,
  Modal,
  PageHeader,
  Person,
  SearchBox,
  Stat,
} from '../components/ui';
import { financeService } from '../services/financeService';

export function AccountantDashboard() {
  const { data } = useStore();
  const summary = financeService.getFinancialSummary(data);
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTS · FINANCIAL INTELLIGENCE"
        title="Financial intelligence"
        description={`Ledger reconciliation · Term ${data.settings.term}, ${data.settings.year}`}
        actions={
          <Link className="btn btn-primary" to="/accountant/payments/new">
            <Plus size={16} /> Record payment
          </Link>
        }
      />
      <div className="stats-grid three">
        <Stat label="Total billed" value={money(summary.totalBilled)} icon={<Receipt />} />
        <Stat
          label="Collected"
          value={money(summary.totalCollected)}
          icon={<Wallet />}
          tone="green"
        />
        <Stat
          label="Arrears"
          value={money(summary.totalArrears)}
          icon={<Landmark />}
          tone="amber"
        />
        <Stat
          label="Collection efficiency"
          value={`${summary.collectionEfficiency}%`}
          icon={<TrendingUp />}
          tone="blue"
        />
        <Stat
          label="Critical debtors"
          value={summary.criticalDebtorsCount}
          icon={<Users />}
          tone="red"
        />
        <Stat
          label="Expenditure"
          value={money(summary.totalExpenditure)}
          icon={<FileSpreadsheet />}
        />
      </div>
      <Card>
        <CardTitle
          title="Debtor risk overview"
          description="Balances and risk levels use the current term's fee structure and payment ledger."
          action={
            <Link className="btn btn-secondary" to="/accountant/students">
              Open fee roster
            </Link>
          }
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Billed</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {summary.debtors
                .filter((d) => d.balance > 0)
                .slice(0, 8)
                .map((d) => (
                  <tr key={d.student.id}>
                    <td>
                      <Person name={d.student.name} sub={d.student.id} />
                    </td>
                    <td>{d.student.classId}</td>
                    <td>{money(d.billed)}</td>
                    <td>{money(d.paid)}</td>
                    <td>
                      <strong>{money(d.balance)}</strong>
                    </td>
                    <td>
                      <Badge
                        tone={
                          d.risk === 'Critical' ? 'red' : d.risk === 'Moderate' ? 'amber' : 'blue'
                        }
                      >
                        {d.risk}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!summary.debtorCount && <Empty title="All accounts are cleared" />}
      </Card>
    </>
  );
}

export function StudentFinanceList() {
  const { data, update, notify } = useStore();
  const summary = financeService.getFinancialSummary(data);
  const [query, setQuery] = useState(''),
    [classFilter, setClassFilter] = useState('all'),
    [riskFilter, setRiskFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const rows = useMemo(
    () =>
      summary.debtors.filter(
        (d) =>
          (classFilter === 'all' || d.student.classId === classFilter) &&
          (riskFilter === 'all' || d.risk.toLowerCase() === riskFilter) &&
          `${d.student.name} ${d.student.id}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [summary.debtors, classFilter, riskFilter, query],
  );
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const applyConcession = (value: 50 | 100) => {
    if (!selected.length) return;
    update(
      (d) => ({
        ...d,
        studentConcessions: {
          ...d.studentConcessions,
          ...Object.fromEntries(selected.map((id) => [id, value])),
        },
      }),
      `${value}% fee concession applied to ${selected.length} student(s)`,
    );
    notify(`${value}% fee concession applied.`);
    setSelected([]);
  };
  const exportRows = [
    [
      'Student',
      'Admission number',
      'Class',
      'Guardian',
      'Phone',
      'Billed',
      'Paid',
      'Balance',
      'Arrears %',
      'Risk',
      'Last payment',
    ],
    ...rows.map((d) => [
      d.student.name,
      d.student.id,
      d.student.classId,
      d.student.guardian,
      d.student.phone,
      d.billed,
      d.paid,
      d.balance,
      d.arrearsPercentage,
      d.risk,
      d.lastPayment?.date || '',
    ]),
  ];
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTS · STUDENT LEDGER"
        title="Fee roster & debtors"
        description="Monitor balances, debtor risk, payment history, and student concessions."
        actions={
          <Button variant="secondary" onClick={() => csv('debt-recovery-roster.csv', exportRows)}>
            <Download size={16} /> Export debt recovery
          </Button>
        }
      />
      <Card>
        <div className="finance-filters">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search name or admission number..."
          />
          <select
            aria-label="Filter by class"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="all">All classrooms</option>
            {data.classes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Filter by debtor risk"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="all">All risk levels</option>
            {['critical', 'moderate', 'low', 'cleared', 'unbilled'].map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {!!selected.length && (
          <div className="concession-actions">
            <strong>{selected.length} selected</strong>
            <Button variant="secondary" onClick={() => applyConcession(50)}>
              Apply 50% staff-child discount
            </Button>
            <Button variant="secondary" onClick={() => applyConcession(100)}>
              Apply 100% fee waiver
            </Button>
            <Button variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Select</th>
                <th>Student / guardian</th>
                <th>Class</th>
                <th>Billed</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Risk</th>
                <th>Last payment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.student.id}>
                  <td>
                    <input
                      aria-label={`Select ${d.student.name}`}
                      type="checkbox"
                      checked={selected.includes(d.student.id)}
                      onChange={() => toggle(d.student.id)}
                    />
                  </td>
                  <td>
                    <Person
                      name={d.student.name}
                      sub={`${d.student.id} · ${d.student.guardian} · ${d.student.phone}`}
                    />
                  </td>
                  <td>
                    {d.student.classId}
                    {data.studentConcessions?.[d.student.id] ? (
                      <small className="block muted">
                        {data.studentConcessions[d.student.id]}% concession
                      </small>
                    ) : null}
                  </td>
                  <td>{money(d.billed)}</td>
                  <td>{money(d.paid)}</td>
                  <td>
                    <strong>{money(d.balance)}</strong>
                  </td>
                  <td>
                    <Badge
                      tone={
                        d.risk === 'Critical'
                          ? 'red'
                          : d.risk === 'Moderate'
                            ? 'amber'
                            : d.risk === 'Cleared'
                              ? 'green'
                              : 'blue'
                      }
                    >
                      {d.risk}
                    </Badge>
                  </td>
                  <td>
                    {d.lastPayment?.date || '—'}
                    {d.lastPayment && (
                      <small className="block muted">
                        {money(d.lastPayment.amount)} · {d.lastPayment.method}
                      </small>
                    )}
                  </td>
                  <td>
                    <Link
                      className="btn btn-ghost"
                      to={`/accountant/payments/new?studentId=${encodeURIComponent(d.student.id)}`}
                    >
                      Record payment
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty title="No matching students" />}
      </Card>
    </>
  );
}

export function PaymentRecorder() {
  const { data, update, notify, me } = useStore();
  const [params] = useSearchParams();
  const preselected = params.get('studentId') || '';
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [studentId, setStudentId] = useState(preselected);
  const [query, setQuery] = useState('');
  const choices = data.students.filter((s) =>
    `${s.name} ${s.id} ${s.classId}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = data.students.find((s) => s.id === studentId);
  const balance = selected
    ? Math.max(
        0,
        billed(data, selected) -
          data.payments
            .filter((p) => p.studentId === selected.id && p.term === data.settings.term)
            .reduce((a, p) => a + p.amount, 0),
      )
    : 0;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const { state, payment } = financeService.recordPayment(
        data,
        {
          studentId: String(f.get('student')),
          amount: Number(f.get('amount')),
          method: String(f.get('method')),
          date: String(f.get('date')),
          transactionRef: String(f.get('reference') || ''),
          notes: String(f.get('notes') || ''),
          term: data.settings.term,
        },
        me,
      );
      update(() => state, `Payment recorded: ${money(payment.amount)} · ${payment.receiptNumber}`);
      setReceipt(payment);
      notify('Payment recorded and receipt generated.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to record payment.');
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTS · CASHIER DESK"
        title="Record student payment"
        description="Look up a student, enter payment details, and generate an official receipt."
      />
      <div className="finance-layout">
        <Card>
          <CardTitle
            title="Payment details"
            description="Receipt number and cashier are stamped when the payment is saved."
          />
          <form onSubmit={submit}>
            <Field label="Find student by name, admission number, or class">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Start typing to filter students"
              />
            </Field>
            <Field label="Student">
              <select
                name="student"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Choose a student</option>
                {choices.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name} · {s.id} · {s.classId}
                  </option>
                ))}
              </select>
            </Field>
            {selected && (
              <div className="balance-callout">
                <span>Outstanding balance</span>
                <strong>{money(balance)}</strong>
              </div>
            )}
            <div className="form-grid">
              <Field label="Amount (GH₵)">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  max={balance || undefined}
                />
              </Field>
              <Field label="Payment method">
                <select name="method">
                  <option>Cash</option>
                  <option>Mobile Money</option>
                  <option>Bank Deposit / Transfer</option>
                  <option>Cheque</option>
                </select>
              </Field>
              <Field label="Payment date">
                <input name="date" type="date" defaultValue={today()} required />
              </Field>
              <Field label="Transaction reference (optional)">
                <input name="reference" />
              </Field>
            </div>
            <Field label="Notes (optional)">
              <textarea name="notes" />
            </Field>
            <div className="modal-actions">
              <Button type="submit">
                <Receipt size={16} /> Record & generate receipt
              </Button>
            </div>
          </form>
        </Card>
        <Card>
          <CardTitle title="Cashier session" />
          <p>
            Recorded by <strong>{me}</strong>
          </p>
          <p>
            Term {data.settings.term} · {data.settings.year}
          </p>
          <p>
            Payments entered here are added to the active term ledger and produce a unique receipt
            number.
          </p>
        </Card>
      </div>
      {receipt && (
        <Modal title="Official payment receipt" onClose={() => setReceipt(null)}>
          <div className="receipt print-area">
            <img src={data.settings.crest || './crest.svg'} alt="School crest" width="48" />
            <h2>{data.settings.name}</h2>
            <p>{data.settings.address}</p>
            <h3>PAYMENT RECEIPT</h3>
            <dl className="detail-list">
              {[
                ['Receipt', receipt.receiptNumber || receipt.id],
                ['Date', receipt.date],
                ['Student', data.students.find((s) => s.id === receipt.studentId)?.name || ''],
                ['Admission number', receipt.studentId],
                ['Class', data.students.find((s) => s.id === receipt.studentId)?.classId || ''],
                ['Method', receipt.method],
                ['Transaction reference', receipt.transactionRef || '—'],
                ['Term', String(receipt.term)],
                ['Amount paid', money(receipt.amount)],
                ['Cashier', receipt.recordedBy || me],
                [
                  'New balance',
                  money(
                    Math.max(0, balanceOf(data, receipt.studentId, receipt.term) - receipt.amount),
                  ),
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p>{receipt.notes}</p>
            <strong>Thank you for supporting their future.</strong>
            <div className="receipt-signature">Cashier signature __________________</div>
            <p className="receipt-watermark">OFFICIAL SCHOOL RECEIPT</p>
          </div>
          <div className="modal-actions">
            <Button onClick={() => window.print()}>
              <Printer size={16} /> Print / Save PDF
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function balanceOf(state: State, studentId: string, term: number) {
  const student = state.students.find((s) => s.id === studentId);
  return student
    ? Math.max(
        0,
        billed(state, student) -
          state.payments
            .filter((p) => p.studentId === studentId && p.term === term)
            .reduce((a, p) => a + p.amount, 0),
      )
    : 0;
}

export function FeeManagement() {
  const { data, update, notify } = useStore();
  const [classId, setClassId] = useState(data.classes[0] || '');
  const categories = [
    'Tuition',
    'ICT levy',
    'PTA dues',
    'Science laboratory',
    'Sports & culture',
    'Examination',
    'Library',
  ];
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTS · BILLING CONFIGURATION"
        title="Fee structures & categories"
        description="Maintain classroom fee schedules used by the student ledger."
      />
      <div className="finance-layout">
        <Card>
          <CardTitle
            title="Term fee structure"
            description="Save changes to update student billing totals."
          />
          <Field label="Classroom">
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {data.classes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <form
            key={classId}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const fees = Object.fromEntries(
                Array.from(f.entries()).map(([k, v]) => [k, Number(v)]),
              );
              update(
                (d) => ({ ...d, fees: { ...d.fees, [classId]: fees } }),
                `Fee structure updated for ${classId}`,
              );
              notify('Fee structure saved; balances are recalculated from the updated schedule.');
            }}
          >
            <div className="form-grid">
              {categories.map((k) => (
                <Field key={k} label={`${k} (GH₵)`}>
                  <input
                    name={k}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={data.fees[classId]?.[k] || 0}
                  />
                </Field>
              ))}
            </div>
            <div className="modal-actions">
              <Button type="submit">Save fee structure</Button>
            </div>
          </form>
        </Card>
        <Card>
          <CardTitle
            title="Categories in use"
            description="Category values are used as the line items for every classroom."
          />
          {categories.map((c, i) => (
            <div className="class-detail-row" key={c}>
              <span className="activity-icon blue">{i + 1}</span>
              <strong>{c}</strong>
              <span>{money(data.fees[classId]?.[c] || 0)}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

export const STATUTORY_CATEGORIES = [
  {
    label: 'Light (Power / ECG)',
    category: 'Light',
    payee: 'Electricity Company of Ghana (ECG)',
    Icon: Zap,
  },
  {
    label: 'Property Rate',
    category: 'Property Rate',
    payee: 'Techiman Municipal Assembly - Revenue Office',
    Icon: Building,
  },
  {
    label: 'NAPS (Dues)',
    category: 'NAPS',
    payee: 'National Association of Private Schools',
    Icon: Award,
  },
  {
    label: 'NASIA (Inspection)',
    category: 'NASIA',
    payee: 'National Schools Inspectorate Authority',
    Icon: ShieldCheck,
  },
  {
    label: 'SSNIT (Tier 1)',
    category: 'SSNIT',
    payee: 'Social Security & National Insurance Trust',
    Icon: Users,
  },
  {
    label: 'PAYE (Tax Remittance)',
    category: 'PAYE',
    payee: 'Ghana Revenue Authority (GRA)',
    Icon: FileSpreadsheet,
  },
  {
    label: 'School Maintenance',
    category: 'Miscellaneous',
    payee: 'Authorized Vendors',
    Icon: FileText,
  },
];
export function ExpenditurePage() {
  const { data, update, notify, me } = useStore();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('Light');
  const initialPayee = STATUTORY_CATEGORIES.find((c) => c.category === category)?.payee || '';
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTS · INSTITUTIONAL OUTFLOWS"
        title="Expenditure & statutory outflows"
        description="Track utilities, municipal rates, school dues, pensions, and tax remittances."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> New expenditure voucher
          </Button>
        }
      />
      <div className="stats-grid three">
        {STATUTORY_CATEGORIES.map(({ category: c, label, payee, Icon }) => (
          <Card key={c} className="stat">
            <div className="stat-top">
              <span className="icon-tile navy">
                <Icon />
              </span>
            </div>
            <strong className="stat-value-long">
              {data.expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0)
                ? money(
                    data.expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0),
                  )
                : money(0)}
            </strong>
            <span className="stat-label">{label}</span>
            <small className="muted">{payee}</small>
          </Card>
        ))}
      </div>
      <Card>
        <CardTitle
          title="Expenditure ledger"
          description="Recorded statutory and school operating outflows."
          action={
            <Button
              variant="secondary"
              onClick={() =>
                csv('school-expenditure.csv', [
                  [
                    'Date',
                    'Category',
                    'Description',
                    'Payee',
                    'Amount',
                    'Payment method',
                    'Reference',
                    'Status',
                  ],
                  ...data.expenses.map((e) => [
                    e.date,
                    e.category,
                    e.title,
                    e.vendor,
                    e.amount,
                    e.paymentMethod || '',
                    e.reference || '',
                    e.status,
                  ]),
                ])
              }
            >
              <Download size={16} /> Export CSV
            </Button>
          }
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category / description</th>
                <th>Payee</th>
                <th>Amount</th>
                <th>Method / reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>
                    <strong>{e.category}</strong>
                    <small className="block muted">{e.title}</small>
                  </td>
                  <td>{e.vendor}</td>
                  <td>{money(e.amount)}</td>
                  <td>
                    {e.paymentMethod || '—'}
                    <small className="block muted">{e.reference || ''}</small>
                  </td>
                  <td>
                    <Badge tone={e.status === 'Approved' ? 'green' : 'amber'}>{e.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.expenses.length && <Empty title="No expenditure vouchers" />}
      </Card>
      {open && (
        <Modal title="New expenditure voucher" onClose={() => setOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const cat = String(f.get('category'));
              const desc = String(f.get('title'));
              const payee = String(f.get('payee'));
              const amount = Number(f.get('amount'));
              const status = String(f.get('status'));
              const method = String(f.get('method'));
              const reference = String(f.get('reference') || '');
              update(
                (d) =>
                  financeService.recordExpenditure(
                    d,
                    {
                      title: desc,
                      category: cat,
                      vendor: payee,
                      amount,
                      status,
                      paymentMethod: method,
                      reference,
                    },
                    me,
                  ),
                `Expenditure recorded: ${cat} ${money(amount)}`,
              );
              notify('Expenditure voucher saved.');
              setOpen(false);
            }}
          >
            <Field label="Statutory category">
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {STATUTORY_CATEGORIES.map((c) => (
                  <option value={c.category} key={c.category}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input name="title" required />
            </Field>
            <Field label="Payee">
              <input name="payee" key={category} required defaultValue={initialPayee} />
            </Field>
            <div className="form-grid">
              <Field label="Amount (GH₵)">
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </Field>
              <Field label="Payment method">
                <select name="method">
                  <option>Cash</option>
                  <option>Bank transfer</option>
                  <option>Mobile Money</option>
                  <option>Cheque</option>
                </select>
              </Field>
              <Field label="Reference">
                <input name="reference" />
              </Field>
              <Field label="Status">
                <select name="status">
                  <option>Approved</option>
                  <option>Pending</option>
                </select>
              </Field>
            </div>
            <div className="modal-actions">
              <Button type="submit">Save voucher</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function BatchReceiptPrinter() {
  const { data } = useStore();
  const [term, setTerm] = useState(String(data.settings.term));
  const [classId, setClassId] = useState('all');
  const rows = data.payments
    .filter(
      (p) =>
        p.term === Number(term) &&
        (classId === 'all' || data.students.find((s) => s.id === p.studentId)?.classId === classId),
    )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTS · RECEIPT DESK"
        title="Batch receipts"
        description="Review and print a classroom or term batch of payment receipts."
        actions={
          <Button onClick={() => window.print()}>
            <Printer size={16} /> Print batch
          </Button>
        }
      />
      <Card>
        <div className="finance-filters">
          <Field label="Academic term">
            <select value={term} onChange={(e) => setTerm(e.target.value)}>
              {[1, 2, 3].map((t) => (
                <option key={t} value={t}>
                  Term {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Classroom">
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="all">All classrooms</option>
              {data.classes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Student</th>
                <th>Class</th>
                <th>Method</th>
                <th>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.receiptNumber || p.id}</td>
                  <td>{p.date}</td>
                  <td>{data.students.find((s) => s.id === p.studentId)?.name || p.studentId}</td>
                  <td>{data.students.find((s) => s.id === p.studentId)?.classId}</td>
                  <td>{p.method}</td>
                  <td>{money(p.amount)}</td>
                  <td>
                    <span className="muted">{p.transactionRef || ''}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty title="No receipts for these filters" />}
      </Card>
    </>
  );
}
