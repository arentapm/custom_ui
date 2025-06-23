frappe.ui.form.on("UI Theme", {
  refresh(frm) {
    frappe.after_ajax(() => {
      if (!frm.fields_dict.is_active_display) {
        console.warn("⚠️ Field 'is_active_display' belum dirender.");
        return;
      }

      const checked = frm.doc.is_active == 1;
      const html = `
        <label style="display: flex; align-items: center;">
          <input type="checkbox" disabled ${checked ? "checked" : ""} style="margin-right: 8px;" />
          <span>${checked ? "Aktif" : "Tidak Aktif"}</span>
        </label>
      `;
      frm.fields_dict.is_active_display.$wrapper.html(html);
    });

    // ← realtime listener DIPISAH dari after_ajax
    frappe.realtime.on("custom_theme_updated", () => {
      if (cur_frm && cur_frm.doc.doctype === "UI Theme") {
      }
    });
  }
});