import { Component, Signal, HostListener, ElementRef, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxGraphModule, Node, Edge } from '@swimlane/ngx-graph';
import { DiagramService, DiagramNode, DiagramEdge } from '../../services/diagram.service';
import { curveBundle } from 'd3-shape';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

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
    dataOverlay: Signal<'TAX' | 'OWNERSHIP'>;

    // Zoom State
    zoomLevel = signal<number>(1.0);
    minZoom = 0.1;
    maxZoom = 4.0;
    autoZoom = signal<boolean>(true); // Start with auto-zoom enabled

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
        this.nodes = this.diagramService.filteredNodes;
        this.edges = this.diagramService.edges;
        this.selectedNodeId = this.diagramService.selectedNodeId;
        this.highlightedPath = this.diagramService.highlightedPath;
        this.coloringMode = this.diagramService.coloringMode;
        this.sandboxMode = this.diagramService.sandboxMode;
        this.dataOverlay = this.diagramService.dataOverlay;

        // Compute Legend based on current nodes and coloring mode
        this.dynamicLegend = computed(() => {
            const mode = this.coloringMode();
            const nodes = this.nodes();
            const map = new Map<string, string>();

            nodes.forEach(node => {
                const label = this.getLegendLabel(node, mode);
                const color = this.getNodeColor(node);
                if (label && !map.has(label)) {
                    map.set(label, color);
                }
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
            case 'type': return node.entityType || 'Unknown';
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
            case 'type':
                const type = (node.entityType || '').toLowerCase();
                if (type.includes('holding') || type.includes('group')) return '#1e40af'; // Sapphire Blue
                if (type.includes('subsidiary') || type.includes('ops')) return '#059669'; // Emerald Green
                if (type.includes('trust')) return '#7c3aed'; // Royal Purple
                if (type.includes('limited')) return '#be185d'; // Ruby Pink
                if (type.includes('branch')) return '#d97706'; // Amber Gold
                if (type.includes('shell')) return '#4b5563'; // Slate Grey
                return node.color || '#94a3b8';
            case 'jurisdiction':
                const j = node.jurisdiction || '';
                if (j === 'United Kingdom') return '#fbcfe8';
                if (j === 'France') return '#bfdbfe';
                if (j === 'Ireland') return '#bbf7d0';
                if (j === 'USA' || j === 'Delaware') return '#ddd6fe';
                return '#e2e8f0';
            case 'status': return this.getComplianceStatusColor(node);
        }
    }

    // Zoom Methods
    zoomIn() {
        this.autoZoom.set(false); // Disable auto-zoom to allow manual control
        this.zoomLevel.update((z: number) => Math.min(z + 0.1, this.maxZoom));
    }

    zoomOut() {
        this.autoZoom.set(false); // Disable auto-zoom to allow manual control
        this.zoomLevel.update((z: number) => Math.max(z - 0.1, this.minZoom));
    }

    resetZoom() {
        this.autoZoom.set(true); // Re-enable auto-zoom to fit to screen
        this.zoomLevel.set(1.0);
    }


    onNodeClick(node: Node) {
        this.diagramService.selectNode(node.id);
    }

    onCanvasClick() {
        this.diagramService.selectNode(null);
    }

    exportToPng() {
        if (this.canvasContainer) {
            toPng(this.canvasContainer.nativeElement, { pixelRatio: 2 }) // Higher resolution
                .then((dataUrl) => {
                    const link = document.createElement('a');
                    link.download = 'entity-hierarchy.png';
                    link.href = dataUrl;
                    link.click();
                })
                .catch((err) => {
                    console.error('Could not export PNG', err);
                });
        }
    }

    exportToSvg() {
        if (this.canvasContainer) {
            const svgElement = this.canvasContainer.nativeElement.querySelector('svg');
            if (svgElement) {
                const serializer = new XMLSerializer();
                let source = serializer.serializeToString(svgElement);
                // Add name spaces
                if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
                    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                if (!source.match(/^<svg[^>]+xmlns\:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
                    source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
                }
                // Add xml declaration
                source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

                const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
                const link = document.createElement('a');
                link.download = 'entity-hierarchy.svg';
                link.href = url;
                link.click();
            }
        }
    }

    exportToPdf() {
        if (this.canvasContainer) {
            toPng(this.canvasContainer.nativeElement, { pixelRatio: 3 }) // Ultra high res for PDF
                .then((dataUrl) => {
                    const pdf = new jsPDF({
                        orientation: 'landscape',
                        unit: 'px',
                        format: [this.view[0], this.view[1]]
                    });
                    pdf.addImage(dataUrl, 'PNG', 0, 0, this.view[0], this.view[1]);
                    pdf.save('entity-hierarchy.pdf');
                })
                .catch((err) => {
                    console.error('Could not export PDF', err);
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

    getStatusColor(node: DiagramNode): string {
        switch (node.status) {
            case 'Active': return '#10b981'; // Green
            case 'Liquidation': return '#ef4444'; // Red
            case 'Acquisition': return '#f59e0b'; // Amber
            default: return 'transparent';
        }
    }
}
