frappe.provide("frappe.ui");

/* util warna */
const isLight = (hex) => {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
};
const shade = (hex, pct) => {
  let [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  [r, g, b] = [r, g, b].map(c =>
    Math.min(255, Math.max(0, Math.round((c * (100 + pct)) / 100)))
  );
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`.toLowerCase();
};

/* generate variabel hanya yg dibutuhkan */
function genVars(base) {
  const light = isLight(base);
  return {
    // "--primary": base,
    "--primary-color": base,
    "--btn-primary-bg": base,
    "--btn-primary-border": base,
    "--btn-primary-color": light ? "#000000" : "#ffffff",
    "--btn-primary-hover-bg": shade(base, light ? -10 : 10),
    "--badge-bg": base,
    "--badge-color": light ? "#000000" : "#ffffff",
    "--btn-primary-active-bg": shade(base, light ? -10 : 10)
  };
}

function getPrimaryColor(vars = {}) {
  return (
    vars["--primary-color"] ||
    vars.base_color ||
    vars.primary_color ||
    "#29CD42"
  );
}

function applyTheme(vars) {
  document.documentElement.setAttribute("data-custom-theme", "true")

   let vtag = document.getElementById("custom-theme-vars");
  if (!vtag) {
    vtag = document.createElement("style");
    vtag.id = "custom-theme-vars";
    document.head.appendChild(vtag);
  }
  vtag.innerHTML =
    ":root{\n" +
    Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n") +
    "\n}";

    if (!document.getElementById("custom-theme-override")) {
      const s = document.createElement("style");
      s.id = "custom-theme-override";
      s.innerHTML = `
        /* ─── Tombol Utama ─────────────────────────────────────── */
          [data-custom-theme="true"] .btn-primary,
          [data-custom-theme="true"] button.btn-primary,
          [data-custom-theme="true"] input[type="submit"].btn-primary {
            background-color: var(--btn-primary-bg) !important;
            color:            var(--btn-primary-color) !important;
            border-color:     var(--btn-primary-border) !important;
          }
          [data-custom-theme="true"] .btn-primary:hover,
          [data-custom-theme="true"] .btn-primary:focus,
          [data-custom-theme="true"] button.btn-primary:active,
          [data-custom-theme="true"].btn.btn-primary:active,
          [data-custom-theme="true"] .btn.btn-primary.btn-sm.primary-action:active {
            background-color: var(--btn-primary-active-bg) !important;
            border-color: var(--btn-primary-active-bg) !important;
            color: var(--btn-primary-color) !important;
          }

          /* UNIVERSAL override – taruh PALING BAWAH stylesheet override */
          [data-custom-theme="true"] input[type="checkbox"]:not(.no-override) {
            appearance: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;

            width: 16px;
            height: 16px;
            border: 1px solid #ccc !important;
            border-radius: 6px !important;
            background: #fff !important;
            position: relative;
            cursor: pointer;
            transition: background .15s;
            background-image: none !important;
            box-shadow: none !important;
            outline: none !important;
            accent-color: unset !important;

          }

          [data-custom-theme="true"] input[type="checkbox"]:checked:not(.no-override) {
            background: var(--btn-primary-bg) !important;
          }

          [data-custom-theme="true"] input[type="checkbox"]:checked:not(.no-override)::after {
            content: "✓";
            color: var(--btn-primary-color);
            font-size: 12px;
            font-weight: 700;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -55%);
            pointer-events: none;
          }

          /* disabled */
          input[type="checkbox"]:disabled:not(.no-override) {
            opacity: .45;
            cursor: not-allowed;
          }  /* ←––  KURUNG PENUTUP YANG HILANG */

          /* singkirkan gradient bawaan */
          input[type="checkbox"] {
            background-image: none !important;
          }

          [data-custom-theme="true"] .list-tag-preview {
            color: inherit !important;
          }

   `;
      document.head.appendChild(s);
      forceCheckboxAccent(); 
    }
}

function forceCheckboxAccent() {
  // Ambil warna dasar dari :root
  const bg = getComputedStyle(document.documentElement)
                .getPropertyValue('--btn-primary-bg').trim();

  // Set accentColor (Chrome, Firefox, Edge) + border inline
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    try { cb.style.accentColor = bg; } catch(_) {}
    cb.style.borderColor = bg;
  });
}

/* load theme first time */
async function loadActiveTheme() {
  const name = localStorage.getItem("active-theme-name");
  const j = localStorage.getItem("active-theme-vars");

  if (name && j) {
    try {
      const vars = JSON.parse(j);
      applyTheme(vars);
      document.documentElement.setAttribute("data-theme-mode", name);
      return; // stop di sini kalau berhasil dari localStorage
    } catch(e) {
      console.warn("Gagal parse localStorage theme:", e);
    }
  }

  // fallback ke backend
  const { message } = await frappe.call(
    "custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_active_theme"
  );
  const vars =
    Object.keys(message.variables || {}).length
      ? message.variables
      : genVars(message.base_color || "#29CD42");
  applyTheme(vars);
  document.documentElement.setAttribute("data-theme-mode", message.theme_name?.toLowerCase() || "light");

  // simpan ulang ke localStorage
  localStorage.setItem("active-theme-name", (message.theme_name || "light").toLowerCase());
  localStorage.setItem("active-theme-vars", JSON.stringify(vars));
}
document.addEventListener("DOMContentLoaded", loadActiveTheme);

/* realtime update */
frappe.realtime.on("custom_theme_updated", ({ base_color, variables }) => {
  const vars =
    Object.keys(variables || {}).length ? variables : genVars(base_color);
  applyTheme(vars);
});


// Setup realtime listener supaya update tema otomatis jika backend publish event
function setupRealtimeThemeListener() {
  if (!frappe.realtime) return;

  frappe.realtime.on("custom_theme_updated", (data) => {
    console.log("Theme updated realtime:", data);
    const base_color = data.base_color || "#29CD42";
    const vars = genVars(base_color);
    applyTheme(vars);
    localStorage.setItem("active-theme-name", data.theme_name.toLowerCase());
    localStorage.setItem("active-theme-vars", JSON.stringify(vars));
  });
}

// Init function: load theme dan setup listener
function initThemeLoader() {
  loadActiveTheme();
  setupRealtimeThemeListener();
}

// Run saat dokumen siap (atau panggil secara manual)
document.addEventListener("DOMContentLoaded", initThemeLoader);

function clearCustomTheme() {
  ["custom-theme-vars", "custom-theme-override"].forEach(id => {
    const n = document.getElementById(id);
    if (n) n.remove();
  });
  document.documentElement.removeAttribute("data-custom-theme");
}



frappe.ui.ThemeSwitcher = class ThemeSwitcher {
    constructor() {
        this._build_dialog();
        this._load_active(); // load from localStorage
        this.refresh(); // fetch themes + render
    }

    _build_dialog() {
        this.dialog = new frappe.ui.Dialog({ title: __("Switch Theme") });
        this.body = $('<div class="theme-grid"></div>').appendTo(this.dialog.$body);

        this.dialog.$wrapper.on("keydown", (e) => {
            const k = frappe.ui.keys.get_key(e);
            const step = k === "right" ? 1 : k === "left" ? -1 : 0;
            if (!step) {
                if (e.keyCode === 13) this.hide();
                return;
            }
            const idx = this.themes.findIndex((t) => t.name === this.current_theme);
            const nxt = this.themes[idx + step];
            nxt?.$html?.click();
            e.preventDefault();
        });
    }

      async _get_db_themes() {
      const res = await frappe.call(
          "custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_all_themes"
      );
      const list = (res.message || []).filter((t) => t.theme_name?.trim());

      return Promise.all(
          list.map(async (t) => {
              const r = await frappe.call(
                  "custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_ui_theme",
                  { theme_name: t.theme_name }
              );
              const base = r.message.base_color || "#29CD42"; 

              let vars = r.message.variables;
              if (typeof vars === "string") {
                  try {
                      vars = JSON.parse(vars);
                  } catch(e) {
                      console.warn("variables JSON parse error:", e);
                      vars = {};
                  }
              }

              return {
                  name: r.message.theme_name,
                  label: r.message.theme_name,
                  info: __("Custom Theme"),
                  base,
                  variables: vars,
              };
          })
      );
  }

    async refresh() {
        const defaults = [
            { name: "light", label: __("Frappe Light"), info: __("Light Theme") },
            { name: "dark", label: __("Timeless Night"), info: __("Dark Theme") },
            { name: "automatic", label: __("Automatic"), info: __("Uses system theme") },
        ];
        
        const customs = await this._get_db_themes();
        this.themes = [
          ...defaults,
          ...customs
            .filter(c => !defaults.find(d => d.name === c.name)) 
            .filter(c => c.name.toLowerCase() !== "custom_dynamic") 
        ]

        this._render();
        this._apply_current();
    }

    _render() {
        this.body.empty();
        this.themes.forEach((theme) => {
            let html = this.get_preview_html(theme);
            html.appendTo(this.body);
            theme.$html = html;
        });
    }

    get_preview_html(theme) {
      let base = theme.base      
              || getPrimaryColor(theme.variables || {}); 
      if (theme.name === "light")  base = "#29CD42";
      if (theme.name === "dark")   base = "#111827";

      let vars = { ...genVars(base), ...(theme.variables || {}) };

      if (theme.name === "automatic") {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          vars["--background-color"] = prefersDark ? "#121212" : "#ffffff";
          vars["--body-text-color"]  = prefersDark ? "#ffffff" : "#000000";
      }

      const cssVars = Object.entries(vars)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ");

      const preview = $(`
        <div class="${this.current_theme === theme.name ? "selected" : ""}" style="cursor:pointer;">
          <div class="theme-thumb" style="${cssVars}">
            <div class="background" style="background: var(--background-color);">
              <div class="preview-check">${frappe.utils.icon("tick","xs")}</div>

              <div class="navbar" style="background: var(--navbar-bg); height:12px;"></div>
              <div class="p-2">
                <div class="toolbar">
                  <span class="primary" style="background: var(--primary-color); display:inline-block; width:20px; height:8px; border-radius:2px;"></span>
                </div>
                <div class="foreground" style="height:6px; margin-top:4px; border-radius:2px; background: var(--input-bg);"></div>
                <div class="foreground" style="height:6px; margin-top:4px; border-radius:2px; background: var(--input-bg);"></div>
              </div>
            </div>
          </div>
          <div class="mt-3 text-center">
            <h5 class="theme-title">${theme.label || theme.theme_name || theme.name}</h5>
          </div>
        </div>
      `);

      preview.on("click", () => {
          if (this.current_theme === theme.name) return;
          this.body.find("div.selected").removeClass("selected");
          preview.addClass("selected");
          this.toggle_theme(theme.name);
      });

      return preview;
  }


      toggle_theme(theme_name) {
        const obj = this.themes.find(t => t.name === theme_name);
        if (!obj) return;

        // 1️⃣ Terapkan langsung di client
        this._apply(obj);                     // <– kembali ke cara lama

        // 2️⃣ Simpan & broadcast ke server
        frappe.call({
          method: "custom_ui.custom_ui.doctype.ui_theme.ui_theme.set_active_theme",
          args: { theme_name: obj.name }
        });
      }

    _apply(theme) {
        if (theme.dynamic) {
            return this._show_picker();
        }

        if (theme.variables || theme.base) {
          const baseColor = theme.base || getPrimaryColor(theme.variables || {});
            const vars = {
                ...genVars(baseColor),
                ...theme.variables,
            };
            applyTheme(vars);
            this.current_theme = theme.name;
            this._save(vars, theme.name);
            frappe.show_alert(__("Custom Theme Applied"), 3);
            return;
        }

        clearCustomTheme();

        this.current_theme = theme.name;
        document.documentElement.setAttribute("data-theme-mode", this.current_theme);
        this._save(null, this.current_theme);
        frappe.show_alert(__("Theme Changed"), 3);
         if (this.current_theme === "automatic") {
          frappe.ui.set_theme();            // biarkan ERPNext memilih
        } else {
          frappe.ui.set_theme(true);        // paksa light/dark asli
        }
    }

    _show_picker() {
        const d = new frappe.ui.Dialog({
            title: __("Pick Primary Colour"),
            fields: [{ fieldname: "primary", fieldtype: "Color", label: __("Primary Colour"), default: "#29cd42", reqd: 1 }],
            primary_action_label: __("Apply"),
            primary_action: (vals) => {
                d.hide();
                const vars = genVars(vals.primary);
                applyTheme(vars);
                this.current_theme = "custom_dynamic";
                this._save(vars, "custom_dynamic");
                frappe.show_alert(__("Dynamic Theme Applied"), 3);
            },
        });
        d.show();
    }

    _save(vars, name) {
        localStorage.setItem("active-theme-name", name.toLowerCase());
        if (vars) {
          localStorage.setItem("active-theme-vars", JSON.stringify(vars));
        } else {
          localStorage.removeItem("active-theme-vars");
        }
        const n = name.toLowerCase();
          if (!["light","dark","automatic"].includes(n)) {
              frappe.call(
                  "custom_ui.custom_ui.doctype.ui_theme.ui_theme.set_active_theme",
                  { theme_name: toTitle(name) }
              );
          }
      }

    _load_active() {
        const name = localStorage.getItem("active-theme-name");
        const j = localStorage.getItem("active-theme-vars");
        if (name === "custom_dynamic") {
          localStorage.removeItem("active-theme-name");
          localStorage.removeItem("active-theme-vars");
          this.current_theme = "light";
          document.documentElement.setAttribute("data-theme-mode", "light");
          return;
        }
        if (name) {
            this.current_theme = name;
            document.documentElement.setAttribute("data-theme-mode", name);
        } else {
            this.current_theme = "light";
            document.documentElement.setAttribute("data-theme-mode", "light");
        }
    }

    _apply_current() {
        if (this.current_theme === "custom_dynamic") return; // sudah applied
        const obj = this.themes.find((t) => t.name === this.current_theme);
        if (obj) {
            const baseColor = obj.base || getPrimaryColor(obj.variables);
            const vars = { ...genVars(baseColor), ...(obj.variables || {} )};
            applyTheme(vars);
        } else if (this.current_theme === "automatic") {
            frappe.ui.set_theme();
        }
    }

    show() {
        this.dialog.show();
    }
    hide() {
        this.dialog.hide();
    }
};

frappe.ui.dark_theme_media_query = window.matchMedia("(prefers-color-scheme: dark)");

frappe.ui.set_theme = (forced) => {
    const root = document.documentElement;
    let mode = root.getAttribute("data-theme-mode");
    if (!forced && mode === "automatic") forced = frappe.ui.dark_theme_media_query.matches ? "dark" : "light";
    root.setAttribute("data-theme", forced || mode);
};

frappe.ui.add_system_theme_switch_listener = () => {
    frappe.ui.dark_theme_media_query.addEventListener("change", () => frappe.ui.set_theme());
};
