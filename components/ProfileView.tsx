"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Player } from "@/lib/types";
import { processAvatarFile, ImageError, ACCEPTED_TYPES } from "@/lib/image";
import { AVATAR_BUCKET, avatarStoragePath, PRESET_AVATARS, isUploadedAvatar } from "@/lib/avatars";
import { updateMyAvatar, updateMyName } from "@/app/actions";
import Avatar from "./Avatar";
import { I } from "./icons";

export default function ProfileView({
  me,
  onAvatarChange,
  onNameChange,
  onToast,
}: {
  me: Player;
  onAvatarChange: (url: string | null) => void;
  onNameChange: (name: string) => void;
  onToast: (msg: string, err?: boolean) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(me.avatar_url);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(me.name);
  const [savingName, setSavingName] = useState(false);

  function applyAvatar(url: string | null) {
    setAvatarUrl(url);
    onAvatarChange(url);
  }

  // --- Upload własnego zdjęcia ---------------------------------------
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // pozwól wybrać ten sam plik ponownie
    if (!file) return;

    setBusy(true);
    try {
      const blob = await processAvatarFile(file);
      const path = avatarStoragePath(me.id);
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { upsert: true, contentType: "image/webp" });
      if (upErr) throw new Error(upErr.message);

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      // cache-bust: ścieżka stała, więc bez ?v= przeglądarka pokaże stare zdjęcie
      const url = `${data.publicUrl}?v=${Date.now()}`;

      const res = await updateMyAvatar(url);
      if (!res.ok) throw new Error(res.error || "Nie udało się zapisać awatara.");

      applyAvatar(url);
      onToast("Awatar zaktualizowany");
    } catch (err) {
      const msg =
        err instanceof ImageError
          ? err.message
          : err instanceof Error && /fetch|network|Failed/i.test(err.message)
          ? "Błąd sieci — spróbuj ponownie."
          : err instanceof Error
          ? err.message
          : "Nie udało się wgrać zdjęcia.";
      onToast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  // --- Wybór gotowca --------------------------------------------------
  async function onPreset(url: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await updateMyAvatar(url);
      if (!res.ok) throw new Error(res.error || "Nie udało się zapisać awatara.");
      applyAvatar(url);
      onToast("Awatar zaktualizowany");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Coś poszło nie tak.", true);
    } finally {
      setBusy(false);
    }
  }

  // --- Usunięcie awatara ---------------------------------------------
  async function onRemove() {
    if (busy || !avatarUrl) return;
    setBusy(true);
    try {
      const res = await updateMyAvatar(null);
      if (!res.ok) throw new Error(res.error || "Nie udało się usunąć awatara.");
      // sprzątanie pliku ze Storage (gdy to wgrane zdjęcie, a nie gotowiec)
      if (isUploadedAvatar(avatarUrl)) {
        await supabase.storage.from(AVATAR_BUCKET).remove([avatarStoragePath(me.id)]);
      }
      applyAvatar(null);
      onToast("Awatar usunięty");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Coś poszło nie tak.", true);
    } finally {
      setBusy(false);
    }
  }

  // --- Zmiana nazwy ---------------------------------------------------
  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (clean === me.name) return;
    setSavingName(true);
    try {
      const res = await updateMyName(clean);
      if (!res.ok) throw new Error(res.error || "Nie udało się zapisać nazwy.");
      onNameChange(clean);
      onToast("Nazwa zapisana");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Coś poszło nie tak.", true);
      setName(me.name);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="profile-grid">
      <div className="panel">
        <div className="panel-head">{I.star}<h3>Twój awatar</h3></div>
        <div className="profile-avatar-row">
          <div className={`profile-preview ${busy ? "busy" : ""}`}>
            <Avatar name={me.name} seed={me.id} size={108} avatarUrl={avatarUrl} />
            {busy && <span className="profile-spin" />}
          </div>
          <div className="profile-actions">
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              {I.arrow} Wgraj zdjęcie
            </button>
            <button className="btn btn-ghost" onClick={onRemove} disabled={busy || !avatarUrl}>
              Usuń awatar
            </button>
            <p className="profile-hint">JPG, PNG lub WEBP · maks. 8 MB. Przytniemy do kwadratu i zmniejszymy automatycznie.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            hidden
            onChange={onPickFile}
          />
        </div>

        <div className="profile-sub">Albo wybierz gotowy:</div>
        <div className="preset-grid">
          {PRESET_AVATARS.map((url) => (
            <button
              key={url}
              className={`preset-cell ${avatarUrl === url ? "sel" : ""}`}
              onClick={() => onPreset(url)}
              disabled={busy}
              aria-label="Wybierz awatar"
            >
              <span className="avatar avatar-img" style={{ width: 52, height: 52, backgroundImage: `url(${JSON.stringify(url)})` }} />
            </button>
          ))}
        </div>
      </div>

      <div className="panel" style={{ alignSelf: "start" }}>
        <div className="panel-head">{I.people}<h3>Nazwa gracza</h3></div>
        <form onSubmit={onSaveName} className="profile-name-form">
          <input
            className="profile-input"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Twoja nazwa"
          />
          <button className="btn btn-primary" type="submit" disabled={savingName || name.trim() === me.name || name.trim().length < 2}>
            {savingName ? "Zapisywanie…" : "Zapisz nazwę"}
          </button>
        </form>
        <p className="profile-hint" style={{ padding: "0 18px 16px" }}>Tak będziesz widoczny w rankingu i przy typach. 2–40 znaków.</p>
      </div>
    </div>
  );
}
