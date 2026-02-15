import { Component, Signal, HostListener, ElementRef, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxGraphModule, Node, Edge } from '@swimlane/ngx-graph';
import { DiagramService, DiagramNode, DiagramEdge } from '../../services/diagram.service';
import { curveBundle } from 'd3-shape';
import { toPng } from 'html-to-image';

@Component({
    selector: 'app-canvas',
    standalone: true,
    imports: [CommonModule, NgxGraphModule],
    templateUrl: './canvas.component.html',
    styleUrls: ['./canvas.component.css']
})
export class CanvasComponent {
    nodes: Signal<DiagramNode[]>;
    edges: Signal<DiagramEdge[]>;
    selectedNodeId: Signal<string | null>;
    highlightedPath: Signal<Set<string>>;
    coloringMode: Signal<'type' | 'jurisdiction' | 'status'>;
    sandboxMode: Signal<boolean>;

    // Computed Legend
    dynamicLegend: Signal<{ label: string, color: string }[]>;

    // ngx-graph settings
    layoutSettings = {
        orientation: 'TB',
        marginX: 50,
        marginY: 50,
        edgePadding: 100,
        rankPadding: 150,
        nodePadding: 80
    };
    curve: any = curveBundle;
    @ViewChild('canvasContainer') canvasContainer!: ElementRef;
    view: [number, number] = [800, 600]; // Default fallback
    private resizeObserver: ResizeObserver | undefined;

    constructor(private diagramService: DiagramService) {
        this.nodes = this.diagramService.nodes;
        this.edges = this.diagramService.edges;
        this.selectedNodeId = this.diagramService.selectedNodeId;
        this.highlightedPath = this.diagramService.highlightedPath;
        this.coloringMode = this.diagramService.coloringMode;
        this.sandboxMode = this.diagramService.sandboxMode;

        // Compute Legend based on current nodes and coloring mode
        this.dynamicLegend = computed(() => {
            const mode = this.coloringMode();
            const nodes = this.nodes();
            const map = new Map<string, string>();

            nodes.forEach(node => {
                const color = this.getNodeColor(node);
                const label = this.getLegendLabel(node, mode);
                map.set(label, color);
            });

            return Array.from(map.entries()).map(([label, color]) => ({ label, color }));
        });
    }

    ngAfterViewInit() {
        // Immediate calculation attempt
        this.updateDimensions();

        // ResizeObserver for ongoing updates
        if (this.canvasContainer) {
            this.resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    // Only update if dimensions are valid and changed
                    if (width > 0 && height > 0 && (width !== this.view[0] || height !== this.view[1])) {
                        this.view = [width, height];
                        console.log('Canvas resized:', width, height);
                    }
                }
            });
            this.resizeObserver.observe(this.canvasContainer.nativeElement);
        }
    }

    updateDimensions() {
        if (this.canvasContainer) {
            const { width, height } = this.canvasContainer.nativeElement.getBoundingClientRect();
            if (width > 0 && height > 0) {
                this.view = [width, height];
            }
        }
    }

    ngOnDestroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }

    getLegendLabel(node: DiagramNode, mode: 'type' | 'jurisdiction' | 'status'): string {
        switch (mode) {
            case 'type': return node.type || 'Unknown';
            case 'jurisdiction': return node.jurisdiction || 'Unknown';
            case 'status':
                const color = this.getComplianceStatusColor(node);
                if (color === '#10b981') return 'Good Standing';
                if (color === '#f59e0b') return 'Due Soon';
                if (color === '#ef4444') return 'Overdue';
                return 'N/A';
        }
    }

    getNodeColor(node: DiagramNode): string {
        const mode = this.coloringMode();
        switch (mode) {
            case 'type': return node.color || '#ccc';
            case 'jurisdiction':
                // Simple hash for demo
                const j = node.jurisdiction || '';
                if (j === 'United Kingdom') return '#fbcfe8';
                if (j === 'France') return '#bfdbfe';
                if (j === 'Ireland') return '#bbf7d0';
                if (j === 'Delaware') return '#ddd6fe';
                return '#e2e8f0';
            case 'status': return this.getComplianceStatusColor(node);
        }
    }


    onNodeClick(node: Node) {
        this.diagramService.selectNode(node.id);
    }

    onCanvasClick() {
        this.diagramService.selectNode(null);
    }

    exportToPng() {
        if (this.canvasContainer) {
            toPng(this.canvasContainer.nativeElement)
                .then((dataUrl) => {
                    const link = document.createElement('a');
                    link.download = 'diagram.png';
                    link.href = dataUrl;
                    link.click();
                })
                .catch((err) => {
                    console.error('Could not export PNG', err);
                });
        }
    }

    getComplianceStatusColor(node: DiagramNode): string {
        if (!node.filingDueDate) return 'transparent';

        const today = new Date();
        const dueDate = new Date(node.filingDueDate);
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return '#ef4444'; // Red (Overdue)
        if (diffDays <= 30) return '#f59e0b'; // Orange (Due Soon)
        return '#10b981'; // Green (Good Standing)
    }
}
