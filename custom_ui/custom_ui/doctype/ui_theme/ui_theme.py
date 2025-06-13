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
    """
    Hanya menghasilkan variabel yang diperlukan untuk:
    - Tombol utama (.btn-primary)
    - Checkbox (checked & hover)
    - Badge demo (preview)
    """
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
    def autoname(self):
        if self.theme_name:
            self.name = self.theme_name.strip()

    def validate(self):
        # 1️⃣ Konversi dict ke JSON string
        self.variables = json.dumps(generate_variables(self.base_color))

        if not self.theme_name or not self.theme_name.strip():
            frappe.throw(_("Theme name harus diisi"))

        # 2️⃣ Pastikan nama unik
        if (
            frappe.db.exists("UI Theme", self.theme_name)
            and self.name != self.theme_name
        ):
            frappe.throw(_("Theme name must be unique"))

        # 3️⃣ Validasi base color
        _validate_hex(self.base_color or "#29CD42")

        # 4️⃣ Validasi bahwa variables adalah string JSON yang valid
        if isinstance(self.variables, str):
            try:
                json.loads(self.variables or "{}")
            except json.JSONDecodeError:
                frappe.throw(_("Field variables harus berupa JSON valid"))

    def before_save(self):
        """
        Isi otomatis `variables` jika kosong,
        menggunakan `generate_variables(self.base_color)`.
        """
        if not self.variables and self.base_color:
            self.variables = json.dumps(generate_variables(self.base_color), indent=2)

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
def add_theme(theme_name, base_color, variables=None):
    """Tambahkan tema baru."""
    if not theme_name or not theme_name.strip():
        frappe.throw(_("Theme name harus diisi"))

    theme_name = theme_name.strip()
    _validate_hex(base_color)

    if frappe.db.exists("UI Theme", {"theme_name": theme_name}):
        frappe.throw(_("Theme '{0}' sudah ada").format(theme_name))

    if not variables:
        variables = generate_variables(base_color)
    else:
        variables = _parse_variables(variables)

    doc = frappe.get_doc(
        {
            "doctype": "UI Theme",
            "theme_name": theme_name,
            "base_color": base_color,
            "variables": json.dumps(variables),
        }
    ).insert(ignore_permissions=True)

    return doc.theme_name


@frappe.whitelist()
def delete_themes(theme_names):
    """Hapus banyak tema berdasarkan list nama."""
    if isinstance(theme_names, str):
        theme_names = json.loads(theme_names or "[]")

    for tn in theme_names:
        name = frappe.get_value("UI Theme", {"theme_name": tn}, "name")
        if name:
            frappe.delete_doc("UI Theme", name, ignore_permissions=True)

    frappe.db.commit()
    return True


@frappe.whitelist()
def set_active_theme(theme_name: str):
    """Aktifkan tema dan kembalikan variabel ke frontend."""
    if not theme_name:
        frappe.throw(_("theme_name required"))

    theme_name = theme_name.strip()
    lower = theme_name.lower()

    # 1) Tema bawaan (Light / Dark / Automatic) ───────────────────────────
    if lower in ("light", "dark", "automatic"):
        # simpan preferensi user
        frappe.db.set_value(
            "User", frappe.session.user, "desk_theme", lower, update_modified=False
        )
        return {"theme_name": lower, "theme_variables": {}}

    # 2) Tema kustom (DocType UI Theme) ───────────────────────────────────
    doc = frappe.get_doc("UI Theme", {"theme_name": theme_name})
    if not doc:
        frappe.throw(_("Theme '{0}' tidak ditemukan").format(theme_name))

    # non-aktifkan semua, lalu aktifkan tema terpilih
    frappe.db.set_value("UI Theme", {"is_active": 1}, "is_active", 0, update_modified=False)
    frappe.db.set_value("UI Theme", doc.name, "is_active", 1, update_modified=False)

    # pastikan kolom variables sudah serialised (string JSON)
    if isinstance(doc.variables, dict):
        import json
        variables_json = json.dumps(doc.variables or {})
        frappe.db.set_value("UI Theme", doc.name, "variables", variables_json, update_modified=False)
    else:
        variables_json = doc.variables or "{}"

    frappe.db.commit()  # selesai semua mutasi

    # ── siapkan payload ke frontend ──────────────────────────────────────
    variables = _parse_variables(variables_json) or generate_variables(doc.base_color or "#29CD42")

    frappe.publish_realtime(
        "custom_theme_updated",
        {
            "theme_name": doc.theme_name,
            "base_color": doc.base_color,
            "variables": variables,
        },
    )

    return {
        "theme_name": doc.theme_name,
        "theme_variables": variables,
    }

@frappe.whitelist()
def get_active_theme():
    """Ambil tema aktif (lengkap dengan variables)."""
    name = frappe.db.get_value("UI Theme", {"is_active": 1}, "name")
    if not name:
        return {
            "theme_name": "Light",
            "base_color": "#29CD42",
            "variables": {},
            "is_default": True,
        }

    doc = frappe.get_doc("UI Theme", name)
    return {
        "theme_name": doc.theme_name,
        "base_color": doc.base_color,
        "variables": _parse_variables(doc.variables),
    }
