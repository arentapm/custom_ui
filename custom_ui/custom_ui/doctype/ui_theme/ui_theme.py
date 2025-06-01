import frappe
import json
from frappe import _
import os
from jinja2 import Template 

from frappe.model.document import Document

class UITheme(Document):
    def validate(self):
        if not self.theme_name or not self.theme_name.strip():
            frappe.throw(_("Nama tema harus diisi."))

@frappe.whitelist()
def get_all_themes(theme_name=None):
    filters = {}
    if theme_name:
        filters['theme_name'] = theme_name

    themes = frappe.get_all('UI Theme', filters=filters, fields=["name", "theme_name"], limit=1)

    if not themes:
        frappe.throw(f"Tema dengan nama '{theme_name}' tidak ditemukan." if theme_name else "Tidak ada tema ditemukan.")

    theme_doc = frappe.get_doc('UI Theme', themes[0]["name"])
    variables = theme_doc.variables or {}

    if isinstance(variables, str):
        try:
            variables = json.loads(variables)
        except json.JSONDecodeError:
            variables = {}

    return {
        'theme_name': theme_doc.theme_name,
        'variables': variables
    }

@frappe.whitelist()
def get_ui_theme(theme_name=None):
    if not theme_name or not theme_name.strip():
        frappe.throw(_("Parameter theme_name harus diisi"))

    theme = frappe.get_all(
        "UI Theme",
        filters={"theme_name": theme_name},
        fields=["name", "theme_name", "variables"],
        limit=1
    )

    if not theme:
        frappe.throw(_("Tema dengan nama '{0}' tidak ditemukan.").format(theme_name))

    theme_doc = frappe.get_doc("UI Theme", theme[0].name)
    variables = theme_doc.variables or {}

    if isinstance(variables, str):
        try:
            variables = json.loads(variables)
        except json.JSONDecodeError:
            variables = {}

    return {
        "theme_name": theme_doc.theme_name,
        "variables": variables
    }

@frappe.whitelist()
def add_theme(theme_name, bg_color, text_color, card_shadow, is_active, label, variables):
    if frappe.get_value("UI Theme", {"theme_name": theme_name}):
        frappe.throw(_("Theme dengan nama ini sudah ada."))

    if isinstance(variables, str):
        try:
            variables = json.loads(variables)
        except json.JSONDecodeError:
            frappe.throw(_("Variabel tema tidak valid."))

    doc = frappe.new_doc("UI Theme")
    doc.theme_name = theme_name
    doc.bg_color = bg_color
    doc.text_color = text_color
    doc.card_shadow = card_shadow
    doc.is_active = int(is_active)
    doc.label = label
    doc.variables = variables

    doc.insert()
    frappe.db.commit()

    return doc.theme_name

@frappe.whitelist()
def delete_themes(theme_names):
    if not theme_names:
        frappe.throw(_("Daftar tema kosong."))

    if isinstance(theme_names, str):
        try:
            theme_names = json.loads(theme_names)
        except json.JSONDecodeError:
            frappe.throw(_("Format nama tema tidak valid."))

    for theme_name in theme_names:
        theme = frappe.get_value("UI Theme", {"theme_name": theme_name}, "name")
        if theme:
            frappe.delete_doc("UI Theme", theme, ignore_permissions=True)

    frappe.db.commit()
    return True

@frappe.whitelist(allow_guest=True)
def get_file_content(file_name):
    if not file_name.endswith(".css") or ".." in file_name or "/" in file_name or "\\" in file_name:
        frappe.throw(_("File tidak valid."))

    path = frappe.get_app_path("custom_ui","public", "css", file_name)

    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            css_content = f.read()
            return {"message": css_content}
    else:
        frappe.throw(_("File tidak ditemukan."))

@frappe.whitelist()
def get_active_theme():
    theme = frappe.get_all("UI Theme", filters={"is_active": 1}, fields=["name", "theme_name", "variables", "css_template"], limit=1)

    if not theme:
        frappe.throw(_("Tidak ada tema aktif ditemukan."))

    theme_doc = frappe.get_doc("UI Theme", theme[0]["name"])
    variables = theme_doc.variables or {}

    if isinstance(variables, str):
        try:
            variables = json.loads(variables)
        except json.JSONDecodeError:
            variables = {}

    return {
        'theme_name': theme_doc.theme_name,
        'variables': variables,
        'css_template': theme_doc.css_template or ""
    }


@frappe.whitelist()
def set_active_theme(theme_name):
    static_themes = ["Dark Theme", "Light Theme"]

    if theme_name in static_themes:
        frappe.db.set_value("System Settings", "System Settings", "current_theme", theme_name)
        frappe.db.commit()
        return theme_name

    theme = frappe.get_value("UI Theme", {"theme_name": theme_name}, "name")
    if not theme:
        frappe.throw(_("Tema tidak ditemukan."))

    # Nonaktifkan semua tema UI
    frappe.db.set_value("UI Theme", {"is_active": 1}, "is_active", 0)

    # Aktifkan tema terpilih
    theme_doc = frappe.get_doc("UI Theme", theme)
    theme_doc.is_active = 1
    theme_doc.save()
    frappe.db.commit()

    return theme_doc.theme_name

@frappe.whitelist()
def get_theme_css(theme_name):
    static_themes = {
        "Light Theme": {
            "--bg-color": "#ffffff",
            "--text-color": "#1f2937",
            "--card-bg": "#f3f4f6",
            "--card-shadow": "rgba(0,0,0,0.1)",
            "--header-bg": "#f3f4f6",
            "--header-text": "#1f2937",
            "--link-color": "#3b82f6",
            "--btn-hover-bg": "#e0e7ff"
        },
        "Dark Theme": {
            "--bg-color": "#1f2937",
            "--text-color": "#ffffff",
            "--card-bg": "#374151",
            "--card-shadow": "rgba(0,0,0,0.5)",
            "--header-bg": "#374151",
            "--header-text": "#ffffff",
            "--link-color": "#3b82f6",
            "--btn-hover-bg": "#4b5563"
        }
    }

    if theme_name in static_themes:
        variables = static_themes[theme_name]
    else:
        # Tema dari Doctype
        theme = frappe.get_all("UI Theme", filters={"theme_name": theme_name}, fields=["variables"], limit=1)
        if not theme:
            frappe.throw(_("Tema dengan nama '{0}' tidak ditemukan.").format(theme_name))

        theme_doc = frappe.get_doc("UI Theme", theme[0].name)
        variables = theme_doc.variables or {}
        if isinstance(variables, str):
            try:
                variables = json.loads(variables)
            except json.JSONDecodeError:
                variables = {}

    # Bangun blok :root
    root_css = ":root {\n"
    for key, value in variables.items():
        root_css += f"  {key}: {value};\n"
    root_css += "}\n"

    static_css = """
body {
  background-color: var(--bg-color);
  color: var(--text-color);
}
.btn-primary {
  background-color: var(--primary-color, #3b82f6);
  color: #fff;
}
""".strip()

    return root_css + "\n" + static_css
