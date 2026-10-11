"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardHeader, Field, Input, PageHeader, Row } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import { label } from "@/lib/utils";

export default function AccountPage() {
  const { user, toast } = useApp();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      toast("The two new passwords are not the same", "error");
      return;
    }
    setSaving(true);
    try {
      await api("/api/auth/password", { body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      toast("Your password has been changed");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My account" />
      <Card>
        <CardHeader title="Your details" />
        <CardContent>
          <Row label="Name">{user.name}</Row>
          <Row label="Sign-in email">{user.email}</Row>
          <Row label="Access">{label(user.role)}</Row>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Change password" description="Use at least 6 characters. Do not share your password with others." />
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <Field label="Current password">
              <Input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required />
            </Field>
            <Field label="New password">
              <Input type="password" autoComplete="new-password" minLength={6} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
            </Field>
            <Field label="New password again">
              <Input type="password" autoComplete="new-password" minLength={6} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
            </Field>
            <Button type="submit" loading={saving}>
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
