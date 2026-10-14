import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const date = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function toast(msg, isError) {
  const el = Object.assign(document.createElement("div"), {
    className: "toast rounded-md px-4 py-2 text-sm shadow-lg " + (isError ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"),
    textContent: msg,
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
export const run = (fn) => fn().catch((e) => toast(e.message, true));
