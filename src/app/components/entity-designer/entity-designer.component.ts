import { Component, Signal, computed, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramService } from '../../services/diagram.service';
import { CanvasComponent } from '../canvas/canvas.component';

@Component({
    selector: 'app-entity-designer',
    standalone: true,
    imports: [CommonModule, CanvasComponent],
    templateUrl: './entity-designer.component.html',
    styleUrls: ['./entity-designer.component.css']
})
export class EntityDesignerComponent implements OnInit {
    @ViewChild(CanvasComponent) canvasComponent!: CanvasComponent;
    dataOverlay: Signal<'TAX' | 'OWNERSHIP'>;
    activeFilters: Signal<{ region?: string, type?: string, pillarTwo?: string }>;

    constructor(private diagramService: DiagramService) {
        this.dataOverlay = this.diagramService.dataOverlay;
        this.activeFilters = this.diagramService.activeFilters;
    }

    ngOnInit() {
        this.loadSampleData();
    }

    setFilter(key: 'region' | 'type' | 'pillarTwo', value: string | undefined) {
        this.diagramService.activeFilters.update(f => ({ ...f, [key]: value }));
    }

    toggleOverlay(mode: 'TAX' | 'OWNERSHIP') {
        this.diagramService.dataOverlay.set(mode);
    }

    loadSampleData() {
        this.diagramService.loadSampleData();
    }

    exportPdf() {
        this.canvasComponent.exportToPdf();
    }

    exportSvg() {
        this.canvasComponent.exportToSvg();
    }
}
