"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UtensilsCrossed } from "lucide-react";
import { Button, Card, CardContent, Field, Input } from "@/components/ui";

const SHOW_DEMO = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not sign in");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Cannot reach the server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="px-6 py-8 sm:px-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="mt-1 text-[15px] text-slate-500">Sign in to your restaurant</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.com" required autoFocus />
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </Field>

            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">Forgot your password? Ask the restaurant owner to reset it in Settings → Staff. Owners can ask their software provider.</p>

          {SHOW_DEMO && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="mb-1 font-semibold text-slate-800">Demo accounts</p>
              <button type="button" className="block hover:underline" onClick={() => { setEmail("owner@spicegarden.test"); setPassword("owner123"); }}>
                Owner: owner@spicegarden.test / owner123
              </button>
              <button type="button" className="block hover:underline" onClick={() => { setEmail("cashier@spicegarden.test"); setPassword("cashier123"); }}>
                Cashier: cashier@spicegarden.test / cashier123
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
