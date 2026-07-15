import React, { useState, useEffect } from "react";
import { Employee, PayrollRecord, WorkerType } from "../types";
import { generateUUID } from "../utils";
import {
  Users,
  DollarSign,
  Plus,
  CreditCard,
  CheckCircle2,
  Clock,
  Search,
  MoreVertical,
  LogIn,
  LogOut,
  Sliders,
  Percent,
  Coins,
  Settings as SettingsIcon,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight
} from "lucide-react";

interface GlobalPayrollSettings {
  defaultHourlyRate: number;
  defaultCommissionRate: number; // percentage, e.g. 10 for 10%
  defaultFlatFee: number;
  taxWithholdingRate: number; // percentage, e.g. 15 for 15%
}

export function Payroll({
  employees,
  setEmployees,
  payrollRecords,
  setPayrollRecords,
  businessId,
}: {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  payrollRecords: PayrollRecord[];
  setPayrollRecords: React.Dispatch<React.SetStateAction<PayrollRecord[]>>;
  businessId: string;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"employees" | "history" | "settings">(
    "employees"
  );
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Load and manage custom business-level global payroll settings
  const [payrollSettings, setPayrollSettings] = useState<GlobalPayrollSettings>(() => {
    const saved = localStorage.getItem(`tickit_${businessId}_payroll_settings`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return {
      defaultHourlyRate: 25,
      defaultCommissionRate: 10,
      defaultFlatFee: 1500,
      taxWithholdingRate: 12,
    };
  });

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem(`tickit_${businessId}_payroll_settings`, JSON.stringify(payrollSettings));
  }, [payrollSettings, businessId]);

  const processPayroll = () => {
    const activeEmployees = employees.filter((e) => e.status === "active");
    if (activeEmployees.length === 0) {
      alert("No active employees found to process payroll.");
      return;
    }

    const newRecords: PayrollRecord[] = activeEmployees.map((e) => {
      let grossAmount = e.salary;
      
      if (e.workerType === "hourly") {
        const rate = e.hourlyRate !== undefined ? e.hourlyRate : payrollSettings.defaultHourlyRate;
        grossAmount = rate * (e.hoursWorked || 0);
      } else if (e.workerType === "commission") {
        const rate = e.commissionRate !== undefined ? e.commissionRate : payrollSettings.defaultCommissionRate;
        const basis = e.commissionBasis !== undefined ? e.commissionBasis : 12500; // default sales basis
        grossAmount = (rate / 100) * basis;
      } else if (e.workerType === "flat-fee") {
        grossAmount = e.flatFeeRate !== undefined ? e.flatFeeRate : payrollSettings.defaultFlatFee;
      }

      // Calculate net amount based on tax withholding
      const deduction = grossAmount * (payrollSettings.taxWithholdingRate / 100);
      const netAmount = Math.max(0, grossAmount - deduction);

      return {
        id: generateUUID(),
        employeeId: e.id,
        employeeName: e.name,
        amount: parseFloat(netAmount.toFixed(2)),
        date: new Date().toISOString(),
        status: "pending",
      };
    });
    
    setPayrollRecords([...newRecords, ...payrollRecords]);

    // BUG FIX: hoursWorked accumulates continuously via check-in/check-out and manual time
    // logging, but was never reset after being paid out — every subsequent payroll run was
    // re-paying the same already-compensated hours on top of new ones. Reset hourly
    // employees' hoursWorked to 0 now that this batch has been included in a payroll record.
    setEmployees(
      employees.map((e) =>
        e.status === "active" && e.workerType === "hourly" ? { ...e, hoursWorked: 0 } : e
      )
    );

    setActiveSubTab("history");
    alert(`Generated ${newRecords.length} payroll records for active employees with a ${payrollSettings.taxWithholdingRate}% standard tax withholding.`);
  };

  const markAsPaid = (id: string) => {
    setPayrollRecords(
      payrollRecords.map((r) => (r.id === id ? { ...r, status: "paid" } : r))
    );
  };

  const handleCheckInOut = (employeeId: string) => {
    setEmployees(employees.map(e => {
      if (e.id === employeeId) {
        const now = new Date();
        if (e.isCheckedIn) {
          // Check out
          const checkInTime = new Date(e.lastCheckIn!);
          const hours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
          return {
            ...e,
            isCheckedIn: false,
            lastCheckIn: undefined,
            hoursWorked: (e.hoursWorked || 0) + parseFloat(hours.toFixed(2))
          };
        } else {
          // Check in
          return {
            ...e,
            isCheckedIn: true,
            lastCheckIn: now.toISOString()
          };
        }
      }
      return e;
    }));
  };

  const toggleEmployeeStatus = (employeeId: string) => {
    setEmployees(employees.map(e => {
      if (e.id === employeeId) {
        return {
          ...e,
          status: e.status === "active" ? "inactive" : "active"
        };
      }
      return e;
    }));
  };

  const deleteEmployee = (employeeId: string) => {
    if (confirm("Are you sure you want to remove this employee from your workspace payroll database?")) {
      setEmployees(employees.filter(e => e.id !== employeeId));
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Payroll Management</h2>
          <p className="text-slate-500 text-sm mt-1">
            Configure employee compensation, track billable rates, and issue payments seamlessly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              setEditingEmployee(null);
              setIsModalOpen(true);
            }}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            Add Employee
          </button>
          <button
            onClick={processPayroll}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-indigo-200" />
            Process Monthly Payroll
          </button>
        </div>
      </div>

      {/* SUB-TAB DIVISION */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab("employees")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative cursor-pointer ${
            activeSubTab === "employees"
              ? "text-indigo-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            Employees list
          </span>
          {activeSubTab === "employees" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab("history")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative cursor-pointer ${
            activeSubTab === "history"
              ? "text-indigo-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            Payment History
          </span>
          {activeSubTab === "history" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab("settings")}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative cursor-pointer ${
            activeSubTab === "settings"
              ? "text-indigo-600 font-extrabold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <SettingsIcon className="w-4 h-4" />
            Payroll Settings
          </span>
          {activeSubTab === "settings" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
          )}
        </button>
      </div>

      {/* RENDER ACTIVE SUBTAB CONTENT */}
      {activeSubTab === "employees" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Role / Job
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Pay Model
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Rate Configuration
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Payment Channel
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block text-sm">
                            {employee.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            ID: {employee.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {employee.role}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold capitalize text-slate-700">
                      <span className={`px-2.5 py-1 rounded-lg ${
                        employee.workerType === 'commission' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        employee.workerType === 'flat-fee' ? 'bg-cyan-50 text-cyan-700 border border-cyan-100' :
                        employee.workerType === 'hourly' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {employee.workerType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {employee.workerType === "hourly" ? (
                        <div className="space-y-0.5">
                          <span>${employee.hourlyRate !== undefined ? employee.hourlyRate : payrollSettings.defaultHourlyRate}/hr</span>
                          <span className="block text-[10px] font-normal text-slate-400">Worked: {employee.hoursWorked || 0}h</span>
                        </div>
                      ) : employee.workerType === "commission" ? (
                        <div className="space-y-0.5">
                          <span>{employee.commissionRate !== undefined ? employee.commissionRate : payrollSettings.defaultCommissionRate}% Commission</span>
                          <span className="block text-[10px] font-normal text-slate-400">Sales Base: ${(employee.commissionBasis !== undefined ? employee.commissionBasis : 12500).toLocaleString()}</span>
                        </div>
                      ) : employee.workerType === "flat-fee" ? (
                        <span>${(employee.flatFeeRate !== undefined ? employee.flatFeeRate : payrollSettings.defaultFlatFee).toLocaleString()} flat</span>
                      ) : (
                        <span>${employee.salary.toLocaleString()}{employee.workerType === "bi-weekly" ? "/bi-wk" : "/mo"}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {employee.paymentMethod}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleEmployeeStatus(employee.id)}
                        className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer transition-colors ${
                          employee.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${employee.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {employee.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {employee.workerType === "hourly" && (
                          <button
                            onClick={() => handleCheckInOut(employee.id)}
                            className={`px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer ${
                              employee.isCheckedIn
                                ? "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100"
                                : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100"
                            }`}
                            title={employee.isCheckedIn ? "Check Out" : "Check In"}
                          >
                            {employee.isCheckedIn ? (
                              <>
                                <LogOut className="w-3 h-3" />
                                Out
                              </>
                            ) : (
                              <>
                                <LogIn className="w-3 h-3" />
                                In
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingEmployee(employee);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          title="Edit Employee"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteEmployee(employee.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          title="Remove Employee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No employees registered for this business. Click "Add Employee" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Net Payout (After Tax)
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Payment Issue Date
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 text-sm">
                      {record.employeeName}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      ${record.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(record.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {record.status === "paid" ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            Pending Approval
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {record.status === "pending" && (
                        <button
                          onClick={() => markAsPaid(record.id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest cursor-pointer bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Disburse Funds
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {payrollRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-400 text-sm"
                    >
                      No processed payroll disbursements found in workspace history.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "settings" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Configure Default Compensation Metrics</h3>
              <p className="text-xs text-slate-500 mt-0.5">Global defaults applied to employees who do not have overridden values.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* HOURLY DEFAULT */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Default Hourly Rate ($/hr)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={payrollSettings.defaultHourlyRate}
                  onChange={(e) => setPayrollSettings({
                    ...payrollSettings,
                    defaultHourlyRate: parseFloat(e.target.value) || 0
                  })}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm font-semibold"
                />
              </div>
              <p className="text-[10px] text-slate-400">Applied when no direct hourly rate is specified.</p>
            </div>

            {/* COMMISSION DEFAULT */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Default Commission Percentage (%)
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={payrollSettings.defaultCommissionRate}
                  onChange={(e) => setPayrollSettings({
                    ...payrollSettings,
                    defaultCommissionRate: parseFloat(e.target.value) || 0
                  })}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm font-semibold"
                />
              </div>
              <p className="text-[10px] text-slate-400">Percentage paid to commission employees based on sales.</p>
            </div>

            {/* FLAT FEE DEFAULT */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Default Flat Fee ($)
              </label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={payrollSettings.defaultFlatFee}
                  onChange={(e) => setPayrollSettings({
                    ...payrollSettings,
                    defaultFlatFee: parseFloat(e.target.value) || 0
                  })}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm font-semibold"
                />
              </div>
              <p className="text-[10px] text-slate-400">Fixed rate distributed per standard period.</p>
            </div>

            {/* TAX WITHHOLDING DEFAULT */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Standard Tax Withholding (%)
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={payrollSettings.taxWithholdingRate}
                  onChange={(e) => setPayrollSettings({
                    ...payrollSettings,
                    taxWithholdingRate: parseFloat(e.target.value) || 0
                  })}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm font-semibold"
                />
              </div>
              <p className="text-[10px] text-slate-400">Taxes withheld during monthly payroll execution.</p>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-800 leading-relaxed">
              <p className="font-bold">Dynamic Tenant Level Persistence</p>
              <p className="mt-0.5">These rules are stored securely on your active business partition. Transitioning or toggling workspace domains swaps active configurations immediately.</p>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC FORM MODAL (HANDLES BOTH ADD AND EDIT) */}
      {isModalOpen && (
        <EmployeeFormModal
          employee={editingEmployee}
          payrollSettings={payrollSettings}
          onClose={() => setIsModalOpen(false)}
          onSave={(savedData) => {
            if (editingEmployee) {
              // Edit Mode
              setEmployees(employees.map(e => e.id === editingEmployee.id ? { ...e, ...savedData } : e));
            } else {
              // Create Mode
              const newEmp: Employee = {
                ...savedData,
                id: generateUUID(),
              };
              setEmployees([...employees, newEmp]);
            }
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EmployeeFormModal({
  employee,
  payrollSettings,
  onClose,
  onSave,
}: {
  employee: Employee | null;
  payrollSettings: GlobalPayrollSettings;
  onClose: () => void;
  onSave: (emp: Omit<Employee, "id">) => void;
}) {
  const [name, setName] = useState(employee ? employee.name : "");
  const [role, setRole] = useState(employee ? employee.role : "");
  
  const [workerType, setWorkerType] = useState<WorkerType>(
    employee ? employee.workerType : "salary"
  );
  
  const [salary, setSalary] = useState(employee ? employee.salary.toString() : "");
  const [hourlyRate, setHourlyRate] = useState(
    employee && employee.hourlyRate !== undefined ? employee.hourlyRate.toString() : ""
  );
  const [hoursWorked, setHoursWorked] = useState(
    employee && employee.hoursWorked !== undefined ? employee.hoursWorked.toString() : ""
  );
  
  const [commissionRate, setCommissionRate] = useState(
    employee && employee.commissionRate !== undefined ? employee.commissionRate.toString() : ""
  );
  const [commissionBasis, setCommissionBasis] = useState(
    employee && employee.commissionBasis !== undefined ? employee.commissionBasis.toString() : ""
  );
  
  const [flatFeeRate, setFlatFeeRate] = useState(
    employee && employee.flatFeeRate !== undefined ? employee.flatFeeRate.toString() : ""
  );

  const [paymentMethod, setPaymentMethod] = useState<Employee["paymentMethod"]>(
    employee ? employee.paymentMethod : "Bank Transfer"
  );
  
  const [status, setStatus] = useState<Employee["status"]>(
    employee ? employee.status : "active"
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-950">
              {employee ? "Edit Employee Compensation" : "Add Employee to Roster"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {employee ? "Modify rate rules or contract variables" : "Enter personal metrics and initial salary details"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        {/* FORM */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            
            // Format rates
            const salaryNum = workerType === "salary" || workerType === "bi-weekly" ? parseFloat(salary || "0") : 0;
            const hourRateNum = workerType === "hourly" ? (hourlyRate ? parseFloat(hourlyRate) : undefined) : undefined;
            const hourWorkNum = workerType === "hourly" ? (hoursWorked ? parseFloat(hoursWorked) : 0) : undefined;
            
            const commRateNum = workerType === "commission" ? (commissionRate ? parseFloat(commissionRate) : undefined) : undefined;
            const commBasisNum = workerType === "commission" ? (commissionBasis ? parseFloat(commissionBasis) : 12500) : undefined;
            
            const flatFeeNum = workerType === "flat-fee" ? (flatFeeRate ? parseFloat(flatFeeRate) : undefined) : undefined;

            onSave({
              name: name.trim(),
              role: role.trim(),
              salary: salaryNum,
              hourlyRate: hourRateNum,
              hoursWorked: hourWorkNum,
              commissionRate: commRateNum,
              commissionBasis: commBasisNum,
              flatFeeRate: flatFeeNum,
              workerType,
              paymentMethod,
              status,
              isCheckedIn: employee?.isCheckedIn || false,
              lastCheckIn: employee?.lastCheckIn,
              timeCards: employee?.timeCards || []
            });
          }}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          {/* PERSONAL INFO */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Johnathan Taylor"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Role / Title <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Lead Designer"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm"
              />
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* COMPENSATION MODELS */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Worker Compensation Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={workerType}
                onChange={(e) => setWorkerType(e.target.value as WorkerType)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800 text-sm font-medium"
              >
                <option value="salary">Salary (Monthly)</option>
                <option value="bi-weekly">Bi-Weekly (Fixed)</option>
                <option value="hourly">Hourly Billing</option>
                <option value="commission">Commission Based</option>
                <option value="flat-fee">Flat Fee Contract</option>
              </select>
            </div>

            {/* DYNAMIC INPUTS ACCORDING TO TYPE */}
            {workerType === "hourly" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Hourly Rate ($)
                    </label>
                    <span className="text-[9px] text-slate-400">Default: ${payrollSettings.defaultHourlyRate}</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder={payrollSettings.defaultHourlyRate.toString()}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Hours Worked
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={hoursWorked}
                    onChange={(e) => setHoursWorked(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm"
                  />
                </div>
              </div>
            ) : workerType === "commission" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Comm. Rate (%)
                    </label>
                    <span className="text-[9px] text-slate-400">Default: {payrollSettings.defaultCommissionRate}%</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    placeholder={payrollSettings.defaultCommissionRate.toString()}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Sales Basis ($)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={commissionBasis}
                    onChange={(e) => setCommissionBasis(e.target.value)}
                    placeholder="12500"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm"
                  />
                </div>
              </div>
            ) : workerType === "flat-fee" ? (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Flat Fee Rate ($)
                  </label>
                  <span className="text-[9px] text-slate-400">Default: ${payrollSettings.defaultFlatFee}</span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={flatFeeRate}
                  onChange={(e) => setFlatFeeRate(e.target.value)}
                  placeholder={payrollSettings.defaultFlatFee.toString()}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  {workerType === "salary" ? "Monthly Salary Amount ($)" : "Bi-Weekly Rate Amount ($)"}
                </label>
                <input
                  required
                  type="number"
                  step="any"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="3500"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-sm"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Disbursal Route
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as Employee["paymentMethod"])}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800 text-sm"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Check">Check Payment</option>
                  <option value="PayPal">PayPal Invoice</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Database Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Employee["status"])}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-800 text-sm"
                >
                  <option value="active">Active Payroll</option>
                  <option value="inactive">Inactive Hold</option>
                </select>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="pt-5 border-t border-slate-100 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer text-center"
            >
              {employee ? "Apply Changes" : "Create Employee Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
