import { Injectable, signal, effect, Renderer2, RendererFactory2 } from '@angular/core';

export type Theme = 'enterprise-default' | 'enterprise-dark' | 'high-contrast';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private renderer: Renderer2;
    activeTheme = signal<Theme>('enterprise-default');

    constructor(rendererFactory: RendererFactory2) {
        this.renderer = rendererFactory.createRenderer(null, null);

        effect(() => {
            const theme = this.activeTheme();
            this.applyTheme(theme);
        });
    }

    setTheme(theme: Theme) {
        this.activeTheme.set(theme);
    }

    private applyTheme(theme: Theme) {
        const root = document.documentElement;
        this.renderer.removeClass(root, 'enterprise-default');
        this.renderer.removeClass(root, 'enterprise-dark');
        this.renderer.removeClass(root, 'high-contrast');
        this.renderer.addClass(root, theme);

        // Apply CSS Variables based on theme
        const variables = this.getThemeVariables(theme);
        Object.entries(variables).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
    }

    private getThemeVariables(theme: Theme): Record<string, string> {
        switch (theme) {
            case 'enterprise-dark':
                return {
                    '--canvas-bg': '#0f172a', // Slate 900
                    '--node-bg': '#1e293b', // Slate 800
                    '--text-primary': '#f1f5f9', // Slate 100
                    '--text-secondary': '#94a3b8', // Slate 400
                    '--border-color': '#334155', // Slate 700
                    '--accent-color': '#6366f1', // Indigo 500
                    '--panel-bg': '#1e293b',
                };
            case 'high-contrast':
                return {
                    '--canvas-bg': '#ffffff',
                    '--node-bg': '#ffffff',
                    '--text-primary': '#000000',
                    '--text-secondary': '#000000',
                    '--border-color': '#000000',
                    '--accent-color': '#0000ff',
                    '--panel-bg': '#ffffff',
                };
            case 'enterprise-default':
            default:
                return {
                    '--canvas-bg': '#f8fafc', // Slate 50
                    '--node-bg': '#ffffff',
                    '--text-primary': '#1e293b', // Slate 800
                    '--text-secondary': '#64748b', // Slate 500
                    '--border-color': '#e2e8f0', // Slate 200
                    '--accent-color': '#4f46e5', // Indigo 600
                    '--panel-bg': '#ffffff',
                };
        }
    }
}
