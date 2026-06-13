"use client";

import { useState, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { BrandCrest } from "@/components/icons";
import { signInAction, signUpAction, type AuthState } from "./actions";
import { resetPin } from "@/app/actions";

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
  useEffect(() => { if (state.success) window.location.href = "/"; }, [state.success]);
  return (
    <form action={action} autoComplete="off">
      <div className="field">
        <label>Nazwa użytkownika</label>
        <input className="inp" name="username" required autoFocus autoComplete="username" placeholder="np. Bartonek" />
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
        Wystarczy nick i PIN. <b>Zapamiętaj PIN</b> — będzie potrzebny przy logowaniu.
      </div>
    </form>
  );
}

function ResetPinForm({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("username") ?? "").trim();
    const code = String(fd.get("reset_code") ?? "");
    const pin = String(fd.get("pin") ?? "");
    const pin2 = String(fd.get("pin2") ?? "");
    setPending(true);
    const res = await resetPin(name, code, pin, pin2);
    setState(res);
    setPending(false);
    if (res.success) e.currentTarget.reset();
  }

  if (state.success) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ color: "var(--accent)", fontWeight: 700, marginBottom: 12 }}>PIN zmieniony!</div>
        <button type="button" className="auth-tab on" onClick={onBack}>Zaloguj się nowym PINem</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} autoComplete="off">
      <div className="field">
        <label>Nazwa użytkownika</label>
        <input className="inp" name="username" required autoFocus autoComplete="username" placeholder="np. Bartonek" />
      </div>
      <div className="field">
        <label>Kod odzyskiwania</label>
        <input className="inp" name="reset_code" required autoComplete="off" placeholder="hasło grupowe" />
      </div>
      <div className="field">
        <label>Nowy PIN (4–6 cyfr)</label>
        <PinInput name="pin" placeholder="••••" />
      </div>
      <div className="field">
        <label>Powtórz nowy PIN</label>
        <PinInput name="pin2" placeholder="••••" />
      </div>
      {state.error && <div className="auth-err">{state.error}</div>}
      <button type="submit" className="auth-submit" disabled={pending}>
        <span>{pending ? "Zmieniam…" : "Zmień PIN"}</span>
      </button>
      <div className="auth-foot">
        <button type="button" style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontSize: "inherit" }} onClick={onBack}>← Wróć do logowania</button>
      </div>
    </form>
  );
}

function LoginForm() {
  const [state, action] = useFormState<AuthState, FormData>(signInAction, {});
  useEffect(() => { if (state.success) window.location.href = "/"; }, [state.success]);
  return (
    <form action={action} autoComplete="off">
      <div className="field">
        <label>Nazwa użytkownika</label>
        <input className="inp" name="identifier" required autoFocus autoComplete="username" placeholder="np. Bartonek" />
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
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");

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
              <button type="button" className={`auth-tab ${mode === "reset" ? "on" : ""}`} onClick={() => setMode("reset")}>
                Zresetuj PIN
              </button>
            </div>

            {mode === "signup" && <SignupForm key="signup" />}
            {mode === "login" && <LoginForm key="login" />}
            {mode === "reset" && <ResetPinForm key="reset" onBack={() => setMode("login")} />}
          </div>
        </div>
      </div>
    </main>
  );
}
