"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useApp } from "@/components/app-provider";
import { api } from "@/lib/client";
import type { SettingsDTO } from "@/lib/types";

export function useSettingsForm(settings: SettingsDTO, onSaved: (s: SettingsDTO) => void, pick: Array<keyof SettingsDTO>) {
  const { toast } = useApp();
  const initial = Object.fromEntries(pick.map((k) => [k, settings[k]])) as Partial<SettingsDTO>;
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (p: Partial<SettingsDTO>) => setForm((f) => ({ ...f, ...p }));
  async function save() {
    setSaving(true);
    try {
      const r = await api<{ settings: SettingsDTO }>("/api/settings", { method: "PATCH", body: form });
      onSaved(r.settings);
      toast("Settings saved");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }
  return { form, set, save, saving, changed };
}

export function SaveBar({ saving, changed, onSave }: { saving: boolean; changed: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button size="lg" loading={saving} disabled={!changed} onClick={onSave}>
        Save changes
      </Button>
      {changed && <span className="text-sm font-medium text-amber-700">Not saved yet</span>}
    </div>
  );
}
