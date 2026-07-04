import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, ShieldAlert, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function MyProfile() {
  const { user, token, login } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If the user's role/properties are updated, they will reflect here
  const is2FAEnabled = user?.twoFactorEnabled === 1;

  const generate2FA = async () => {
    setError('');
    setIsGenerating(true);
    try {
      const res = await fetch('/api/auth/2fa/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate 2FA');
      
      setQrCode(data.qrCode);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: verifyCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify code');
      
      setSuccessMsg('Two-Factor Authentication successfully enabled!');
      setQrCode(null);
      setVerifyCode('');
      
      // Update local user state
      if (user && token) {
        login(token, { ...user, twoFactorEnabled: 1 });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!confirm('Are you sure you want to disable Two-Factor Authentication?')) return;
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disable 2FA');
      
      setSuccessMsg('Two-Factor Authentication has been disabled.');
      if (user && token) {
        login(token, { ...user, twoFactorEnabled: 0 });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Profile</h2>
        <p className="text-slate-500 text-sm mt-1">Manage your account settings and security preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Security</h3>
          <p className="text-sm text-slate-500">Protect your account with Two-Factor Authentication.</p>
        </div>
        
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
             {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}
            
            {successMsg && (
              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl text-sm border border-emerald-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                {successMsg}
              </div>
            )}
            
            <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50">
               <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${is2FAEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                    {is2FAEnabled ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Two-Factor Authentication</h4>
                    <p className="text-sm text-slate-500">
                      {is2FAEnabled 
                        ? 'Your account is protected.' 
                        : 'Add an extra layer of security to your account.'}
                    </p>
                  </div>
               </div>
               
               {!is2FAEnabled && !qrCode && (
                 <button 
                   onClick={generate2FA} 
                   disabled={isGenerating}
                   className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                 >
                   {isGenerating ? 'Setting up...' : 'Setup 2FA'}
                 </button>
               )}
               
               {is2FAEnabled && (
                  <button 
                    onClick={disable2FA} 
                    disabled={isLoading}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition border border-red-100"
                  >
                    {isLoading ? 'Disabling...' : 'Disable 2FA'}
                  </button>
               )}
            </div>

            {qrCode && !is2FAEnabled && (
              <div className="p-6 border border-indigo-100 rounded-xl bg-indigo-50 flex flex-col items-center text-center space-y-4">
                <Shield className="w-12 h-12 text-indigo-600" />
                <h4 className="text-lg font-bold text-slate-900">Scan QR Code</h4>
                <p className="text-sm text-slate-600 max-w-sm">
                  1. Download an authenticator app like Google Authenticator or Authy.<br/>
                  2. Scan the QR code below.<br/>
                  3. Enter the 6-digit code to verify setup.
                </p>
                <div className="bg-white p-2 rounded-xl shadow-sm">
                   <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
                
                <form onSubmit={handleVerify2FA} className="w-full max-w-xs space-y-3 pt-4">
                  <input
                    type="text"
                    required
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-lg border-slate-300 rounded-xl py-3 border tracking-widest text-center font-mono"
                    placeholder="123456"
                    maxLength={6}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || verifyCode.length !== 6}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? 'Verifying...' : 'Verify and Enable'}
                  </button>
                </form>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
