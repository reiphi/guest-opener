import { createHash } from "node:crypto";

// Styles and scripts are served as files (not inline) so the Content-Security-Policy can forbid inline code.

export const appCss = `
:root{
  --bg:#1c1c1c;--surface:#2a2a2a;--surface-2:#333333;--text:#e8e8e8;--muted:#a8a8a8;--line:#3a3a3a;
  --accent:#3d8fd6;--accent-2:#2f78bd;--key:#3a3a3a;--danger:#e07a7a;
  --ok-bg:#1e3328;--ok:#9ad8b0;--err-bg:#3a1d1a;--err:#f4a99e;--info-bg:#1b2633;--info:#a9c2e0;--warn-bg:#352a12;--warn:#f0cf8a;
  --radius:4px;--shadow:none;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  color-scheme:dark;
}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text)}
a{color:var(--accent)}
h1{font-size:1.35rem;font-weight:600;line-height:1.2;margin:.2em 0 .4em}
h2{font-size:1rem;font-weight:600;margin:0 0 .9em}
p{margin:.5em 0}
.muted{color:var(--muted)}
.small{font-size:.875rem}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.card{background:var(--surface);border:0;border-radius:var(--radius);padding:16px;box-shadow:none;margin:16px 0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.4em;border:0;background:var(--key);color:var(--text);border-radius:var(--radius);padding:.65em 1.1em;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}
.btn:hover{background:#454545}
.btn.primary{background:var(--accent);color:#fff}
.btn.primary:hover{background:var(--accent-2)}
.btn.block{width:100%;padding:.85em;font-size:1rem}
.btn.sm{padding:.4em .8em;font-size:.875rem;border-radius:var(--radius)}
.btn:disabled{opacity:.6;cursor:default}
.btn:focus-visible,.door:focus-visible,input:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
input{font:inherit;color:var(--text);background:#252525;border:1px solid var(--line);border-radius:var(--radius);padding:.65em .8em;width:100%}
label{display:block;font-size:.85rem;color:var(--muted);margin-bottom:.35em}
.notice{padding:12px 14px;border-radius:var(--radius);margin:14px 0;font-weight:500}
.notice.ok{background:var(--ok-bg);color:var(--ok)}
.notice.err{background:var(--err-bg);color:var(--err)}
.notice.info{background:var(--info-bg);color:var(--info)}
.notice.warn{background:var(--warn-bg);color:var(--warn)}
.badge{display:inline-block;padding:.15em .65em;border-radius:var(--radius);font-size:.78rem;font-weight:600;background:var(--key);color:var(--muted);white-space:nowrap}
.badge.active,.badge.good{background:var(--ok-bg);color:var(--ok)}
.badge.upcoming{background:var(--info-bg);color:var(--info)}
.badge.revoked,.badge.bad{background:var(--err-bg);color:var(--err)}
.badge.locked{background:var(--warn-bg);color:var(--warn)}
.brand{display:flex;align-items:center;gap:.45em;font-weight:600;color:var(--accent)}

/* ---------- guest ---------- */
.guest{max-width:460px;margin:0 auto;padding:22px 16px calc(28px + env(safe-area-inset-bottom))}
.chip{display:inline-block;margin:0;background:var(--surface);border-radius:var(--radius);padding:.3em .7em;font-size:.85rem;color:var(--muted)}
.doors{display:grid;gap:12px;margin:20px 0 14px}
.door{display:flex;align-items:center;gap:14px;width:100%;min-height:76px;border:0;border-radius:var(--radius);padding:10px 14px;font:inherit;text-align:left;color:var(--text);background:var(--surface);cursor:pointer;box-shadow:none;-webkit-tap-highlight-color:transparent}
.door:active{background:#313131}
.door.lock{min-height:68px}
.door:disabled{cursor:default}
.door:disabled:not(.busy){opacity:.45}
.door.done{box-shadow:inset 4px 0 0 var(--accent)}
.door-icon{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:3px;background:var(--key);font-size:1.45rem}
.door.lock .door-icon{width:44px;height:44px;font-size:1.25rem}
.door.done .door-icon{background:var(--accent)}
.door-text{flex:1;display:flex;flex-direction:column;gap:2px}
.door-text strong{font-size:1.05rem;font-weight:600;line-height:1.2}
.door-text small{font-size:.85rem;color:var(--muted)}
.door.done .door-text small{color:var(--text);opacity:.8}
.door-state{flex:none;display:grid;place-items:center;width:22px;height:22px;font-size:1.4rem;line-height:1;color:var(--muted)}
.door-state::after{content:"›"}
.door.busy .door-state{border:3px solid #555;border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
.door.busy .door-state::after{content:""}
.door.done .door-state{color:#fff}
.door.done .door-state::after{content:"✓";font-size:1.2rem}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.door{transition:none}.door.busy .door-state{animation-duration:2.5s}}
.status{padding:12px 14px;border-radius:var(--radius);font-weight:500;margin:0 0 16px}
.status.ok{background:var(--ok-bg);color:var(--ok)}
.status.err{background:var(--err-bg);color:var(--err)}
.status.info{background:var(--info-bg);color:var(--info)}
.steps{list-style:none;margin:6px 0 22px;padding:0;display:grid;gap:10px;color:var(--muted);font-size:.93rem}
.steps li{display:flex;gap:.7em;align-items:flex-start}
.steps li span:first-child{flex:none;width:1.4em;text-align:center}
.help{display:flex;align-items:center;gap:14px;background:var(--surface);border-radius:var(--radius);padding:12px 14px;color:var(--text);text-decoration:none}
.help-icon{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:3px;background:var(--key);font-size:1.15rem}
.help span{display:flex;flex-direction:column}
.help small{color:var(--muted)}
.pin-input{margin:.3em 0 1em;padding:.45em .2em;font-family:var(--mono);font-size:2.1rem;letter-spacing:.4em;text-indent:.4em;text-align:center;font-variant-numeric:tabular-nums}
.pin-input::placeholder{color:#555}
.message-card{text-align:center;padding:24px 18px}
.message-icon{font-size:2.6rem;line-height:1}

/* ---------- admin ---------- */
.topbar{position:sticky;top:0;z-index:5;background:#252525;border-bottom:1px solid var(--line)}
.topbar-inner{max-width:1040px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;gap:12px 18px;flex-wrap:wrap}
.topbar .brand{margin-right:auto;color:var(--text);text-decoration:none}
.topbar nav{display:flex;gap:4px}
.topbar nav a{padding:.45em .85em;border-radius:var(--radius);color:var(--muted);font-weight:600;text-decoration:none}
.topbar nav a[aria-current]{background:var(--surface);color:var(--accent)}
.topbar form{margin:0}
.admin{max-width:1040px;margin:0 auto;padding:6px 18px 56px}
.devices{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:16px}
.devices .card{margin:0}
.device-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.device-head h2{margin:0}
.entity{font-family:var(--mono);font-size:.8rem;color:var(--muted);word-break:break-all}
.row-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.row-actions form{margin:0}
.form-grid{display:grid;grid-template-columns:2fr 1.4fr 1.4fr auto;gap:12px;align-items:end}
.form-grid.two{grid-template-columns:1fr auto;margin-bottom:12px}
.section-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.access{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px 22px;align-items:center;padding:14px 0;border-top:1px solid var(--line)}
.access-list > .access:first-child{border-top:0;padding-top:4px}
.access-name{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-weight:600}
.access-period{color:var(--muted);font-size:.9rem;margin-top:2px}
.access-pin{text-align:right}
.access-pin small{display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.pin{font-family:var(--mono);font-size:1.15rem;font-weight:700;letter-spacing:.06em}
.access-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end}
details.more{position:relative}
details.more summary{list-style:none}
details.more summary::-webkit-details-marker{display:none}
.menu{position:absolute;right:0;top:calc(100% + 6px);z-index:4;display:grid;min-width:220px;padding:6px;background:#252525;border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 10px 30px rgba(0,0,0,.45)}
.menu form{margin:0}
.menu button{display:block;width:100%;padding:.6em .8em;border:0;border-radius:9px;background:none;color:var(--text);font:inherit;text-align:left;cursor:pointer}
.menu button:hover{background:var(--surface-2)}
.menu hr{border:0;border-top:1px solid var(--line);margin:4px 2px}
.menu .danger{color:var(--danger)}
.past{margin-top:6px;border-top:1px solid var(--line)}
.past summary{cursor:pointer;padding:14px 0 6px;color:var(--muted);font-weight:600}
.past .access{opacity:.75}
.empty{color:var(--muted);margin:4px 0}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
th{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}
td.detail{white-space:normal;font-family:var(--mono);font-size:.78rem;color:var(--muted);min-width:220px}
.login{max-width:400px;margin:0 auto;padding:12vh 18px 40px}
@media (max-width:760px){
  .form-grid,.form-grid.two{grid-template-columns:1fr}
  .access{grid-template-columns:minmax(0,1fr) auto}
  .access-actions{grid-column:1/-1;justify-content:flex-start}
  .menu{position:fixed;top:auto;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));min-width:0;padding:8px;font-size:1.05rem;box-shadow:0 -4px 40px rgba(0,0,0,.3)}
  .menu button{padding:.8em 1em}
}
`;

export const guestJs = `
(() => {
  const pin = document.getElementById("pin");
  if (pin) {
    const form = pin.form;
    let sent = false;
    const submit = () => {
      if (sent) return;
      sent = true;
      form.querySelector("button").disabled = true;
      form.submit();
    };
    pin.addEventListener("input", () => {
      pin.value = pin.value.replace(/\\D/g, "").slice(0, 6);
      if (pin.value.length === 6) submit();
    });
    form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
  }

  const cfgEl = document.getElementById("cfg");
  if (!cfgEl) return;
  const CFG = JSON.parse(cfgEl.textContent);
  const statusEl = document.getElementById("status");
  const buttons = Array.from(document.querySelectorAll("button.door"));

  function show(msg, kind) {
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.className = "status " + kind;
  }
  function setBusy(active) {
    for (const b of buttons) {
      b.disabled = !!active;
      b.classList.toggle("busy", b === active);
    }
  }
  function locate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject({ code: 2 });
      navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    });
  }

  for (const btn of buttons) {
    btn.addEventListener("click", async () => {
      setBusy(btn);
      try {
        const body = { door: btn.dataset.door, action: btn.dataset.action };
        const locking = body.action === "lock";
        if (CFG.geofence && !locking) {
          show(CFG.strings.locating, "info");
          try {
            const c = await locate();
            body.lat = c.latitude; body.lon = c.longitude; body.accuracy = c.accuracy;
          } catch (e) {
            show(e && e.code === 1 ? CFG.strings.geoDenied : CFG.strings.geoUnavailable, "err");
            return;
          }
        }
        show(locking ? CFG.strings.locking : CFG.strings.opening, "info");
        let res;
        try {
          res = await fetch(CFG.doorUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        } catch { show(CFG.strings.network, "err"); return; }
        if (res.status === 401) { show(CFG.strings.sessionExpired, "err"); return; }
        const data = await res.json().catch(() => ({ ok: false, message: CFG.strings.network }));
        show(data.message, data.ok ? "ok" : "err");
        if (data.ok) {
          btn.classList.add("done");
          if (navigator.vibrate) navigator.vibrate(60);
          setTimeout(() => btn.classList.remove("done"), 5000);
        }
      } finally {
        setBusy(null);
      }
    });
  }
})();
`;

export const adminJs = `
(() => {
  document.addEventListener("click", async (e) => {
    for (const d of document.querySelectorAll("details.more[open]")) {
      if (!d.contains(e.target)) d.open = false;
    }
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      const label = btn.textContent;
      btn.textContent = "Kopiert ✓";
      setTimeout(() => { btn.textContent = label; }, 1500);
    } catch {
      // The clipboard API needs HTTPS; on plain-HTTP LAN tests fall back to a selectable prompt.
      window.prompt("Zum Kopieren markieren:", btn.dataset.copy);
    }
    const menu = btn.closest("details");
    if (menu) menu.open = false;
  });

  document.addEventListener("submit", (e) => {
    const question = e.target.dataset.confirm;
    if (question && !confirm(question)) e.preventDefault();
  });

  const url = new URL(location.href);
  if (url.searchParams.has("msg")) {
    url.searchParams.delete("msg");
    history.replaceState(null, "", url.pathname + url.search);
  }
})();
`;

export const ASSET_VERSION = createHash("sha256").update(appCss + guestJs + adminJs).digest("hex").slice(0, 10);
