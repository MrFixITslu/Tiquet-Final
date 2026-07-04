import React from "react";
import { Job } from "../types";
import { BusinessSettings } from "./Settings";
import { X, Printer } from "lucide-react";

interface InvoiceViewProps {
    job: Job;
    settings: BusinessSettings;
    onClose: () => void;
}

export function InvoiceView({ job, settings, onClose }: InvoiceViewProps) {
    const invoiceNotes = job.invoiceNotes || "";

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[70] p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-3xl my-8 rounded-none shadow-2xl p-12 relative print:p-0 print:shadow-none print:my-0">
                <button
                    onClick={onClose}
                    title="Close invoice preview"
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 print:hidden"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="flex justify-between items-start mb-12">
                    <div>
                        {settings.logoUrl && (
                            <img
                                src={settings.logoUrl}
                                alt="Logo"
                                className="h-16 mb-4 object-contain"
                                referrerPolicy="no-referrer"
                            />
                        )}
                        <h2 className="text-2xl font-bold text-slate-900">{settings.name}</h2>
                        <p className="text-sm text-slate-500 max-w-xs">{settings.address}</p>
                        <p className="text-sm text-slate-500">
                            {settings.email} | {settings.phone}
                        </p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-4xl font-light text-slate-300 uppercase tracking-widest mb-4">
                            Invoice
                        </h1>
                        <p className="text-sm font-bold text-slate-900">
                            Invoice #: INV-{job.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-sm text-slate-500">
                            Date: {new Date().toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-12">
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                            Bill To:
                        </h4>
                        <p className="font-bold text-slate-900">{job.client}</p>
                        <p className="text-sm text-slate-500">Project: {job.title}</p>
                    </div>
                </div>

                <table className="w-full mb-12">
                    <thead>
                        <tr className="border-b-2 border-slate-900">
                            <th className="text-left py-3 text-xs font-bold uppercase tracking-widest">
                                Description
                            </th>
                            <th className="text-right py-3 text-xs font-bold uppercase tracking-widest">
                                Amount
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {job.lineItems && job.lineItems.length > 0 ? (
                            job.lineItems.map((item) => (
                                <tr key={item.id}>
                                    <td className="py-4 text-sm text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span>{item.description}</span>
                                            {item.quantity > 1 && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{item.quantity} x ${item.unitPrice}</span>}
                                        </div>
                                    </td>
                                    <td className="py-4 text-right text-sm font-medium text-slate-900">
                                        ${(item.quantity * item.unitPrice).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        ) : invoiceNotes.trim() ? (
                            invoiceNotes
                                .split("\n")
                                .filter((line) => line.trim())
                                .map((line, i) => (
                                    <tr key={i}>
                                        <td className="py-4 text-sm text-slate-700">{line}</td>
                                        <td className="py-4 text-right text-sm font-medium text-slate-900">
                                            {line.includes("$") ? line.split("$")[1] : "-"}
                                        </td>
                                    </tr>
                                ))
                        ) : (
                            <tr>
                                <td className="py-4 text-sm text-slate-700">
                                    {job.title} - Full Project
                                </td>
                                <td className="py-4 text-right text-sm font-medium text-slate-900">
                                    ${job.amount?.toLocaleString() || "0"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-slate-900">
                            <td className="py-6 text-right font-bold text-slate-900 uppercase tracking-widest">
                                Total
                            </td>
                            <td className="py-6 text-right text-xl font-bold text-indigo-600">
                                ${job.amount?.toLocaleString()}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div className="border-t border-slate-100 pt-8">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Notes & Terms:
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        {settings.paymentTerms}
                        <br />
                        Thank you for your business!
                    </p>
                </div>

                <div className="mt-12 flex justify-center print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl"
                    >
                        <Printer className="w-5 h-5" />
                        Print Invoice
                    </button>
                </div>
            </div>
        </div>
    );
}
