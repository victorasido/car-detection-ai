import React, { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        // Register flow
        const regRes = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        
        if (!regRes.ok) {
          const errData = await regRes.json();
          throw new Error(errData.detail || "Registration failed");
        }
      }

      // Login flow (always run after register or on normal login)
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      
      if (!res.ok) throw new Error("Invalid username or password");
      const { access_token } = await res.json();
      onLogin(access_token);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl border border-gray-100 flex flex-col gap-8">
        <div className="text-center">
          <div className="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-600 text-[11px] font-black uppercase tracking-widest rounded-full mb-4">
            Vehicle Inspect — Admin
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            {isRegister ? "Create Account" : "Welcome"}
          </h1>
          <p className="text-gray-400 mt-2 text-sm font-medium">
            {isRegister ? "Sign up to access the dashboard" : "Please sign in to access the dashboard"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 px-1">Username</label>
            <input 
              type="text" 
              placeholder="admin" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-gray-900 placeholder-gray-300" 
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 px-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-gray-900 placeholder-gray-300" 
            />
          </div>

          {error && <div className="text-red-500 text-xs font-bold px-1 italic">⚠ {error}</div>}

          <button 
            disabled={loading}
            className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-gray-200 mt-4 disabled:opacity-50"
          >
            {loading ? "Processing..." : (isRegister ? "Register & Enter" : "Enter Dashboard")}
          </button>
        </form>

        <div className="text-center text-[11px] font-bold uppercase tracking-widest">
          {isRegister ? (
            <button 
              type="button" 
              onClick={() => { setIsRegister(false); setError(""); }}
              className="text-gray-400 hover:text-emerald-600 transition-all"
            >
              Already have an account? Sign In
            </button>
          ) : (
            <button 
              type="button" 
              onClick={() => { setIsRegister(true); setError(""); }}
              className="text-gray-400 hover:text-emerald-600 transition-all"
            >
              Create Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
