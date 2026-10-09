import { useState } from 'react';
import {
  Plus,
  Download,
  Wallet,
  Landmark,
  TrendingUp,
  Receipt,
  Printer,
  Settings2,
  Eye,
} from 'lucide-react';
import { useStore, csv } from '../store';
import {
  billed,
  paid,
  money,
  today,
  uid,
  classes,
  type Payment,
  type Payroll as PayrollRecord,
} from '../data';
import {
  Button,
  PageHeader,
  Card,
  CardTitle,
  Stat,
  SearchBox,
  Person,
  Badge,
  Modal,
  Field,
  Empty,
  Tabs,
} from '../components/ui';
import { financeService } from '../services/financeService';

export function AdminFinanceDashboard() {
  const { data } = useStore();
  const audit = financeService.getAdminFinancialAudit(data);
  const debtors = data.students
    .map((student) => ({
      student,
      billed: billed(data, student),
      paid: paid(data, student.id),
    }))
    .map((entry) => ({ ...entry, balance: Math.max(0, entry.billed - entry.paid) }))
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  return (
    <>
      <PageHeader
        eyebrow="INSTITUTION FINANCIAL OVERSIGHT"
        title="Financial audit & debt surveillance"
        description={`School-wide reconciliation · Term ${data.settings.term}, ${data.settings.year}`}
      />
      <div className="stats-grid three">
        <Stat
          label="Students / classes"
          value={`${audit.totalStudents} / ${audit.totalClasses}`}
          icon={<Receipt />}
        />
        <Stat label="Total billed" value={money(audit.totalBilled)} icon={<Receipt />} />
        <Stat
          label="Total collected"
          value={money(audit.totalCollected)}
          icon={<Wallet />}
          tone="green"
        />
        <Stat
          label="Outstanding arrears"
          value={money(audit.totalArrears)}
          icon={<Landmark />}
          tone="amber"
        />
        <Stat
          label="Collection efficiency"
          value={`${audit.collectionEfficiency}%`}
          icon={<TrendingUp />}
          tone="blue"
        />
        <Stat
          label="Critical debtors"
          value={`${audit.criticalDebtorsCount} of ${audit.debtorCount}`}
          icon={<Settings2 />}
          tone="red"
        />
      </div>
      <Card>
        <CardTitle
          title="Arrears by student"
          description="Balances are reconciled against the active term's fee structure and payments."
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Billed</th>
                <th>Collected</th>
                <th>Balance</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map(({ student, billed: amountBilled, paid: amountPaid, balance }) => (
                <tr key={student.id}>
                  <td>
                    <Person name={student.name} sub={student.id} />
                  </td>
                  <td>{student.classId}</td>
                  <td>{money(amountBilled)}</td>
                  <td>{money(amountPaid)}</td>
                  <td>
                    <strong>{money(balance)}</strong>
                  </td>
                  <td>
                    <Badge tone={balance > amountBilled * 0.5 ? 'red' : 'amber'}>
                      {balance > amountBilled * 0.5 ? 'Critical' : 'Outstanding'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!debtors.length && <Empty title="No outstanding balances" />}
      </Card>
      <p className="muted">
        Net operating cash after recorded payroll disbursements: {money(audit.netOperatingCash)}.
      </p>
    </>
  );
}

export function Finance() {
  const { data, role, ownId, update, notify } = useStore();
  const classList = data.classes || classes;
  const [q, setQ] = useState(''),
    [modal, setModal] = useState(''),
    [receipt, setReceipt] = useState<Payment | null>(null),
    [tab, setTab] = useState('Student billing'),
    [feeClass, setFeeClass] = useState(classList[0] || 'Basic 6 - Gold'),
    [paper, setPaper] = useState('A4');
  const isStudent = role === 'Student';
  const students = data.students.filter(
    (s) =>
      (!isStudent || s.id === ownId) && (s.name + s.id).toLowerCase().includes(q.toLowerCase()),
  );
  const all = data.students.filter((s) => !isStudent || s.id === ownId);
  const bills = all.reduce((sum, s) => sum + billed(data, s), 0),
    payments = all.reduce((sum, s) => sum + paid(data, s.id), 0),
    expenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const transactions = data.payments.filter(
    (p) => (!isStudent || p.studentId === ownId) && p.term === data.settings.term,
  );
  return (
    <>
      <PageHeader
        eyebrow="CLARITY IN EVERY CEDI"
        title={isStudent ? 'My school fees' : 'Financial treasury'}
        description={
          isStudent
            ? 'Your fee statement and payments, clearly explained.'
            : 'Keep billing, payments, and school expenditure in balance.'
        }
        actions={
          !isStudent && (
            <>
              <Button variant="secondary" onClick={() => setModal('expense')}>
                <Plus size={16} />
                New expense
              </Button>
              <Button onClick={() => setModal('payment')}>
                <Plus size={16} />
                Record payment
              </Button>
            </>
          )
        }
      />
      <div className={`stats-grid ${isStudent ? 'three' : ''}`}>
        <Stat label="Total billed" value={money(bills)} icon={<Receipt />} />
        <Stat label="Total collected" value={money(payments)} icon={<Wallet />} tone="green" />
        <Stat
          label="Outstanding balance"
          value={money(bills - payments)}
          icon={<Landmark />}
          tone="amber"
        />
        {!isStudent && (
          <Stat
            label="Operating expenses"
            value={money(expenses)}
            icon={<TrendingUp />}
            tone="red"
          />
        )}
      </div>
      {!isStudent && (
        <Tabs
          items={['Student billing', 'Transactions', 'Expenditure']}
          value={tab}
          onChange={setTab}
        />
      )}
      <div className="finance-layout">
        <Card>
          <CardTitle
            title={tab === 'Student billing' ? 'Student billing roster' : tab}
            description={`Term ${data.settings.term} · ${data.settings.year}`}
            action={
              <Button
                variant="ghost"
                onClick={() =>
                  csv(
                    'finance-export.csv',
                    tab === 'Expenditure'
                      ? [
                          ['Expense', 'Category', 'Vendor', 'Amount', 'Status'],
                          ...data.expenses.map((e) => [
                            e.title,
                            e.category,
                            e.vendor,
                            e.amount,
                            e.status,
                          ]),
                        ]
                      : tab === 'Transactions'
                        ? [
                            ['Receipt', 'Student', 'Amount', 'Method', 'Date'],
                            ...transactions.map((p) => [
                              p.id,
                              data.students.find((s) => s.id === p.studentId)?.name || '',
                              p.amount,
                              p.method,
                              p.date,
                            ]),
                          ]
                        : [
                            ['Student', 'Billed', 'Paid', 'Balance'],
                            ...students.map((s) => [
                              s.name,
                              billed(data, s),
                              paid(data, s.id),
                              billed(data, s) - paid(data, s.id),
                            ]),
                          ],
                  )
                }
              >
                <Download size={15} />
                Export CSV
              </Button>
            }
          />
          {tab === 'Student billing' ? (
            <>
              <div className="inset-search">
                <SearchBox
                  value={q}
                  onChange={setQ}
                  placeholder="Search name or admission number..."
                />
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Billed</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const b = billed(data, s),
                        p = paid(data, s.id);
                      return (
                        <tr key={s.id}>
                          <td>
                            <Person name={s.name} sub={s.classId} />
                          </td>
                          <td>{money(b)}</td>
                          <td>{money(p)}</td>
                          <td>
                            <strong>{money(b - p)}</strong>
                          </td>
                          <td>
                            <Badge tone={p >= b ? 'green' : p > 0 ? 'amber' : 'red'}>
                              {p >= b ? 'Paid in full' : p > 0 ? 'Partial balance' : 'Unpaid'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!students.length && <Empty title="No students found" />}
            </>
          ) : tab === 'Transactions' ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Student</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.id}
                        <small className="block muted">{p.date}</small>
                      </td>
                      <td>{data.students.find((s) => s.id === p.studentId)?.name}</td>
                      <td>{money(p.amount)}</td>
                      <td>{p.method}</td>
                      <td>
                        <button
                          className="icon-btn"
                          aria-label={`View receipt ${p.id}`}
                          onClick={() => setReceipt(p)}
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Expense / vendor</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.title}</strong>
                        <small className="block muted">{e.vendor}</small>
                      </td>
                      <td>{e.category}</td>
                      <td>{money(e.amount)}</td>
                      <td>
                        <Badge tone={e.status === 'Approved' ? 'green' : 'amber'}>{e.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="finance-side">
          <Card>
            <CardTitle
              title="Fee structure"
              action={
                !isStudent && (
                  <button
                    className="icon-btn"
                    aria-label="Edit fee structure"
                    onClick={() => setModal('fees')}
                  >
                    <Settings2 size={18} />
                  </button>
                )
              }
            />
            <select
              aria-label="Fee structure class"
              value={isStudent ? all[0]?.classId : feeClass}
              disabled={isStudent}
              onChange={(e) => setFeeClass(e.target.value)}
            >
              {classList.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <dl className="fee-lines">
              {Object.entries(data.fees[isStudent ? all[0]?.classId : feeClass] || {}).map(
                ([name, amount]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{money(amount)}</dd>
                  </div>
                ),
              )}
            </dl>
            <div className="fee-total">
              <strong>Total per term</strong>
              <strong>
                {money(
                  Object.values(data.fees[isStudent ? all[0]?.classId : feeClass] || {}).reduce(
                    (a, b) => a + b,
                    0,
                  ),
                )}
              </strong>
            </div>
          </Card>
          <Card>
            <CardTitle title="Recent payments" />
            {transactions
              .slice(-4)
              .reverse()
              .map((p) => (
                <button className="transaction-row" key={p.id} onClick={() => setReceipt(p)}>
                  <span className="activity-icon green">
                    <Wallet size={17} />
                  </span>
                  <span>
                    <strong>{data.students.find((s) => s.id === p.studentId)?.name}</strong>
                    <small>
                      {money(p.amount)} · {p.method}
                    </small>
                  </span>
                  <Eye size={15} />
                </button>
              ))}
            {!transactions.length && (
              <Empty title="No payments recorded" text="Payments will appear here." />
            )}
          </Card>
        </div>
      </div>
      {modal === 'payment' && (
        <Modal title="Record a student payment" onClose={() => setModal('')}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const studentId = String(f.get('student'));
              const amount = Number(f.get('amount'));
              const s = data.students.find((s) => s.id === studentId)!;
              if (amount > billed(data, s) - paid(data, studentId)) {
                notify('Payment exceeds the outstanding balance. Check the amount.');
                return;
              }
              const p: Payment = {
                id: `REC-${Date.now()}`,
                studentId,
                amount,
                method: String(f.get('method')),
                date: String(f.get('date')),
                notes: String(f.get('notes')),
                term: data.settings.term,
              };
              update(
                (d) => ({ ...d, payments: [...d.payments, p] }),
                `Payment recorded: ${money(p.amount)} for ${s.name}`,
              );
              setModal('');
              setReceipt(p);
              notify('Payment recorded. Your receipt is ready to print.');
            }}
          >
            <Field label="Student">
              <select name="student" required>
                {data.students.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name} · Balance {money(billed(data, s) - paid(data, s.id))}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Amount (GH₵)">
                <input type="number" name="amount" required min="0.01" step="0.01" />
              </Field>
              <Field label="Payment method">
                <select name="method">
                  <option>Cash</option>
                  <option>Mobile Money</option>
                  <option>Bank Deposit / Transfer</option>
                </select>
              </Field>
              <Field label="Payment date">
                <input type="date" required name="date" defaultValue={today()} />
              </Field>
            </div>
            <Field label="Notes (optional)">
              <textarea name="notes" />
            </Field>
            <div className="modal-actions">
              <Button type="submit">
                <Receipt size={16} />
                Record & view receipt
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'expense' && (
        <Modal title="Record an expense" onClose={() => setModal('')}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              update(
                (d) => ({
                  ...d,
                  expenses: [
                    {
                      id: uid(),
                      title: String(f.get('title')),
                      category: String(f.get('category')),
                      vendor: String(f.get('vendor')),
                      amount: Number(f.get('amount')),
                      status: String(f.get('status')),
                      date: today(),
                    },
                    ...d.expenses,
                  ],
                }),
                'Operating expense recorded',
              );
              notify('Expense saved.');
              setModal('');
            }}
          >
            <Field label="Description">
              <input required name="title" />
            </Field>
            <div className="form-grid">
              <Field label="Category">
                <select name="category">
                  {['Supplies', 'Utilities', 'Fuel', 'Maintenance', 'Stationery', 'Other'].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Vendor">
                <input name="vendor" required />
              </Field>
              <Field label="Amount (GH₵)">
                <input required type="number" min="0.01" step="0.01" name="amount" />
              </Field>
              <Field label="Approval status">
                <select name="status">
                  <option>Pending</option>
                  <option>Approved</option>
                </select>
              </Field>
            </div>
            <div className="modal-actions">
              <Button type="submit">Save expense</Button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'fees' && (
        <Modal title={`Fee structure · ${feeClass}`} onClose={() => setModal('')}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const fees = Object.fromEntries(
                Array.from(f.entries()).map(([k, v]) => [k, Number(v)]),
              );
              update(
                (d) => ({ ...d, fees: { ...d.fees, [feeClass]: fees } }),
                'Fee structure updated',
              );
              notify('Fee structure saved. Student balances updated.');
              setModal('');
            }}
          >
            <div className="form-grid">
              {[
                'Tuition',
                'ICT levy',
                'PTA dues',
                'Science laboratory',
                'Sports & culture',
                'Examination',
                'Library',
              ].map((k) => (
                <Field key={k} label={`${k} (GH₵)`}>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    name={k}
                    defaultValue={data.fees[feeClass]?.[k] || 0}
                  />
                </Field>
              ))}
            </div>
            <div className="modal-actions">
              <Button type="submit">Save fee structure</Button>
            </div>
          </form>
        </Modal>
      )}
      {receipt && (
        <Modal title="Payment receipt" onClose={() => setReceipt(null)}>
          <div className="receipt-controls">
            <Tabs items={['A4', '58mm thermal']} value={paper} onChange={setPaper} />
          </div>
          <div className={`receipt print-area ${paper === '58mm thermal' ? 'thermal' : ''}`}>
            <img src={data.settings.crest || './crest.svg'} alt="Crest" width="48" />
            <h2>{data.settings.name}</h2>
            <p>{data.settings.address}</p>
            <h3>PAYMENT RECEIPT</h3>
            <dl className="detail-list">
              {[
                ['Receipt', receipt.id],
                ['Date', receipt.date],
                ['Student', data.students.find((s) => s.id === receipt.studentId)?.name || ''],
                ['Method', receipt.method],
                ['Term', String(receipt.term)],
                ['Amount paid', money(receipt.amount)],
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
          </div>
          <div className="modal-actions">
            <Button onClick={() => window.print()}>
              <Printer size={16} />
              Print / Save PDF
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Payroll() {
  const { data, update, notify } = useStore();
  const [edit, setEdit] = useState<PayrollRecord | null>(null),
    [slip, setSlip] = useState<PayrollRecord | null>(null);
  const net = (p: PayrollRecord) => p.basic + p.housing + p.transport - p.tax;
  return (
    <>
      <PageHeader
        eyebrow="THE PEOPLE BEHIND THE PROGRESS"
        title="Payroll ledger"
        description="A clear view of staff salaries, allowances, and deductions."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              csv('payroll-summary.csv', [
                ['Staff', 'Basic', 'Housing', 'Transport', 'Tax', 'Net', 'Status'],
                ...data.payroll.map((p) => [
                  p.name,
                  p.basic,
                  p.housing,
                  p.transport,
                  p.tax,
                  net(p),
                  p.paid ? 'Paid' : 'Pending',
                ]),
              ])
            }
          >
            <Download size={16} />
            Export summary
          </Button>
        }
      />
      <div className="stats-grid three">
        <Stat label="Staff on payroll" value={data.payroll.length} icon={<Landmark />} />
        <Stat
          label="Monthly net pay"
          value={money(data.payroll.reduce((a, p) => a + net(p), 0))}
          icon={<Wallet />}
          tone="green"
        />
        <Stat
          label="Awaiting payment"
          value={data.payroll.filter((p) => !p.paid).length}
          icon={<Receipt />}
          tone="amber"
        />
      </div>
      <Card>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Basic salary</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net pay</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.payroll.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Person name={p.name} sub={p.job} />
                  </td>
                  <td>{money(p.basic)}</td>
                  <td>{money(p.housing + p.transport)}</td>
                  <td>{money(p.tax)}</td>
                  <td>
                    <strong>{money(net(p))}</strong>
                  </td>
                  <td>
                    <Badge tone={p.paid ? 'green' : 'amber'}>{p.paid ? 'Paid' : 'Pending'}</Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button variant="ghost" onClick={() => setEdit(p)}>
                        Edit
                      </Button>
                      <button
                        className="icon-btn"
                        aria-label={`Pay slip for ${p.name}`}
                        onClick={() => setSlip(p)}
                      >
                        <Printer size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && (
        <Modal title={`Payroll · ${edit.name}`} onClose={() => setEdit(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fields = new FormData(e.currentTarget);
              const record = {
                ...edit,
                basic: Number(fields.get('basic')),
                housing: Number(fields.get('housing')),
                transport: Number(fields.get('transport')),
                tax: Number(fields.get('tax')),
              };
              if (net(record) < 0) {
                notify('Deductions cannot exceed total salary and allowances.');
                return;
              }
              update(
                (d) => ({ ...d, payroll: d.payroll.map((p) => (p.id === edit.id ? record : p)) }),
                'Payroll record updated',
              );
              setEdit(null);
              notify('Payroll record saved.');
            }}
          >
            <div className="form-grid">
              {(['basic', 'housing', 'transport', 'tax'] as const).map((k) => (
                <Field label={k[0].toUpperCase() + k.slice(1) + ' (GH₵)'} key={k}>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    name={k}
                    defaultValue={edit[k]}
                  />
                </Field>
              ))}
            </div>
            <Field label="Payment status">
              <select
                value={edit.paid ? 'Paid' : 'Pending'}
                onChange={(e) => setEdit({ ...edit, paid: e.target.value === 'Paid' })}
              >
                <option>Pending</option>
                <option>Paid</option>
              </select>
            </Field>
            <div className="modal-actions">
              <Button type="submit">Save payroll</Button>
            </div>
          </form>
        </Modal>
      )}
      {slip && (
        <Modal title="Employee pay slip" onClose={() => setSlip(null)}>
          <div className="receipt print-area">
            <h2>{data.settings.name}</h2>
            <p>
              Monthly salary statement ·{' '}
              {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </p>
            <h3>{slip.name}</h3>
            <p>{slip.job}</p>
            <dl className="detail-list">
              {[
                ['Basic salary', slip.basic],
                ['Housing allowance', slip.housing],
                ['Transport allowance', slip.transport],
                ['Tax deduction', slip.tax],
                ['Net salary', net(slip)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{money(Number(v))}</dd>
                </div>
              ))}
            </dl>
            <p>Payment status: {slip.paid ? 'Paid' : 'Pending'}</p>
          </div>
          <div className="modal-actions">
            <Button onClick={() => window.print()}>
              <Printer size={16} />
              Print / Save PDF
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
