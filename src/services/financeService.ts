import {
  billed,
  paid,
  money,
  today,
  uid,
  type Expense,
  type Payment,
  type State,
  type Student,
} from '../data';

export interface AdminFinancialAudit {
  totalStudents: number;
  totalClasses: number;
  totalBilled: number;
  totalCollected: number;
  totalArrears: number;
  debtorCount: number;
  criticalDebtorsCount: number;
  collectionEfficiency: number;
  netOperatingCash: number;
}

export interface DebtorRecord {
  student: Student;
  billed: number;
  paid: number;
  balance: number;
  arrearsPercentage: number;
  risk: 'Unbilled' | 'Cleared' | 'Low' | 'Moderate' | 'Critical';
  lastPayment?: Payment;
  paymentCount: number;
}

export interface FinancialSummary extends AdminFinancialAudit {
  debtors: DebtorRecord[];
  totalExpenditure: number;
  recentPayments: Payment[];
  moderateDebtorsCount: number;
  lowRiskDebtorsCount: number;
}

export interface StudentLedger {
  studentId: string;
  term: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
  fees: {
    id: string;
    categoryName: string;
    term: number;
    amountDue: number;
    amountPaid: number;
    balance: number;
  }[];
  payments: Payment[];
}

export interface NewPayment {
  studentId: string;
  amount: number;
  method: string;
  date?: string;
  notes?: string;
  transactionRef?: string;
  term?: number;
}

const paymentReceiptNumber = (state: State) => {
  const year = new Date().getFullYear();
  const sameYear = state.payments.filter((p) => (p.receiptNumber || p.id).includes(`RCP-${year}-`));
  const next =
    sameYear.reduce((max, payment) => {
      const match = (payment.receiptNumber || payment.id).match(/(\d{5})$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0) + 1;
  return `RCP-${year}-${String(next).padStart(5, '0')}`;
};

/** School-wide billing reconciliation and arrears surveillance for administrators. */
export const financeService = {
  /** Return only the requested student's current-term invoice lines and receipts. */
  getStudentLedger(state: State, studentId: string): StudentLedger | null {
    const student = state.students.find((entry) => entry.id === studentId);
    if (!student) return null;
    const totalDue = billed(state, student);
    const payments = state.payments
      .filter((payment) => payment.studentId === studentId && payment.term === state.settings.term)
      .sort((a, b) => b.date.localeCompare(a.date));
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    let remainingPaid = totalPaid;
    const concession = state.studentConcessions?.[studentId] || 0;
    const fees = Object.entries(state.fees[student.classId] || {}).map(([categoryName, amount]) => {
      const amountDue = Math.round(amount * (1 - concession / 100) * 100) / 100;
      const amountPaid = Math.min(amountDue, remainingPaid);
      remainingPaid = Math.max(0, remainingPaid - amountPaid);
      return {
        id: `${studentId}-${state.settings.term}-${categoryName}`,
        categoryName,
        term: state.settings.term,
        amountDue,
        amountPaid,
        balance: Math.max(0, amountDue - amountPaid),
      };
    });
    return {
      studentId,
      term: state.settings.term,
      totalDue,
      totalPaid,
      balance: Math.max(0, totalDue - totalPaid),
      fees,
      payments,
    };
  },

  /** Reconciles term billing, receipts, arrears, and debtor risk for the active school data. */
  getFinancialSummary(state: State): FinancialSummary {
    let totalBilled = 0;
    let totalCollected = 0;
    let totalArrears = 0;
    let debtorCount = 0;
    let criticalDebtorsCount = 0;
    let moderateDebtorsCount = 0;
    let lowRiskDebtorsCount = 0;
    const debtors = state.students.map((student): DebtorRecord => {
      const amountBilled = billed(state, student);
      const amountPaid = paid(state, student.id);
      const balance = Math.max(0, amountBilled - amountPaid);
      const arrearsPercentage = amountBilled > 0 ? Math.round((balance / amountBilled) * 100) : 0;
      const payments = state.payments
        .filter((p) => p.studentId === student.id && p.term === state.settings.term)
        .sort((a, b) => b.date.localeCompare(a.date));
      const risk: DebtorRecord['risk'] =
        amountBilled <= 0
          ? 'Unbilled'
          : balance <= 0
            ? 'Cleared'
            : arrearsPercentage >= 60
              ? 'Critical'
              : arrearsPercentage >= 25
                ? 'Moderate'
                : 'Low';
      totalBilled += amountBilled;
      totalCollected += amountPaid;
      totalArrears += balance;
      if (balance > 0) debtorCount += 1;
      if (risk === 'Critical') criticalDebtorsCount += 1;
      if (risk === 'Moderate') moderateDebtorsCount += 1;
      if (risk === 'Low') lowRiskDebtorsCount += 1;
      return {
        student,
        billed: amountBilled,
        paid: amountPaid,
        balance,
        arrearsPercentage,
        risk,
        lastPayment: payments[0],
        paymentCount: payments.length,
      };
    });
    const totalExpenditure = state.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const payrollDisbursements = state.payroll
      .filter((item) => item.paid)
      .reduce((sum, item) => sum + item.basic + item.housing + item.transport - item.tax, 0);
    return {
      totalStudents: state.students.length,
      totalClasses: state.classes.length,
      totalBilled,
      totalCollected,
      totalArrears,
      debtorCount,
      criticalDebtorsCount,
      moderateDebtorsCount,
      lowRiskDebtorsCount,
      collectionEfficiency:
        totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100,
      netOperatingCash: totalCollected - totalExpenditure - payrollDisbursements,
      totalExpenditure,
      debtors: debtors.sort((a, b) => b.balance - a.balance),
      recentPayments: [...state.payments]
        .filter((p) => p.term === state.settings.term)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8),
    };
  },

  /** Writes a uniquely numbered receipt and returns the updated in-memory ledger. */
  recordPayment(
    state: State,
    input: NewPayment,
    recordedBy: string,
  ): { state: State; payment: Payment } {
    const student = state.students.find((entry) => entry.id === input.studentId);
    if (!student) throw new Error('Select a valid student before recording payment.');
    if (!Number.isFinite(input.amount) || input.amount <= 0)
      throw new Error('Enter a payment amount greater than zero.');
    const term = input.term || state.settings.term;
    const outstanding = Math.max(
      0,
      billed(state, student) -
        state.payments
          .filter((payment) => payment.studentId === student.id && payment.term === term)
          .reduce((sum, payment) => sum + payment.amount, 0),
    );
    if (input.amount > outstanding)
      throw new Error(`Payment exceeds the outstanding balance of ${money(outstanding)}.`);
    const receiptNumber = paymentReceiptNumber(state);
    const payment: Payment = {
      id: uid(),
      receiptNumber,
      studentId: student.id,
      amount: input.amount,
      method: input.method,
      date: input.date || today(),
      notes: input.notes || '',
      term,
      transactionRef: input.transactionRef,
      recordedBy,
    };
    return { state: { ...state, payments: [...state.payments, payment] }, payment };
  },

  recordExpenditure(
    state: State,
    input: Omit<Expense, 'id' | 'date'> & { date?: string },
    recordedBy: string,
  ): State {
    const expense: Expense = {
      ...input,
      id: uid(),
      date: input.date || today(),
      recordedBy,
    };
    return { ...state, expenses: [expense, ...state.expenses] };
  },

  getAdminFinancialAudit(state: State): AdminFinancialAudit {
    let totalBilled = 0;
    let totalCollected = 0;
    let totalArrears = 0;
    let debtorCount = 0;
    let criticalDebtorsCount = 0;
    state.students.forEach((student) => {
      const totalFee = billed(state, student);
      const collected = paid(state, student.id);
      const balance = Math.max(0, totalFee - collected);
      totalBilled += totalFee;
      totalCollected += collected;
      if (balance > 0) {
        totalArrears += balance;
        debtorCount += 1;
        if (balance > totalFee * 0.5) criticalDebtorsCount += 1;
      }
    });
    const payrollDisbursements = state.payroll
      .filter((item) => item.paid)
      .reduce((sum, item) => sum + item.basic + item.housing + item.transport - item.tax, 0);
    return {
      totalStudents: state.students.length,
      totalClasses: state.classes.length,
      totalBilled,
      totalCollected,
      totalArrears,
      debtorCount,
      criticalDebtorsCount,
      collectionEfficiency:
        totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100,
      netOperatingCash: totalCollected - payrollDisbursements,
    };
  },
};
