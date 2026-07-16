import React, { useState } from "react";
import { X, CreditCard, Lock, CheckCircle2 } from "lucide-react";

interface PaymentModalProps {
  amount: number;
  type: "deposit" | "final";
  onSuccess: () => void;
  onClose: () => void;
}

export function PaymentModal({ amount, type, onSuccess, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<"card" | "paypal" | "stripe">("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate network delay for Mock API
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }, 2000);
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h2>
          <p className="text-slate-500 mb-6">Your payment of ${amount.toLocaleString()} has been processed securely.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-500" /> Secure Checkout
          </h3>
          <button onClick={onClose} title="Close checkout" className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-8 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">
              {type === "deposit" ? "30% Project Deposit" : "Final Balance"}
            </p>
            <p className="text-4xl font-black text-slate-900 tracking-tight">
              ${amount.toLocaleString()}
            </p>
          </div>

          {/* Payment Methods */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setMethod("card")}
              className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "card" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50"}`}
            >
              <CreditCard className="w-6 h-6" />
              <span className="text-xs font-bold">Card</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod("stripe")}
              className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "stripe" ? "border-[#635BFF] bg-indigo-50 text-[#635BFF]" : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50"}`}
            >
              <div className="w-6 h-6 flex items-center justify-center font-black text-lg tracking-tighter italic">S</div>
              <span className="text-xs font-bold">Stripe</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod("paypal")}
              className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "paypal" ? "border-[#00457C] bg-blue-50 text-[#00457C]" : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50"}`}
            >
              <div className="w-6 h-6 flex items-center justify-center font-black text-lg italic tracking-tighter">P</div>
              <span className="text-xs font-bold">PayPal</span>
            </button>
          </div>

          <form onSubmit={handlePay} className="space-y-4">
            {method === "card" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Card Number</label>
                  <input required placeholder="0000 0000 0000 0000" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Expiry</label>
                    <input required placeholder="MM/YY" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">CVC</label>
                    <input required placeholder="123" type="password" maxLength={4} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Cardholder Name</label>
                  <input required placeholder="John Doe" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium" />
                </div>
              </div>
            )}
            
            {method !== "card" && (
              <div className="py-8 text-center animate-in fade-in zoom-in-95 duration-300 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <p className="text-sm font-bold text-slate-600 mb-2">
                  Pay securely with {method === "stripe" ? "Stripe" : "PayPal"}
                </p>
                <p className="text-xs text-slate-400 px-8">
                  You will be redirected to the secure {method} checkout portal to complete your transaction.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                method === "stripe" ? "bg-[#635BFF] hover:bg-[#5249f5] text-white shadow-[#635BFF]/30" :
                method === "paypal" ? "bg-[#FFC439] hover:bg-[#f5bc36] text-[#003087] shadow-[#FFC439]/30" :
                "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30"
              }`}
            >
              {isProcessing ? (
                <span className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Pay {method === "stripe" ? "with Stripe" : method === "paypal" ? "with PayPal" : "Securely"} - ${amount.toLocaleString()}
                </>
              )}
            </button>
            <div className="flex justify-center items-center gap-1.5 pt-4 opacity-50">
              <Lock className="w-3 h-3 text-slate-900" />
              <p className="text-xs font-bold text-slate-900 uppercase tracking-widest text-center">AES-256 Encrypted</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
