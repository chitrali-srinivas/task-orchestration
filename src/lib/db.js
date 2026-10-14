// Supabase client shared by both pages. Credentials come from config.js, or from
// localStorage (the setup panel) so a deployed copy works without editing files.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const saved = (() => { try { return JSON.parse(localStorage.getItem("mati.supabase") || "null"); } catch { return null; } })();
export const cfg = saved || { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
export const configured = /^https:\/\/.+\.supabase\.co$/.test(cfg.url) && cfg.key.length > 20;
export const db = configured ? createClient(cfg.url, cfg.key) : null;

export function saveConfig(url, key) {
  localStorage.setItem("mati.supabase", JSON.stringify({ url: url.trim().replace(/\/$/, ""), key: key.trim() }));
  location.reload();
}

// Throws on a Supabase error so callers can use try/catch.
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export function describeRule(r, names) {
  const n = (id) => names[id] || id;
  const when = r.trigger_type === "season_start" ? "When the season starts" : `When ${n(r.source_template_id)} is ${r.source_status}`;
  const cond = r.condition_field ? ` and ${r.condition_field} ${r.condition_op} "${r.condition_value}"` : "";
  if (r.action === "end") return `${when}${cond} → end the farmer's journey`;
  const open = r.open_type === "immediately" ? "immediately" : r.open_type === "after_days" ? `after ${r.open_days} days` : `on ${r.open_date}`;
  const close = r.close_type === "none" ? "valid indefinitely" : r.close_type === "after_days" ? `closes ${r.close_days} days later` : `closes on ${r.close_date}`;
  return `${when}${cond} → open ${n(r.template_id)} ${open}, ${close}`;
}

export function setupPanel(root) {
  root.innerHTML = `
    <div class="card" style="max-width:480px;margin:48px auto">
      <h2>Connect to Supabase</h2>
      <p class="muted">Run <code>supabase/schema.sql</code> then <code>supabase/seed.sql</code> in your project's SQL editor, then paste the project URL and anon key here (Settings → API). They are stored in this browser only.</p>
      <label>Project URL <input id="su" placeholder="https://xxxx.supabase.co"></label>
      <label>Anon key <input id="sk" placeholder="eyJ..."></label>
      <button class="primary" id="sb">Save and reload</button>
    </div>`;
  root.querySelector("#sb").onclick = () => saveConfig(root.querySelector("#su").value, root.querySelector("#sk").value);
}
