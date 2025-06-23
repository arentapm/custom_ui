import json, re, frappe
from frappe import _
from frappe.model.document import Document

HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{6})$")


def _validate_hex(color: str):
    if not HEX_RE.match(color or ""):
        frappe.throw(_("Base colour must be a 6-digit HEX code (e.g. #1a73e8)"))


def _parse_variables(raw):
    """Safely parse JSON string → dict; fallback {}"""
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw) or {}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "UI Theme: invalid variables JSON")
        return {}

def _hex_to_rgb(hex_color: str):
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
    return r, g, b


def _is_light(hex_color: str) -> bool:
    r, g, b = _hex_to_rgb(hex_color)
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150


def shade(hex_color: str, pct: int) -> str:
    r, g, b = _hex_to_rgb(hex_color)
    r = max(0, min(255, int(r * (100 + pct) / 100)))
    g = max(0, min(255, int(g * (100 + pct) / 100)))
    b = max(0, min(255, int(b * (100 + pct) / 100)))
    return "#{:02x}{:02x}{:02x}".format(r, g, b)


def _contrast_text(hex_color: str) -> str:
    r, g, b = _hex_to_rgb(hex_color)
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return "#000000" if lum > 0.6 else "#ffffff"


def generate_variables(base_color: str) -> dict:
    if not base_color:
        frappe.throw(_("Base color tidak boleh kosong.")) 
    light = _is_light(base_color)

    return {
        # "--primary": base_color,                    
        "--primary-color": base_color,              
        "--btn-primary-bg": base_color,             
        "--btn-primary-border": base_color,         
        "--btn-primary-color": "#000000" if light else "#ffffff",
        "--btn-primary-hover-bg": shade(base_color, -10 if light else 10),
        "--badge-bg": base_color,                   
        "--badge-color": "#000000" if light else "#ffffff",
        "--btn-primary-active-bg": shade(base_color, -10 if light else 10)
    }

class UITheme(Document):
    def on_trash(self):
        if self.is_active:
            frappe.db.set_value("User", frappe.session.user, "desk_theme", "light", update_modified=False)
            frappe.db.commit()
            frappe.publish_realtime("custom_theme_updated", {
                "theme_name": "light",
                "base_color": "#29CD42",
                "variables": {}
            })

    def autoname(self):
        if self.theme_name:
            self.name = self.theme_name.strip()

    def validate(self):
        if self.is_active:
            existing = frappe.db.exists("UI Theme", {"is_active": 1, "name": ["!=", self.name]})
        if existing:
            frappe.throw(_("Tema aktif sudah ada. Hanya satu tema yang boleh aktif dalam satu waktu."))
        self.variables = json.dumps(generate_variables(self.base_color))

        if not self.theme_name or not self.theme_name.strip():
            frappe.throw(_("Theme name harus diisi"))

        if not re.match("^[A-Za-z0-9 ]+$", self.theme_name):
            frappe.throw(_("Theme name hanya boleh berisi huruf, angka, dan angka"))

        if not self.base_color or not self.base_color.strip():  
            frappe.throw(_("Base color harus diisi."))

        if self.is_active:
            frappe.db.sql("UPDATE `tabUI Theme` SET is_active = 0 WHERE 1=1")
            frappe.db.set_value("UI Theme", self.name, "is_active", 1)

        if (
            frappe.db.exists("UI Theme", self.theme_name)
            and self.name != self.theme_name
        ):
            frappe.throw(_("Theme name must be unique"))
            
        self.variables = json.dumps(generate_variables(self.base_color))

        _validate_hex(self.base_color or "#29CD42")

        if isinstance(self.variables, str):
            try:
                json.loads(self.variables or "{}")
            except json.JSONDecodeError:
                frappe.throw(_("Field variables harus berupa JSON valid"))


    def before_save(self):
        if self.is_active:
            frappe.db.sql("""
                UPDATE `tabUI Theme`
                SET is_active = 0
                WHERE name != %s
            """, (self.name,))
        else:
            # Jika tidak aktif, pastikan tidak ada tema lain yang aktif (untuk safety)
            if not frappe.db.exists("UI Theme", {"is_active": 1, "name": ["!=", self.name]}):
                self.is_active = 1
        if not self.variables and self.base_color:
            self.variables = json.dumps(generate_variables(self.base_color), indent=2)
        if not frappe.flags.in_set_active_theme:
            self.is_active = frappe.db.get_value("UI Theme", self.name, "is_active")

@frappe.whitelist()
def get_all_themes():
    """Daftar semua tema untuk grid picker."""
    return frappe.get_all(
        "UI Theme",
        fields=["theme_name", "base_color", "is_active"],
        order_by="modified desc",
    )


@frappe.whitelist()
def get_ui_theme(theme_name):
    """Ambil satu tema + base_color + variables (parsed)."""
    if not theme_name or not theme_name.strip():
        frappe.throw(_("Parameter theme_name harus diisi"))

    theme_name = theme_name.strip()
    if not frappe.db.exists("UI Theme", {"theme_name": theme_name}):
        frappe.throw(_("Theme '{0}' tidak ditemukan").format(theme_name))

    doc = frappe.get_doc("UI Theme", {"theme_name": theme_name})
    return {
        "theme_name": doc.theme_name,
        "base_color": doc.base_color,
        "variables": _parse_variables(doc.variables),
    }

@frappe.whitelist()
def set_active_theme(theme_name: str):
    """Aktifkan satu tema dan nonaktifkan lainnya."""

    frappe.log_error(f"Menjalankan set_active_theme untuk: {theme_name}", "DEBUG_THEME")

    if not theme_name:
        frappe.throw(_("theme_name required"))

    theme_name = theme_name.strip()
    lower = theme_name.lower()

    # 1. Jika pakai tema bawaan (Light, Dark, Automatic)
    if lower in ("light", "dark", "automatic"):
        frappe.db.sql("UPDATE `tabUI Theme` SET is_active = 0 WHERE is_active = 1")
        frappe.db.set_value("User", frappe.session.user, "desk_theme", lower, update_modified=False)
        frappe.db.commit()

        return {
            "theme_name": lower,
            "base_color": "#29CD42",
            "theme_variables": {},
        }

    # 2. Cek apakah tema ada
    if not frappe.db.exists("UI Theme", {"theme_name": theme_name}):
        frappe.throw(_("Theme '{0}' tidak ditemukan").format(theme_name))

    # 3. Ambil dokumen tema
    doc = frappe.get_doc("UI Theme", {"theme_name": theme_name})

    # 4. Nonaktifkan semua tema lain
    frappe.db.sql("UPDATE `tabUI Theme` SET is_active = 0 WHERE 1=1")

    # 5. Tandai tema ini sebagai aktif & simpan
    frappe.flags.in_set_active_theme = True
    doc.is_active = 1
    doc.save(ignore_permissions=True)
    frappe.flags.in_set_active_theme = False
    frappe.db.set_value("User", frappe.session.user, "desk_theme", "", update_modified=False)
    variables = _parse_variables(doc.variables) or generate_variables(doc.base_color or "#29CD42")
    frappe.publish_realtime("custom_theme_updated", {
        "theme_name": doc.theme_name,
        "base_color": doc.base_color,
        "variables": variables,
    })

    return {
        "theme_name": doc.theme_name,
        "base_color": doc.base_color,
        "theme_variables": variables,
    }

@frappe.whitelist()
def get_active_theme():

    name = frappe.db.get_value("UI Theme", {"is_active": 1}, "name")
    if name and frappe.db.exists("UI Theme", name):
        doc = frappe.get_doc("UI Theme", name)
        return {
            "theme_name": doc.theme_name,
            "base_color": doc.base_color,
            "variables": _parse_variables(doc.variables),
            "is_default": False
        }

    user_theme = frappe.db.get_value("User", frappe.session.user, "desk_theme") or "light"
    if user_theme.lower() in ("light", "dark", "automatic"):
        return {
            "theme_name": user_theme.lower(),
            "base_color": "#29CD42",
            "variables": {},
            "is_default": True
        }

    return {
        "theme_name": "light",
        "base_color": "#29CD42",
        "variables": {},
        "is_default": True
    }




