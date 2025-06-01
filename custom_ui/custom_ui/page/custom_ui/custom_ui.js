frappe.pages['custom_ui'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'custom_ui',
		single_column: true
	});
}

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

        createApp({
            data() {
                return {
                    themes: [],
                    deleteMode: false,
                    showPreviewDialog: false,
                    showSwitcherDialog: false,
                    staticThemes: [
                        {
                            theme_name: 'Light Theme',
                            variables: {
                                '--bg-color': '#ffffff',
                                '--text-color': '#1f2937',
                                '--card-bg': '#f3f4f6',
                                '--card-shadow': 'rgba(0,0,0,0.1)',
                                '--header-bg': '#f3f4f6',
                                '--header-text': '#1f2937',
                                '--link-color': '#3b82f6',
                                '--btn-hover-bg': '#e0e7ff'
                            }
                        },
                        {
                            theme_name: 'Dark Theme',
                            variables: {
                                '--bg-color': '#1f2937',
                                '--text-color': '#ffffff',
                                '--card-bg': '#374151',
                                '--card-shadow': 'rgba(0,0,0,0.5)',
                                '--header-bg': '#374151',
                                '--header-text': '#ffffff',
                                '--link-color': '#3b82f6',
                                '--btn-hover-bg': '#4b5563'
                            }
                        }
                    ]
                };
            },
            async created() {
                this.loadActiveTheme();
                this.boundHandleKeydown = this.handleShortcut.bind(this);
                window.addEventListener('keydown', this.boundHandleKeydown);
                window.removeEventListener('keydown', this.boundHandleKeydown, true);

                await this.fetchThemes();

                const route = frappe.get_route();
                const themeNameParam = route.length > 1 ? decodeURIComponent(route[1]) : null;
                if (themeNameParam) {
                    const matchedTheme = this.themes.find(t => t.theme_name === themeNameParam);
                    if (matchedTheme) this.applyTheme(matchedTheme);
                }
            },

            mounted() {
                const script = document.createElement("script");
                script.src = "/assets/custom_ui/js/theme_loader.js";
                script.onload = () => {
                    console.log("Custom shortcuts loaded!");
                }; document.head.appendChild(script);


                window.customThemePreviewDialog = () => {
                    this.showThemePreviewDialog();
                };
                frappe.call('custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_active_theme')
                    .then(res => {
                        const activeTheme = res.message;
                        if (activeTheme && activeTheme.variables){
                            this.applyActiveTheme(activeTheme);
                        }
                    })
                    .catch(err => {
                        console.warn("Gagal mengambil tema aktif:", err);
                    });

                setTimeout(() => {
                    if (frappe.ui?.keys?.unbind){
                        frappe.ui.keys.unbind('ctrl+shift+g');
                    }
                    const disableSearchDialog = () => {
                        const dummy = function () {
                            console.warn('ERPNext default search dialog diblokir secara permanen');
                        };
                        if (frappe.desk?.global_search?.search_dialog) {
                            frappe.desk.global_search.search_dialog.show = dummy;
                        }
                        if (frappe.search && frappe.search.show) {
                            frappe.search.show = dummy;
                        }
                    };
                    disableSearchDialog();
                    this._searchBlockInterval = setInterval(disableSearchDialog, 2000);
                    console.log("Search bawaan ERPNext diblokir & dijaga terus menerus")
                }, 300);
               frappe.call({
                    method: "custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_file_content",
                    args: {
                        file_name: "style.bundle.css"
                    },
                    callback: function (response) {
                        const rawCss = typeof response.message?.message === 'string'
                            ? response.message.message
                            : null;

                        if (!rawCss) {
                            console.error("CSS content tidak valid atau bukan string:", response.message);
                            return;
                        }

                        const rootMatch = rawCss.match(/:root\s*{([^}]*)}/);
                        if (!rootMatch) {
                            console.error("Tidak menemukan blok :root dalam CSS:", rawCss);
                            return;
                        }

                        const varsBlock = rootMatch[1].trim();
                        const lines = varsBlock.split('\n');

                        lines.forEach(line => {
                            const parts = line.split(':');
                            if (parts.length === 2) {
                                const key = parts[0].trim();
                                const value = parts[1].trim().replace(';', '');
                                document.documentElement.style.setProperty(key, value);
                            }
                        });

                        console.log("Tema berhasil diterapkan");
                    }
                });
            },


            beforeUnmount() {
                if ( this.searchBlockInterval) {
                    clearInterval(this._searchBlockInterval);
                }
                window.removeEventListener('keydown', this.boundHandleKeydown);
            },

            methods: {
				handleShortcut(e) {
					const key = e.key.toLowerCase();
					if (e.ctrlKey && e.shiftKey && key === 'g') {
						e.preventDefault();
						e.stopImmediatePropagation();
						this.showThemePreviewDialog();
						return;
					}
					if (e.ctrlKey && e.altKey && key === 't') {
						e.preventDefault();
						this.showThemePreviewDialog();
					}
				},
				showThemePreviewDialog() {
					if (this.currentThemeDialog && this.currentThemeDialog.is_visible) {
						this.currentThemeDialog.hide();
						return;
					}
					const d = new frappe.ui.Dialog({
						title: 'Theme Preview',
						size: 'large',
						fields: [
							{ fieldtype: 'HTML', fieldname: 'theme_preview_area' }
						],
						primary_action_label: 'Close',
						primary_action() { d.hide(); },
						secondary_action_label: 'Add Theme',
						secondary_action: () => {
							d.hide();
							this.openAddDialog();
						}
					});
					this.currentThemeDialog = d;
					d.show();
					setTimeout(() => {
						const container = d.get_field('theme_preview_area').$wrapper.get(0);
						if (!container) return;
						const allThemes = [...this.staticThemes, ...this.themes];
						let html = '<div style="display: flex; gap: 20px; flex-wrap: wrap; padding: 10px;">';
						for (let i = 0; i < allThemes.length; i++) {
							const theme = allThemes[i];
							const title = theme.theme_name + (theme.name ? ' (Dynamic)' : ' (Static)');
							const vars = theme.variables;
							html += `
								<div style="width:200px;height:200px;border-radius:8px;overflow:hidden;box-shadow:0 4px 8px ${vars['--card-shadow'] || 'rgba(0,0,0,0.1)'};background-color:${vars['--bg-color']};color:${vars['--text-color']};font-family:sans-serif;display:flex;flex-direction:column;">
									<div style="background-color:${vars['--header-bg']};color:${vars['--header-text']};padding:12px;font-weight:bold;display:flex;align-items:center;gap:10px;">
										<div style="width:32px;height:32px;border-radius:50%;background-color:${vars['--btn-hover-bg']};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;">🎨</div>
										${title}
									</div>
									<div style="padding:12px;background-color:${vars['--card-bg']};flex:1;">
										<button class="apply-theme-btn" data-theme-index="${i}" data-theme-type="${theme.name ? 'dynamic' : 'static'}" style="background-color:${vars['--btn-hover-bg']};color:${vars['--text-color']};border:none;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer;">Apply</button>
										<a href="#" style="color:${vars['--link-color']};font-size:12px;text-decoration:underline;">Lihat selengkapnya</a>
									</div>
								</div>`;
						}
						html += '</div>';
						container.innerHTML = html;
						container.querySelectorAll('.apply-theme-btn').forEach(btn => {
							btn.addEventListener('click', () => {
								const index = parseInt(btn.getAttribute('data-theme-index'));
								const selectedTheme = allThemes[index];
								this.applyTheme(selectedTheme);
								d.hide();
							});
						});
					}, 0);
				},
				async fetchThemes() {
					try {
						const res = await frappe.call({
							method: 'frappe.client.get_list',
							args: {
								doctype: 'UI Theme',
								fields: ['name', 'theme_name'],
								limit_page_length: 100
							}
						});
						for (let theme of res.message) {
							if (!theme.theme_name) {
								console.warn("Theme name kosong atau tidak ditemukan:", theme);
								theme.variables = {};
								continue;  // skip ke theme berikutnya
							}
							try {
								const doc = await frappe.call({
									method: 'custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_ui_theme',
									args: { theme_name: theme.theme_name }
								});
								theme.variables = doc.message?.variables || {};
							} catch (innerError) {
								console.error(`Error fetching details for theme: ${theme.theme_name}`, innerError);
								theme.variables = {};
							}
						}
						this.themes = res.message;
					} catch (error) {
						frappe.msgprint('Failed to fetch themes.');
						console.error(error);
					}
				},
				async loadActiveTheme() {
                    try {
                        const themeResponse = await frappe.call({
                            method: "custom_ui.custom_ui.doctype.ui_theme.ui_theme.get_active_theme"
                        });
                        const theme = themeResponse.message;

                        if (!theme?.theme_name || !theme.variables) {
                            console.warn("Tema tidak lengkap atau tidak ada.");
                            return;
                        }

                        // Inject CSS jika ada
                        if (theme.css_template) {
                            document.querySelectorAll('style[data-theme-style="true"]').forEach(e => e.remove());
                            const style = document.createElement("style");
                            style.innerHTML = theme.css_template;
                            style.setAttribute("data-theme-style", "true");
                            document.head.appendChild(style);
                            console.log("Dynamic CSS berhasil diterapkan.");
                        }

                        // Apply variables
                        await this.applyActiveTheme(theme);

                    } catch (error) {
                        console.warn("Gagal memuat tema aktif:", error);
                    }
                },

                async applyTheme(theme) {
                    if (this.deleteMode) {
                        theme.isChecked = !theme.isChecked;
                        return;
                    }
                    // Apply variables langsung
                    await this.applyActiveTheme(theme);

                    // Simpan tema aktif ke backend
                    await frappe.call({
                        method: "custom_ui.custom_ui.doctype.ui_theme.ui_theme.set_active_theme",
                        args: { theme_name: theme.theme_name }
                    });

                    // Update UI
                    this.themes.forEach(t => t.isChecked = false);
                    theme.isChecked = true;
                    frappe.show_alert({ message: `${theme.theme_name} applied`, indicator: "green" });
                    frappe.set_route("custom_ui", encodeURIComponent(theme.theme_name));
                },

                async applyActiveTheme(theme) {
                    if (theme?.variables) {
                        for (const [key, val] of Object.entries(theme.variables)) {
                            const value = val || '#000000';
                            document.documentElement.style.setProperty(key, val);
                        }
                    }
                    if (theme?.theme_name) {
                        const oldStyle = document.getElementById('active-theme-style');
                        if (oldStyle) oldStyle.remove();
                        const styleTag = document.createElement('style');
                        styleTag.id = 'active-theme-style';
                        styleTag.innerText = theme.css_template;
                        document.head.appendChild(styleTag);
                    }
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
							const lighten = (hex, percent) => {
								let num = parseInt(hex.replace('#',''),16),
									r = (num >> 16) + Math.round(255 * percent),
									g = ((num >> 8) & 0x00FF) + Math.round(255 * percent),
									b = (num & 0x0000FF) + Math.round(255 * percent);
								r = Math.min(255, Math.max(0, r));
								g = Math.min(255, Math.max(0, g));
								b = Math.min(255, Math.max(0, b));
								return `#${(r << 16 | g << 8 | b).toString(16).padStart(6,'0')}`;
							};
							const variables = {
								'--bg-color': '#ffffff',
								'--text-color': '#1f2937',
								'--card-bg': lighten(values.base_color, 0.8),
								'--card-shadow': 'rgba(0,0,0,0.1)',
								'--header-bg': lighten(values.base_color, 0.6),
								'--header-text': '#1f2937',
								'--link-color': values.base_color,
								'--btn-hover-bg': lighten(values.base_color, 0.9)
							};
							await frappe.call({
								method: 'frappe.client.insert',
								args: {
									doc: {
										doctype: 'UI Theme',
										theme_name: values.theme_name,
										variables: JSON.stringify(variables)
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
						fields: [{ fieldtype: "HTML", options: `<p>Are you sure you want to delete <strong>${selected.length}</strong> selected theme(s)? This action cannot be undone.</p>` }],
						primary_action_label: "Delete",
						primary_action: async () => {
							confirmDialog.hide();
							for (const theme of selected) {
								await frappe.call({
									method: 'frappe.client.delete',
									args: {
										doctype: 'UI Theme',
										name: theme.name
									}
								});
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
                    <h2 class="text-xl font-semibold">Available Themes</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div
                            v-for="(theme, i) in staticThemes"
                            :key="'static-' + i"
                            class="w-40 h-40 rounded-lg border shadow overflow-hidden cursor-pointer"
                            @click="applyTheme(theme)"
                            :style="{
                                backgroundColor: theme.variables['--bg-color'],
                                color: theme.variables['--text-color']
                            }"
                        >
                            <div class="px-2 py-1 font-semibold" :style="{ backgroundColor: theme.variables['--header-bg'], color: theme.variables['--header-text'] }">
                                {{ theme.theme_name }}
                            </div>
                            <div class="p-2 flex h-full" :style="{ backgroundColor: theme.variables['--card-bg'], color: theme.variables['--text-color'] }">
                                <div class="w-1/4 space-y-1">
                                    <div class="h-3 rounded bg-gray-300 dark:bg-gray-700"></div>
                                    <div class="h-3 rounded bg-gray-300 dark:bg-gray-700"></div>
                                    <div class="h-3 rounded bg-gray-300 dark:bg-gray-700"></div>
                                </div>
                                <div class="w-3/4 pl-2 space-y-2 text-xs">
                                    <div class="h-3 w-2/3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                                    <div class="h-3 w-1/2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                                    <a href="#" class="underline inline-block" :style="{ color: theme.variables['--link-color'] }">Link Preview</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-between items-center">
                        <div class="space-x-2">
                            <button class="btn btn-danger" @click="toggleDeleteMode">
                                {{ deleteMode ? 'Cancel Delete' : 'Delete Themes' }}
                            </button>
                            <button v-if="deleteMode" class="btn btn-danger" @click="deleteSelected">Confirm Delete</button>
                            <button class="btn btn-primary" @click="openAddDialog">+ Add Theme</button>
                        </div>
                    </div>

                    <h2 class="text-xl font-semibold">Custom Themes</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div
                            v-for="theme in themes"
                            :key="theme.name"
                            class="relative w-40 h-40 rounded-lg border shadow cursor-pointer overflow-hidden"
                            :style="{
                                backgroundColor: theme.variables['--bg-color'],
                                color: theme.variables['--text-color'],
                                borderColor: theme.isChecked ? deleteMode ? 'red' : 'blue' : theme.variables['--card-shadow']
                            }"
                            :class="{
                                'ring-2 ring-blue-300': theme.isChecked && !deleteMode,
                                'ring-2 ring-red-300': theme.isChecked && deleteMode
                            }"
                            @click="applyTheme(theme)"
                        >
                            <div class="absolute inset-0 flex flex-col">
                                <div class="px-2 py-1 font-semibold" :style="{ backgroundColor: theme.variables['--header-bg'], color: theme.variables['--header-text'] }">
                                    {{ theme.theme_name }}
                                    <input 
                                        v-if="deleteMode"
                                        type="checkbox"
                                        @click.stop
                                        class="ml-2"
                                        v-model="theme.isChecked"
                                    />
                                </div>
                                <div class="p-2 flex flex-1" :style="{ backgroundColor: theme.variables['--card-bg'], color: theme.variables['--text-color'] }">
                                    <div class="w-1/4 space-y-1">
                                        <div class="h-3 rounded bg-gray-300 dark:bg-gray-700"></div>
                                        <div class="h-3 rounded bg-gray-300 dark:bg-gray-700"></div>
                                        <div class="h-3 rounded bg-gray-300 dark:bg-gray-700"></div>
                                    </div>
                                    <div class="w-3/4 pl-2 space-y-2 text-xs">
                                        <div class="h-3 w-2/3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                                        <div class="h-3 w-1/2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                                        <a href="#" class="underline inline-block" :style="{ color: theme.variables['--link-color'] }">Link Preview</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        }).mount(container);
    }

};