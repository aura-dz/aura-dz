"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import logo from "../../logo.jpg";
import { KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessCode }),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error || "تعذر تسجيل الدخول.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setPending(false);
    }
  }

  return <main className="admin-login-page"><section className="admin-login-panel"><div className="admin-login-mark"><Image src={logo} alt="Aurabelle" fill sizes="44px" /></div><p className="admin-login-eyebrow">AURABELLE · STORE MANAGEMENT</p><h1>دخول الإدارة</h1><p className="admin-login-copy">أدخلي رمز الإدارة للوصول إلى بيانات المتجر.</p><form onSubmit={submit}><label htmlFor="access-code">رمز الإدارة</label><div className="login-input-wrap"><KeyRound /><input id="access-code" type="password" autoComplete="current-password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} required autoFocus /></div>{error && <p className="admin-login-error" role="alert">{error}</p>}<button type="submit" disabled={pending}>{pending ? <LoaderCircle className="login-spinner" /> : <LockKeyhole />}دخول آمن</button></form></section><span className="admin-login-footer">اتصال آمن · Aurabelle Algeria</span></main>;
}