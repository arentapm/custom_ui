frappe.pages['custom_ui'].on_page_load = function (wrapper) {
    frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Switch Theme',
        single_column: true
    });

    if (!document.querySelector('link[href*="tailwind.min.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
        document.head.appendChild(link);
    }

    if (typeof Vue === 'undefined') {
        const vueScript = document.createElement('script');
        vueScript.src = 'https://cdn.jsdelivr.net/npm/vue@3.2.37/dist/vue.global.prod.js';
        vueScript.onload = () => initThemeSwitcher();
        document.head.appendChild(vueScript);
    } else {
        initThemeSwitcher();
    }

    function initThemeSwitcher() {
        const container = wrapper.querySelector('.page-content');

        if (!container) {
            console.error('Container element not found!');
            return;
        }

        const { createApp } = Vue;

        function getPrimaryColor(vars = {}) {
        return (
            vars["--primary-color"] ||
            vars.base_color ||
            vars.primary_color ||
            "#29CD42"
        );
        }

        function isLightColor(hex) {
        hex = hex.replace("#", "");
        if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        return luminance > 150;
        }

        function shadeColor(hex, pct) {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r = Math.min(255, Math.max(0, Math.round((r * (100 + pct)) / 100)));
        g = Math.min(255, Math.max(0, Math.round((g * (100 + pct)) / 100)));
        b = Math.min(255, Math.max(0, Math.round((b * (100 + pct)) / 100)));
        return (
            "#" +
            r.toString(16).padStart(2, "0") +
            g.toString(16).padStart(2, "0") +
            b.toString(16).padStart(2, "0")
        ).toLowerCase();
        }

        function genVars(base) {
        const light = isLightColor(base);
        return {
            "--primary-color": base,
            "--btn-primary-bg": base,
            "--btn-primary-border": base,
            "--btn-primary-color": light ? "#000000" : "#ffffff",
            "--btn-primary-hover-bg": shadeColor(base, light ? -10 : 10),
            "--badge-bg": base,
            "--badge-color": light ? "#000000" : "#ffffff",
            "--btn-primary-active-bg": shadeColor(base, light ? -10 : 10),
        };
        }

        createApp({
            data() {
                return {
                    themes: [],
                    deleteMode: false,
                    currentTheme: null,
                    tickIcon: frappe.utils.icon("tick", "xs"),           
                };
            },
            async created() {
                await this.fetchThemes();
                const route = frappe.get_route();
                const themeNameParam = route.length > 1 ? decodeURIComponent(route[1]) : null;
                if (themeNameParam) {
                    const matchedTheme = this.themes.find(t => t.theme_name === themeNameParam);
                    if (matchedTheme) await this.applyTheme(matchedTheme);
                }

                frappe.realtime.on("custom_theme_updated", async ({ theme_name }) => {
                    console.log("🔔 Tema baru diterapkan:", theme_name);
                    await this.loadActiveTheme();
                });

                window.addEventListener('keydown', this.boundHandleKeydown);
                
                if (frappe.router) {
                    frappe.router.on("change", () => {
                        setTimeout(() => {
                            this.loadActiveTheme();
                        }, 200);
                    });
                }
            },

            async mounted() {

                await this.loadActiveTheme();

                setTimeout(() => {
                    if (frappe.ui?.keys?.unbind) {
                        frappe.ui.keys.unbind('ctrl+shift+g');
                        console.log("Shortcut Ctrl+Shift+G berhasil dinonaktifkan");
                    }
                }, 300);
            },

            beforeUnmount() {
                window.removeEventListener('keydown', this.boundHandleKeydown);
            },

            methods: {

				async fetchThemes() {
                    try {
                        const {message: list } = await frappe.call({
                            method: "frappe.client.get_list",
                            args: {
                                doctype: "UI Theme",
                                fields: ["name", "is_active"],
                                limit_page_length: 100
                            }
                        })
                        const fetchedThemes = [];

                        for (const { name: theme_name, is_active} of list) {
                            let variables = {};
                            let base_color = "#29CD42";
                            try {
                            const { message: detail } = await frappe.call({
                                method: "custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_ui_theme",
                                args: { theme_name }
                            });
                            base_color = detail.base_color || base_color;
                            variables  = detail.variables   || {};
                            if (typeof variables === "string") {
                                variables = JSON.parse(variables || "{}");
                            }
                        } catch (e) {
                            console.error(`❌ Gagal ambil detail theme ${theme_name}`, e);
                        }

                        if (!Object.keys(variables).length) {
                            variables = genVars(base_color);
                        }

                        const generatedVars = genVars(base_color);
                        const cssVars = Object.entries(generatedVars)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join("; ");

                        fetchedThemes.push({
                            name: theme_name,
                            theme_name,
                            is_active: is_active || 0,
                            variables,
                            cssVars,
                            isChecked: false
                        });
                    }
                        this.themes = fetchedThemes;
                    } catch (error) {
                        frappe.msgprint('❌ Gagal mengambil daftar theme.');
                        console.error(error);
                    }
                },
				async loadActiveTheme() {
                    try {
                        const themeResponse = await frappe.call({
                        method: "custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_active_theme"
                        });
                        const theme = themeResponse.message;
                        if (!theme || !theme.theme_name) return;

                        const vars = Object.keys(theme.variables || {}).length
                            ? theme.variables
                            : genVars(theme.base_color || "#29CD42");
                        this._removeInjectedThemeStyles();
                        this._applyCssVariables(theme.variables);

                        } catch (error) {
                            console.warn("Gagal memuat tema aktif:", error);
                        }
                    },

                    _injectStyle(cssContent, styleId) {
                    const oldStyle = document.getElementById(styleId);
                    if (oldStyle) oldStyle.remove();

                    const styleTag = document.createElement("style");
                    styleTag.id = styleId;
                    styleTag.innerText = cssContent;
                    document.head.appendChild(styleTag);
                    },

                    _removeInjectedThemeStyles() {
                    document.querySelectorAll('style[data-theme-style="true"], style#active-theme-style').forEach(e => e.remove());
                    },

                    _applyCssVariables(variables) {
                    if (!variables || typeof variables !== "object") return;

                    Object.entries(variables).forEach(([key, val]) => {
                        const value = val || "#000000";
                        if (!key.startsWith("--")) {
                        console.warn(`⚠️ Variable CSS tidak valid (harus mulai dengan --): ${key}`);
                        return;
                        }
                        document.documentElement.style.setProperty(key, value);
                    });
                    },

                    mounted() {
                    this.loadActiveTheme();

                    frappe.realtime.on("custom_theme_updated", async ({ theme_name }) => {
                        console.log("🔔 Tema baru diterapkan:", theme_name);
                        await this.loadActiveTheme();
                    });
                    },

                async applyTheme(theme) {
                    if (this.deleteMode) {
                        theme.isChecked = !theme.isChecked;
                        return;
                    }
                    await this.applyActiveTheme(theme);
                    await frappe.call({
                        method: "custom_ui.custom_ui.doctype.ui_theme.ui_theme.set_active_theme",
                        args: { theme_name: theme.theme_name }
                    });

                    this.themes.forEach(t => t.isChecked = false);
                    theme.isChecked = true;
                    this.currentTheme = theme.name;
                    frappe.show_alert({ message: `${theme.theme_name} applied`, indicator: "green" });
                    frappe.set_route("custom_ui", encodeURIComponent(theme.theme_name));
                },

                async applyActiveTheme(theme) {
                    const vars =
                        Object.keys(theme.variables || {}).length
                          ? theme.variables
                          : genVars(theme.base_color || "#29CD42");
                    
                      if (typeof applyTheme === "function") {
                          applyTheme(vars);
                       } else {
                          console.error("applyTheme() not found; pastikan theme_loader.js sudah termuat");
                      }

                      localStorage.setItem("active_theme_variables", JSON.stringify(vars));
                    
                      console.log(`✅ Tema '${theme.theme_name}' diterapkan via applyTheme`);
                    },
                
                async openAddDialog() {
                const dialog = new frappe.ui.Dialog({
                    title: 'Add New Theme',
                    fields: [
                    { label: 'Theme Name', fieldname: 'theme_name', fieldtype: 'Data', reqd: 1 },
                    { label: 'Base Color', fieldname: 'base_color', fieldtype: 'Color', default: '#3b82f6' }
                    ],
                    primary_action_label: 'Save',
                    primary_action: async (values) => {
                        const name = values.theme_name.trim();
                        const pattern = /^[A-Za-z0-9 ]+$/;
                         if (!name) {
                            frappe.msgprint("Nama tema tidak boleh kosong.");
                            return;
                        }

                        if (!pattern.test(name)) {
                            frappe.msgprint("Nama tema hanya boleh mengandung huruf, angka, dan spasi.");
                            return;
                        }
                        if (!values.base_color || !values.base_color.trim()){
                            frappe.msgprint("Base color harus diisi!!");
                            return;
                        }
                    const variables = genVars(values.base_color);
                    await frappe.call({
                        method: 'frappe.client.insert',
                        args: {
                        doc: {
                            doctype: 'UI Theme',
                            theme_name: values.theme_name,
                            variables: JSON.stringify(variables),
                            base_color: values.base_color
                        }
                        }
                    });
                    dialog.hide();
                    frappe.show_alert('Theme added!', 'green');
                    await this.fetchThemes();
                    }
                });
                dialog.show();
                },
				toggleDeleteMode() {
					this.deleteMode = !this.deleteMode;
				},
				async deleteSelected() {
                    const selected = this.themes.filter(t => t.isChecked);
                    if (!selected.length) return;

                    const confirmDialog = new frappe.ui.Dialog({
                        title: "Confirm Deletion",
                        indicator: "red",
                        fields: [{
                            fieldtype: "HTML",
                            options: `<p>Are you sure you want to delete <strong>${selected.length}</strong> selected theme(s)? This action cannot be undone.</p>`
                        }],
                        primary_action_label: "Delete",
                        primary_action: async () => {
                            confirmDialog.hide();

                            for (const theme of selected) {
                                try {
                                    await frappe.call({
                                        method: 'frappe.client.delete',
                                        args: {
                                            doctype: 'UI Theme',
                                            name: theme.name    
                                        }
                                    });
                                    console.log(`✅ Theme ${theme.name} deleted`);
                                } catch (e) {
                                    console.error(`❌ Gagal hapus tema ${theme.name}:`, e.message);
                                    frappe.msgprint(`Gagal hapus tema "${theme.name}": ${e.message}`);
                                }
                            }

                            frappe.show_alert('Themes deleted!', 'red');
                            this.deleteMode = false;
                            await this.fetchThemes();
                        }
                    });

                    confirmDialog.show();
                }
			},
            template: `
                <div class="space-y-6">
                    <div class="flex items-center gap-2 mb-2">
                    <button class="btn btn-primary" @click="openAddDialog">+ Add Theme</button>

                    <button class="btn"
                            :class="deleteMode ? 'btn-danger' : 'btn-outline-danger'"
                            @click="toggleDeleteMode">
                        {{ deleteMode ? 'Cancel Delete' : 'Delete Themes' }}
                    </button>

                    <button v-if="deleteMode"
                            class="btn btn-danger"
                            @click="deleteSelected">
                        Confirm Delete
                    </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div v-for="theme in themes"
                        :key="theme.name"
                        class="cursor-pointer select-none"
                        @click="applyTheme(theme)">

                        <div class="theme-thumb w-full h-40 rounded-lg shadow border relative overflow-hidden"
                            :class="currentTheme === theme.name ? 'ring-2 ring-blue-400' : ''"
                            :style="theme.cssVars">

                        <!-- centang untuk tema aktif -->
                        <div class="absolute top-1 right-1 z-10 bg-white/80 rounded-full p-1"
                            v-if="currentTheme === theme.name"
                            v-html="tickIcon">
                        </div>

                        <div class="absolute top-1 left-1 z-10" v-if="deleteMode">
                            <input type="checkbox"
                                v-model="theme.isChecked"
                                @click.stop
                                class="form-checkbox h-4 w-4 text-red-600 rounded border-gray-300 shadow-sm focus:ring-red-500">
                        </div>


                        <div class="navbar h-3 w-full" style="background: var(--navbar-bg)"></div>

                        <div class="p-2 space-y-2">
                            <div class="toolbar h-4 w-full rounded"
                                style="background: var(--input-bg)">
                            <span class="primary inline-block h-3 w-1/4 rounded"
                                    style="background: var(--primary-color)"></span>
                            </div>

                            <div class="foreground h-3 w-full rounded"
                                style="background: var(--input-bg)"></div>
                            <div class="foreground h-3 w-2/3 rounded"
                                style="background: var(--input-bg)"></div>
                        </div>
                        </div>

                        <div class="mt-2 text-center text-sm font-medium">
                        {{ theme.theme_name }}
                        </div>
                    </div>
                </div>
                `

        }).mount(container);
    }

};