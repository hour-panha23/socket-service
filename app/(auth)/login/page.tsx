"use client";

import { login } from "@/src/services/auth/auth.service";
import { Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await login(email, password);

      if (response.status_code !== 200) {
        throw new Error(response.message || "Invalid email or password");
      }

      // 1. Save user object in Local Storage
      localStorage.setItem("user", JSON.stringify(response.data?.user));

      // 2. Save tokens in Cookies
      document.cookie = `access_token=${response.data?.access_token}; path=/; SameSite=Lax; Secure`;
      document.cookie = `refresh_token=${response.data?.refresh_token}; path=/; SameSite=Lax; Secure`;

      // Redirect to dashboard on success
      router.push("/monitoring");
    } catch (error) {
      console.error("Login failed:", error);
      setErrorMessage(
        (error as Error).message ||
          "An unexpected error occurred. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSubmit(e);
    }
  };

  return (
    <div className="flex justify-center items-center bg-slate-950 p-4 min-h-screen">
      <div className="space-y-8 bg-slate-900/60 shadow-2xl backdrop-blur-sm p-8 border border-slate-800 rounded-2xl w-full max-w-md">
        <div className="text-center">
          <h2 className="font-bold text-white text-2xl tracking-tight">
            Welcome back
          </h2>
          <p className="mt-2 text-slate-400 text-sm">
            Sign in to your account to continue
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 p-3 border border-red-500/50 rounded-lg text-red-400 text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block mb-1.5 font-medium text-slate-300 text-xs"
              >
                Email address
              </label>
              <div className="relative">
                <div className="left-0 absolute inset-y-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  onKeyDown={handleKeyDown}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block bg-slate-950 py-2.5 pr-3 pl-10 border border-slate-800 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full text-slate-200 text-sm transition placeholder-slate-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block mb-1.5 font-medium text-slate-300 text-xs"
              >
                Password
              </label>
              <div className="relative">
                <div className="left-0 absolute inset-y-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  onKeyDown={handleKeyDown}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block bg-slate-950 py-2.5 pr-3 pl-10 border border-slate-800 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full text-slate-200 text-sm transition placeholder-slate-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs">
            <label className="flex items-center text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                className="bg-slate-950 mr-2 border-slate-700 rounded focus:ring-indigo-500 text-indigo-600"
              />
              Remember me
            </label>
            <a
              href="#"
              className="font-medium text-indigo-400 hover:text-indigo-300 transition"
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-sm px-4 py-2.5 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 w-full font-semibold text-white text-sm transition-all disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
