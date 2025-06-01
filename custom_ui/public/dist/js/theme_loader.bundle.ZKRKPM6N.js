(() => {
  // ../custom_ui/custom_ui/public/js/theme_loader.js
  document.addEventListener("DOMContentLoaded", function() {
    if (window.frappe && typeof frappe.call === "function") {
      console.log("\u2705 DOM dan Frappe siap");
      frappe.call("custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_active_theme").then((r) => {
        const data = r.message;
        console.log("\u{1F308} Tema aktif:", data);
        const variables = data.variables || {};
        const root = document.documentElement;
        Object.keys(variables).forEach((key) => {
          root.style.setProperty(key, variables[key]);
        });
        console.log("\u2705 Tema berhasil diterapkan di global system");
      }).catch((err) => {
        console.error("\u274C Gagal memuat tema:", err);
      });
    } else {
      console.warn("\u26A0\uFE0F frappe.call belum tersedia. Tunggu hingga Frappe selesai loading.");
    }
  });
})();
//# sourceMappingURL=theme_loader.bundle.ZKRKPM6N.js.map
