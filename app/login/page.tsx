"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { BrandCrest } from "@/components/icons";
import { signInAction, signUpAction, type AuthState } from "./actions";

const ICON_ARROW = "M5 12h14M13 6l6 6-6 6";
const ICON_USER =
  "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 7a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19 8v6M22 11h-6";

function Submit({ mode }: { mode: "login" | "signup" }) {
  const { pending } = useFormStatus();
  const reg = mode === "signup";
  return (
    <button type="submit" className="auth-submit" disabled={pending}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
        <path d={reg ? ICON_USER : ICON_ARROW} />
      </svg>
      <span>
        {pending ? (reg ? "Zakładam…" : "Wchodzę…") : reg ? "Załóż konto" : "Zaloguj się"}
      </span>
    </button>
  );
}

function PinInput({ name, placeholder }: { name: string; placeholder: string }) {
  return (
    <input
      className="inp pin"
      name={name}
      type="password"
      required
      inputMode="numeric"
      autoComplete="off"
      pattern="\d{4,6}"
      maxLength={6}
      placeholder={placeholder}
    />
  );
}

function SignupForm() {
  const [state, action] = useFormState<AuthState, FormData>(signUpAction, {});
  return (
    <form action={action} autoComplete="off">
      <div className="field">
        <label>Nazwa użytkownika</label>
        <input className="inp" name="username" required autoFocus autoComplete="username" placeholder="np. Bartonek" />
      </div>
      <div className="field">
        <label>E-mail</label>
        <input className="inp" name="email" type="email" required autoComplete="email" placeholder="ty@example.com" />
      </div>
      <div className="field">
        <label>PIN (4–6 cyfr)</label>
        <PinInput name="pin" placeholder="••••" />
      </div>
      <div className="field">
        <label>Powtórz PIN</label>
        <PinInput name="pin2" placeholder="••••" />
      </div>
      {state.error && <div className="auth-err">{state.error}</div>}
      <Submit mode="signup" />
      <div className="auth-foot">
        Zapamiętaj PIN — będzie potrzebny przy logowaniu (<b>nie da się go odzyskać mailem</b>).
      </div>
    </form>
  );
}

function LoginForm() {
  const [state, action] = useFormState<AuthState, FormData>(signInAction, {});
  return (
    <form action={action} autoComplete="off">
      <div className="field">
        <label>Nazwa lub e-mail</label>
        <input className="inp" name="identifier" required autoFocus autoComplete="username" placeholder="Bartonek lub ty@example.com" />
      </div>
      <div className="field">
        <label>PIN</label>
        <PinInput name="pin" placeholder="••••" />
      </div>
      {state.error && <div className="auth-err">{state.error}</div>}
      <Submit mode="login" />
      <div className="auth-foot">
        Pierwszy raz w lidze? Kliknij <b>Załóż konto</b>.
      </div>
    </form>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <main className="auth-page">
      <div className="auth">
        <div className="auth-brand">
          <span className="brand-crest">
            <BrandCrest size={50} />
          </span>
          <div>
            <div className="brand-name">
              Kawalerski <b>Mundial</b>
            </div>
            <div className="brand-sub">USA · Kanada · Meksyk — 2026</div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-inner">
            <div className="auth-tabs">
              <button type="button" className={`auth-tab ${mode === "login" ? "on" : ""}`} onClick={() => setMode("login")}>
                Logowanie
              </button>
              <button type="button" className={`auth-tab ${mode === "signup" ? "on" : ""}`} onClick={() => setMode("signup")}>
                Załóż konto
              </button>
            </div>

            {mode === "signup" ? <SignupForm key="signup" /> : <LoginForm key="login" />}
          </div>
        </div>
      </div>
    </main>
  );
}
