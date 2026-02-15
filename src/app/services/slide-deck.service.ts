import { Injectable, signal } from '@angular/core';

export interface SlideDefinition {
    id: string;
    name: string;
    timestamp: number;
    thumbnail?: string; // Base64 image
    viewState: {
        zoomLevel: number;
        pan: { x: number, y: number };
        coloringMode: 'type' | 'jurisdiction' | 'status';
        activeFilters?: { region?: string, type?: string, pillarTwo?: string };
        selectedNodeId?: string | null;
    };
}

@Injectable({
    providedIn: 'root'
})
export class SlideDeckService {
    slides = signal<SlideDefinition[]>([]);

    constructor() {
        this.loadFromStorage();
    }

    addSlide(slide: Omit<SlideDefinition, 'id' | 'timestamp'>) {
        const newSlide: SlideDefinition = {
            ...slide,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        };
        this.slides.update(current => [...current, newSlide]);
        this.saveToStorage();
    }

    removeSlide(id: string) {
        this.slides.update(current => current.filter(s => s.id !== id));
        this.saveToStorage();
    }

    getSlide(id: string): SlideDefinition | undefined {
        return this.slides().find(s => s.id === id);
    }

    private saveToStorage() {
        localStorage.setItem('enterprise-slides', JSON.stringify(this.slides()));
    }

    private loadFromStorage() {
        const stored = localStorage.getItem('enterprise-slides');
        if (stored) {
            try {
                this.slides.set(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse slides from storage', e);
            }
        }
    }
}
