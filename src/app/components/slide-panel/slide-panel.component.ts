import { Component, Signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlideDeckService, SlideDefinition } from '../../services/slide-deck.service';
import { ThemeService, Theme } from '../../services/theme.service';
import { DiagramService } from '../../services/diagram.service';
import { CanvasComponent } from '../canvas/canvas.component';

@Component({
    selector: 'app-slide-panel',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './slide-panel.component.html',
    styleUrls: ['./slide-panel.component.css']
})
export class SlidePanelComponent {
    slides: Signal<SlideDefinition[]>;
    activeTheme: Signal<Theme>;

    // Reference to canvas for capturing state (will be passed via input or service in real app, 
    // but for now we might need a more direct way or use the service to mediate)

    constructor(
        private slideService: SlideDeckService,
        private themeService: ThemeService,
        private diagramService: DiagramService
    ) {
        this.slides = this.slideService.slides;
        this.activeTheme = this.themeService.activeTheme;
    }

    setTheme(theme: Theme) {
        this.themeService.setTheme(theme);
    }

    restoreSlide(slide: SlideDefinition) {
        // 1. Restore Diagram Filters & Mode
        if (slide.viewState.activeFilters) {
            // this.diagramService.setFilters(slide.viewState.activeFilters); // Need to implement this method in service
            // For now, manually setting signals if public, or added method
        }
        this.diagramService.coloringMode.set(slide.viewState.coloringMode);
        this.diagramService.selectedNodeId.set(slide.viewState.selectedNodeId || null);

        // 2. Restore Zoom/Pan (This needs coordination with CanvasComponent)
        // We will emit an event or use a shared service signal that Canvas listens to
        this.diagramService.restoreViewState.set(slide.viewState);
    }

    deleteSlide(event: Event, id: string) {
        event.stopPropagation();
        if (confirm('Delete this slide?')) {
            this.slideService.removeSlide(id);
        }
    }

    // Capture logic will be triggered from here but needs access to Canvas to get the specific state
    // We'll use a signal in DiagramService to request a capture
    captureSlide() {
        const name = prompt('Name this slide:', `Slide ${this.slides().length + 1}`);
        if (name) {
            this.diagramService.requestCapture.set(name);
        }
    }

    async exportToPdf() {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const slides = this.slides();
        if (slides.length === 0) {
            alert('No slides to export.');
            return;
        }

        slides.forEach((slide, index) => {
            if (index > 0) doc.addPage();

            // Header
            doc.setFontSize(16);
            doc.setTextColor(40);
            doc.text(slide.name, 10, 15);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Captured: ${new Date(slide.timestamp).toLocaleString()}`, 10, 22);

            // Thumbnail
            if (slide.thumbnail) {
                try {
                    // Fit image to page (A4 landscape is ~297mm width)
                    const imgProps = doc.getImageProperties(slide.thumbnail);
                    const pdfWidth = 277; // 10mm margin each side
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    doc.addImage(slide.thumbnail, 'PNG', 10, 30, pdfWidth, pdfHeight);
                } catch (e) {
                    console.error('Error adding image to PDF', e);
                    doc.text('(Image Error)', 10, 40);
                }
            } else {
                doc.text('(No Thumbnail Available)', 10, 40);
            }

            // Footer / Metadata
            const mode = slide.viewState.coloringMode.toUpperCase();
            const filterCount = Object.values(slide.viewState.activeFilters || {}).filter(Boolean).length;
            doc.setFontSize(8);
            doc.text(`View Mode: ${mode} | Active Filters: ${filterCount}`, 10, 190);
        });

        doc.save('Enterprise_Entity_Slides.pdf');
    }
}
