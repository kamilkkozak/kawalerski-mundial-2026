"use client";

import { useState } from "react";
import { Trophy, Mail, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        data: name.trim() ? { name: name.trim() } : undefined,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

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

        {sent ? (
          <div className="bg-panel border border-line rounded-2xl p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-lime/15 text-lime grid place-items-center mb-3">
              <Check size={24} />
            </div>
            <h2 className="font-display text-lg uppercase">Sprawdź skrzynkę</h2>
            <p className="text-sm text-mut mt-2">
              Wysłaliśmy link logujący na <b className="text-txt">{email}</b>. Kliknij go, aby wejść do gry.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-panel border border-line rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs text-mut font-semibold uppercase tracking-wide">Imię / ksywa</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Bartonek"
                className="mt-1 w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-lime"
              />
            </div>
            <div>
              <label className="text-xs text-mut font-semibold uppercase tracking-wide">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ty@example.com"
                className="mt-1 w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-lime"
              />
            </div>
            {error && <p className="text-red text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-lime to-lime-2 text-bg font-bold py-3 rounded-lg disabled:opacity-60"
            >
              <Mail size={16} />
              {loading ? "Wysyłam…" : "Wyślij link logujący"}
            </button>
            <p className="text-[11px] text-mut text-center leading-relaxed">
              Logowanie bez hasła — dostajesz jednorazowy link na e-mail (magic link).
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
