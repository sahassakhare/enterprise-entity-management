import { Injectable, signal, computed } from '@angular/core';
import { z } from 'zod';
import { Edge, Node } from '@swimlane/ngx-graph';

// Zod Schemas
export const NodeSchema = z.object({
    id: z.string(),
    label: z.string(),
    color: z.string().optional(),
    entityType: z.string().optional(),
    // Enterprise Enhancements
    jurisdiction: z.string().optional(),
    taxId: z.string().optional(),
    officers: z.array(z.string()).optional(),
    filingDueDate: z.string().optional(), // ISO Date string
    isDraft: z.boolean().optional(), // Sandbox Mode
    // Enterprise Specific
    taxResidency: z.string().optional(),
    localCurrency: z.string().optional(),
    citRate: z.number().optional(),
    effectiveOwnership: z.number().optional(),
    status: z.enum(['Active', 'Liquidation', 'Acquisition']).optional(),
    region: z.string().optional(),
    pillarTwoStatus: z.enum(['In-Scope', 'Excluded', 'Safe-Harbor', 'Pending', 'N/A']).optional(),
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
    readonly viewMode = signal<'diagram' | 'list' | 'designer'>('designer');
    readonly coloringMode = signal<'type' | 'jurisdiction' | 'status'>('type');
    readonly highlightedPath = signal<Set<string>>(new Set());
    // Enterprise Overlays
    readonly dataOverlay = signal<'TAX' | 'OWNERSHIP'>('OWNERSHIP');
    readonly isJsonDrawerOpen = signal<boolean>(false);
    readonly activeFilters = signal<{ region?: string, type?: string, pillarTwo?: string }>({});

    // View State Capture
    readonly requestCapture = signal<string | null>(null);
    readonly restoreViewState = signal<any>(null);

    // Sandbox State
    readonly sandboxMode = signal<boolean>(false);
    private originalState: { nodes: DiagramNode[], edges: DiagramEdge[] } | null = null;

    // Computed
    readonly selectedNode = computed(() =>
        this.nodes().find(n => n.id === this.selectedNodeId()) || null
    );

    readonly filteredNodes = computed(() => {
        const filters = this.activeFilters();
        return this.nodes().filter(node => {
            const regionMatch = !filters.region || node.region === filters.region;
            const typeMatch = !filters.type || node.entityType === filters.type;
            const pillarMatch = !filters.pillarTwo || node.pillarTwoStatus === filters.pillarTwo;
            return regionMatch && typeMatch && pillarMatch;
        });
    });

    readonly filteredEdges = computed(() => {
        const visibleNodeIds = new Set(this.filteredNodes().map(n => n.id));
        return this.edges().filter(edge =>
            visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
        );
    });

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

    // Enterprise Hierarchy Transformation Logic
    loadFlatEntityList(entities: any[]) {
        const nodes: DiagramNode[] = [];
        const edges: DiagramEdge[] = [];

        // 1. Map to nodes
        entities.forEach(ent => {
            nodes.push({
                ...ent,
                dimension: { width: 220, height: 100 }
            });

            // 2. Create edges if parentId exists
            if (ent.parentId) {
                edges.push({
                    id: `e-${ent.parentId}-${ent.id}`,
                    source: ent.parentId,
                    target: ent.id,
                    label: `${ent.ownershipPercentage}%`,
                    ownershipPercentage: ent.ownershipPercentage
                });
            }
        });

        // 3. Calculate Effective Ownership
        this.calculateEffectiveOwnership(nodes, edges);

        this.nodes.set(nodes);
        this.edges.set(edges);
    }

    private calculateEffectiveOwnership(nodes: DiagramNode[], edges: DiagramEdge[]) {
        // Simple recursive calculation for effective ownership
        // Find roots (nodes with no parents)
        const roots = nodes.filter(n => !edges.some(e => e.target === n.id));

        roots.forEach(root => {
            root.effectiveOwnership = 100;
            this.propagateOwnership(root.id, 100, nodes, edges);
        });
    }

    private propagateOwnership(parentId: string, parentEffective: number, nodes: DiagramNode[], edges: DiagramEdge[]) {
        const childrenEdges = edges.filter(e => e.source === parentId);
        childrenEdges.forEach(edge => {
            const childNode = nodes.find(n => n.id === edge.target);
            if (childNode) {
                const directStake = edge.ownershipPercentage || 0;
                const effectiveStake = (parentEffective * directStake) / 100;
                childNode.effectiveOwnership = (childNode.effectiveOwnership || 0) + effectiveStake;
                this.propagateOwnership(childNode.id, effectiveStake, nodes, edges);
            }
        });
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

    public loadSampleData() {
        const sampleNodes = [
            // Level 1: Global Holding (USA)
            { id: 'G1', label: 'Enterprise Global Holdings Inc.', entityType: 'Holding', taxResidency: 'USA', localCurrency: 'USD', pillarTwoStatus: 'In-Scope', citRate: 21, status: 'Active', ownershipPercentage: 100, region: 'Americas' },

            // Level 2: Regional Hubs
            { id: 'G2', parentId: 'G1', label: 'Enterprise EMEA Hub S.a.r.l.', entityType: 'Holding', taxResidency: 'Luxembourg', localCurrency: 'EUR', pillarTwoStatus: 'In-Scope', citRate: 24.9, status: 'Active', ownershipPercentage: 100, region: 'EMEA' },
            { id: 'G3', parentId: 'G1', label: 'Enterprise APAC Pte Ltd.', entityType: 'Holding', taxResidency: 'Singapore', localCurrency: 'SGD', pillarTwoStatus: 'Safe-Harbor', citRate: 17, status: 'Active', ownershipPercentage: 100, region: 'APAC' },

            // Level 3: EMEA Operations
            { id: 'G4', parentId: 'G2', label: 'Enterprise Tech Ireland', entityType: 'Subsidiary', taxResidency: 'Ireland', localCurrency: 'EUR', pillarTwoStatus: 'In-Scope', citRate: 12.5, status: 'Active', ownershipPercentage: 100, region: 'EMEA' },
            { id: 'G5', parentId: 'G2', label: 'Enterprise DE Ops GmbH', entityType: 'Subsidiary', taxResidency: 'Germany', localCurrency: 'EUR', pillarTwoStatus: 'In-Scope', citRate: 30, status: 'Active', ownershipPercentage: 90, region: 'EMEA' },
            { id: 'G6', parentId: 'G2', label: 'Enterprise FR Trust', entityType: 'Trust', taxResidency: 'France', localCurrency: 'EUR', pillarTwoStatus: 'Excluded', citRate: 25, status: 'Active', ownershipPercentage: 100, region: 'EMEA' },

            // Level 3: APAC Operations
            { id: 'G7', parentId: 'G3', label: 'Enterprise AU Pty Ltd', entityType: 'Subsidiary', taxResidency: 'Australia', localCurrency: 'AUD', pillarTwoStatus: 'Safe-Harbor', citRate: 30, status: 'Active', ownershipPercentage: 80, region: 'APAC' },
            { id: 'G8', parentId: 'G3', label: 'Enterprise CN Manufacturing', entityType: 'Subsidiary', taxResidency: 'China', localCurrency: 'CNY', pillarTwoStatus: 'In-Scope', citRate: 25, status: 'Active', ownershipPercentage: 100, region: 'APAC' },

            // Level 4: Complex Indirects & Special Cases
            { id: 'G9', parentId: 'G4', label: 'Enterprise UK Innovation', entityType: 'Limited', taxResidency: 'United Kingdom', localCurrency: 'GBP', pillarTwoStatus: 'Pending', citRate: 25, status: 'Acquisition', ownershipPercentage: 50, region: 'EMEA' },
            { id: 'G10', parentId: 'G9', label: 'Enterprise IP Labs', entityType: 'Shell', taxResidency: 'Cayman Islands', localCurrency: 'USD', pillarTwoStatus: 'N/A', citRate: 0, status: 'Liquidation', ownershipPercentage: 100, region: 'EMEA' },
            { id: 'G11', parentId: 'G5', label: 'Berlin Logistics J.V.', entityType: 'Subsidiary', taxResidency: 'Germany', localCurrency: 'EUR', pillarTwoStatus: 'In-Scope', citRate: 30, status: 'Active', ownershipPercentage: 49, region: 'EMEA' },
            { id: 'G12', parentId: 'G8', label: 'H.K. Trading Port', entityType: 'Branch', taxResidency: 'Hong Kong', localCurrency: 'HKD', pillarTwoStatus: 'Excluded', citRate: 16.5, status: 'Active', ownershipPercentage: 100, region: 'APAC' },

            // Level 5: Deep Tier
            { id: 'G13', parentId: 'G10', label: 'Legacy Asset Pool', entityType: 'Trust', taxResidency: 'Bermuda', localCurrency: 'USD', pillarTwoStatus: 'Excluded', citRate: 0, status: 'Liquidation', ownershipPercentage: 100, region: 'EMEA' },
            { id: 'G14', parentId: 'G7', label: 'Sydney Sales Branch', entityType: 'Branch', taxResidency: 'Australia', localCurrency: 'AUD', pillarTwoStatus: 'Safe-Harbor', citRate: 30, status: 'Active', ownershipPercentage: 100, region: 'APAC' },
            { id: 'G15', parentId: 'G1', label: 'Enterprise LatAm Assets', entityType: 'Holding', taxResidency: 'Brazil', localCurrency: 'BRL', pillarTwoStatus: 'Pending', citRate: 34, status: 'Active', ownershipPercentage: 100, region: 'Americas' }
        ];
        this.loadFlatEntityList(sampleNodes);
    }
}
