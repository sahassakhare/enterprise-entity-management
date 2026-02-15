import { Injectable, signal, computed } from '@angular/core';
import { z } from 'zod';
import { Edge, Node } from '@swimlane/ngx-graph';

// Zod Schemas
export const NodeSchema = z.object({
    id: z.string(),
    label: z.string(),
    color: z.string().optional(),
    type: z.string().optional(),
    // Enterprise Enhancements
    jurisdiction: z.string().optional(),
    taxId: z.string().optional(),
    officers: z.array(z.string()).optional(),
    filingDueDate: z.string().optional(), // ISO Date string
    isDraft: z.boolean().optional(), // Sandbox Mode
});

export const EdgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
    ownershipPercentage: z.number().optional(),
    isDraft: z.boolean().optional(),
});

export const DiagramSchema = z.object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
});

export type DiagramNode = z.infer<typeof NodeSchema> & Node;
export type DiagramEdge = z.infer<typeof EdgeSchema> & Edge;

@Injectable({
    providedIn: 'root'
})
export class DiagramService {
    // State Signals
    readonly nodes = signal<DiagramNode[]>([]);
    readonly edges = signal<DiagramEdge[]>([]);
    readonly selectedNodeId = signal<string | null>(null);
    // View State
    readonly viewMode = signal<'diagram' | 'list'>('diagram');
    readonly coloringMode = signal<'type' | 'jurisdiction' | 'status'>('type');
    readonly highlightedPath = signal<Set<string>>(new Set());

    // Sandbox State
    readonly sandboxMode = signal<boolean>(false);
    private originalState: { nodes: DiagramNode[], edges: DiagramEdge[] } | null = null;

    // Computed
    readonly selectedNode = computed(() =>
        this.nodes().find(n => n.id === this.selectedNodeId()) || null
    );

    constructor() {
        // Load initial sample data for testing
        this.loadSampleData();
    }

    loadDiagram(json: unknown) {
        try {
            const result = DiagramSchema.safeParse(json);
            if (!result.success) {
                console.error('Validation Error:', result.error);
                alert('Invalid JSON format. Please check the console for details.');
                return;
            }

            const data = result.data;
            this.nodes.set(data.nodes.map(n => ({
                ...n,
                label: n.label || n.id,
                dimension: { width: 200, height: 90 }
            }))); // Ensure basics for ngx-graph
            this.edges.set(data.edges);
            this.selectedNodeId.set(null);
            this.highlightedPath.set(new Set());
        } catch (e) {
            console.error('Load Error:', e);
            alert('Failed to load diagram.');
        }
    }

    updateNode(id: string, partial: Partial<DiagramNode>) {
        this.nodes.update(nodes =>
            nodes.map(n => n.id === id ? { ...n, ...partial } : n)
        );
    }

    selectNode(id: string | null) {
        this.selectedNodeId.set(id);
        if (id) {
            this.tracePathToRoot(id);
        } else {
            this.highlightedPath.set(new Set());
        }
    }

    toggleColoringMode(mode: 'type' | 'jurisdiction' | 'status') {
        this.coloringMode.set(mode);
    }

    // Sandbox Methods
    startSandbox() {
        if (this.sandboxMode()) return;
        this.originalState = {
            nodes: JSON.parse(JSON.stringify(this.nodes())),
            edges: JSON.parse(JSON.stringify(this.edges()))
        };
        this.sandboxMode.set(true);
    }

    commitSandbox() {
        if (!this.sandboxMode()) return;
        // Make all draft nodes permanent
        this.nodes.update(nodes => nodes.map(n => ({ ...n, isDraft: false })));
        this.edges.update(edges => edges.map(e => ({ ...e, isDraft: false })));
        this.originalState = null;
        this.sandboxMode.set(false);
    }

    discardSandbox() {
        if (!this.sandboxMode() || !this.originalState) return;
        this.nodes.set(this.originalState.nodes);
        this.edges.set(this.originalState.edges);
        this.originalState = null;
        this.sandboxMode.set(false);
    }

    addNode(node: DiagramNode) {
        node.dimension = { width: 200, height: 90 };
        this.nodes.update(nodes => [...nodes, node]);
    }

    removeNode(id: string) {
        this.nodes.update(nodes => nodes.filter(n => n.id !== id));
        this.edges.update(edges => edges.filter(e => e.source !== id && e.target !== id));
        if (this.selectedNodeId() === id) {
            this.selectedNodeId.set(null);
        }
    }

    private tracePathToRoot(startNodeId: string) {
        const path = new Set<string>();
        const queue = [startNodeId];
        const visited = new Set<string>();
        const edges = this.edges();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            path.add(currentId);

            // Find parents (nodes that target the current node)
            const parentEdges = edges.filter(e => e.target === currentId);
            parentEdges.forEach(e => {
                path.add(e.id); // Add edge to path
                queue.push(e.source);
            });
        }
        this.highlightedPath.set(path);
    }

    exportDiagram(): string {
        const data = {
            nodes: this.nodes(),
            edges: this.edges()
        };
        return JSON.stringify(data, null, 2);
    }

    private loadSampleData() {
        const sample = {
            nodes: [
                // Top Level
                {
                    id: '1',
                    label: 'ICSA Software Group Limited',
                    type: 'Group',
                    color: '#e2e8f0', // Light Grey
                    jurisdiction: 'United Kingdom',
                    officers: ['Board of Directors'],
                    filingDueDate: '2026-12-31'
                },
                // Blue Circles (Subsidiaries)
                {
                    id: '2',
                    label: 'ICSA Euro Ventures (Clone)',
                    type: 'Subsidiary',
                    color: '#bfdbfe', // Light Blue
                    jurisdiction: 'France',
                    officers: ['Jean Pierre'],
                    filingDueDate: '2026-06-30'
                },
                {
                    id: '3',
                    label: 'ICSA Euro Ventures SA',
                    type: 'Subsidiary',
                    color: '#bfdbfe', // Light Blue
                    jurisdiction: 'France',
                    officers: ['Marie Curie'],
                    filingDueDate: '2026-06-30'
                },
                // Pink Rectangles (UK Subsidiaries)
                {
                    id: '4',
                    label: 'ICSA Software (Northern Ireland) Limited',
                    type: 'Limited',
                    color: '#fbcfe8', // Pink
                    jurisdiction: 'United Kingdom',
                    filingDueDate: '2026-09-30'
                },
                {
                    id: '5',
                    label: 'ICSA Software Nominees Limited',
                    type: 'Limited',
                    color: '#fbcfe8', // Pink
                    jurisdiction: 'United Kingdom',
                    filingDueDate: '2026-09-30'
                },
                {
                    id: '6',
                    label: 'ICSA Land Limited',
                    type: 'Limited',
                    color: '#fbcfe8', // Pink
                    jurisdiction: 'Ireland'
                },
                {
                    id: '7',
                    label: 'ICSA Properties (Cheshire) Limited',
                    type: 'Limited',
                    color: '#fbcfe8', // Pink
                    jurisdiction: 'United Kingdom'
                },
                {
                    id: '8',
                    label: 'ICSA Properties (Halifax) Limited',
                    type: 'Limited',
                    color: '#fbcfe8', // Pink
                    jurisdiction: 'United Kingdom'
                },
                {
                    id: '9',
                    label: 'ICSA Properties (Hull) Limited',
                    type: 'Limited',
                    color: '#fbcfe8', // Pink
                    jurisdiction: 'United Kingdom'
                }
            ],
            edges: [
                { id: 'e1', source: '1', target: '2', label: '100%', ownershipPercentage: 100 },
                { id: 'e2', source: '1', target: '3', label: '100%', ownershipPercentage: 100 },
                { id: 'e3', source: '1', target: '4', label: '100%', ownershipPercentage: 100 },
                { id: 'e4', source: '1', target: '5', label: '100%', ownershipPercentage: 100 },
                { id: 'e5', source: '1', target: '6', label: '1%', ownershipPercentage: 1 },
                { id: 'e6', source: '1', target: '7', label: '50%', ownershipPercentage: 50 },
                { id: 'e7', source: '1', target: '8', label: '0%', ownershipPercentage: 0 },
                { id: 'e8', source: '1', target: '9', label: '0%', ownershipPercentage: 0 }
            ]
        };
        this.loadDiagram(sample);
    }
}
