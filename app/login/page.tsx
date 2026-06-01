"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Trophy, LogIn, UserPlus } from "lucide-react";
import { signInAction, signUpAction, type AuthState } from "./actions";

const inputCls =
  "mt-1 w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-lime";
const labelCls = "text-xs text-mut font-semibold uppercase tracking-wide";

function SubmitButton({ mode }: { mode: "login" | "signup" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-lime to-lime-2 text-bg font-bold py-3 rounded-lg disabled:opacity-60"
    >
      {mode === "signup" ? <UserPlus size={16} /> : <LogIn size={16} />}
      {pending
        ? mode === "signup"
          ? "Zakładam…"
          : "Wchodzę…"
        : mode === "signup"
        ? "Załóż konto"
        : "Zaloguj się"}
    </button>
  );
}

function PinField({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="password"
        name={name}
        required
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{4,6}"
        maxLength={6}
        placeholder={placeholder}
        className={`${inputCls} tracking-[0.3em]`}
      />
    </div>
  );
}

function SignupForm() {
  const [state, action] = useFormState<AuthState, FormData>(signUpAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={labelCls}>Nazwa użytkownika</label>
        <input
          type="text"
          name="username"
          required
          autoFocus
          autoComplete="username"
          placeholder="np. Bartonek"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>E-mail</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="ty@example.com"
          className={inputCls}
        />
      </div>
      <PinField name="pin" label="PIN (4–6 cyfr)" placeholder="••••" />
      <PinField name="pin2" label="Powtórz PIN" placeholder="••••" />
      {state.error && <p className="text-red text-sm">{state.error}</p>}
      <SubmitButton mode="signup" />
      <p className="text-[11px] text-mut text-center leading-relaxed">
        Zapamiętaj PIN — będzie potrzebny przy logowaniu (nie da się go odzyskać mailem).
      </p>
    </form>
  );
}

function LoginForm() {
  const [state, action] = useFormState<AuthState, FormData>(signInAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={labelCls}>Nazwa lub e-mail</label>
        <input
          type="text"
          name="identifier"
          required
          autoFocus
          autoComplete="username"
          placeholder="Bartonek lub ty@example.com"
          className={inputCls}
        />
      </div>
      <PinField name="pin" label="PIN" placeholder="••••" />
      {state.error && <p className="text-red text-sm">{state.error}</p>}
      <SubmitButton mode="login" />
      <p className="text-[11px] text-mut text-center leading-relaxed">
        Logujesz się nazwą albo e-mailem oraz PIN-em.
      </p>
    </form>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-7 justify-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-lime to-lime-2 text-bg grid place-items-center shadow-[0_6px_22px_rgba(204,255,0,.35)]">
            <Trophy size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-display text-2xl leading-none uppercase tracking-wide">
              Kawalerski <span className="text-lime">Mundial</span>
            </h1>
            <p className="text-[10px] tracking-[1.5px] text-mut uppercase mt-1">
              USA · Kanada · Meksyk — 2026
            </p>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-2xl p-6">
          <div className="grid grid-cols-2 gap-1 p-1 mb-5 bg-panel2 border border-line rounded-lg">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`py-2 rounded-md text-sm font-semibold transition-colors ${
                  mode === m ? "bg-lime text-bg" : "text-mut hover:text-txt"
                }`}
              >
                {m === "login" ? "Logowanie" : "Załóż konto"}
              </button>
            ))}
          </div>

          {/* key wymusza reset stanu formularza przy zmianie trybu */}
          {mode === "signup" ? <SignupForm key="signup" /> : <LoginForm key="login" />}
        </div>
      </div>
    </main>
  );
}
