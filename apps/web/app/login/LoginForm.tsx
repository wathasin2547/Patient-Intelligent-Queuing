"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { btn, Notice } from "@/components/ui";
import { login, type LoginState } from "./actions";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const err = state.fieldErrors;

  return (
    <form action={action} className="mt-8 flex flex-col gap-4" noValidate>
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <Input
        name="username"
        label="ชื่อผู้ใช้"
        autoComplete="username"
        defaultValue={state.username}
        error={err?.username?.[0]}
        autoFocus
      />
      <Input name="password" label="รหัสผ่าน" type="password" autoComplete="current-password" error={err?.password?.[0]} />
      {state.error && <div role="alert"><Notice tone="rose">{state.error}</Notice></div>}
      <button type="submit" disabled={pending} className={`${btn.brand} mt-2 min-h-12 text-base`}>
        {pending ? (
          <><LoaderCircle size={17} strokeWidth={2} className="motion-safe:animate-spin" /> กำลังเข้าสู่ระบบ</>
        ) : (
          <>เข้าสู่ระบบ <ArrowRight size={17} strokeWidth={2} /></>
        )}
      </button>
    </form>
  );
}

function Input({ name, label, error, ...rest }: { name: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const errId = `${name}-error`;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      <input
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? errId : undefined}
        className={`input py-3 text-base ${error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/15" : ""}`}
        {...rest}
      />
      {error && <span id={errId} className="mt-1.5 block text-sm text-rose-700">{error}</span>}
    </label>
  );
}
