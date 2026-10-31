"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { BrandName, OwlMark } from "@/components/brand";
import { Button, Card, CardContent, Field, Input } from "@/components/ui";

export default function PlatformLoginPage() {
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
      const res = await fetch("/api/platform/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not sign in");
        return;
      }
      router.push("/platform");
      router.refresh();
    } catch {
      setError("Cannot reach the server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-black p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="px-6 py-8 sm:px-8">
          <div className="mb-8 text-center">
            <OwlMark className="mx-auto mb-3 h-16 w-16" />
            <BrandName className="text-xl" />
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Owner panel</h1>
            <p className="mt-1 text-[15px] text-slate-500">Manage the restaurants that use your software</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
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

            <Button type="submit" size="lg" className="w-full bg-slate-900 hover:bg-slate-800" loading={loading}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Restaurant staff sign in at <a href="/login" className="font-semibold text-primary-600 hover:underline">the restaurant sign-in page</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
