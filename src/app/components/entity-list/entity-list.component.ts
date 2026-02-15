import { Component, Signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiagramService, DiagramNode } from '../../services/diagram.service';

@Component({
    selector: 'app-entity-list',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './entity-list.component.html',
    styleUrls: ['./entity-list.component.css']
})
export class EntityListComponent {
    nodes: Signal<DiagramNode[]>;
    searchTerm = '';

    filteredNodes = computed(() => {
        const term = this.searchTerm.toLowerCase();
        return this.nodes().filter(n =>
            n.label.toLowerCase().includes(term) ||
            n.id.toLowerCase().includes(term) ||
            n.jurisdiction?.toLowerCase().includes(term)
        );
    });

    constructor(private diagramService: DiagramService) {
        this.nodes = this.diagramService.nodes;
    }

    selectNode(node: DiagramNode) {
        this.diagramService.selectNode(node.id);
        // Ideally close the list view if it's an overlay
    }

    getComplianceStatus(node: DiagramNode): { label: string, color: string } {
        if (!node.filingDueDate) return { label: 'N/A', color: 'text-gray-400' };

        const today = new Date();
        const dueDate = new Date(node.filingDueDate);
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { label: 'Overdue', color: 'text-red-600 bg-red-50' };
        if (diffDays <= 30) return { label: 'Due Soon', color: 'text-orange-600 bg-orange-50' };
        return { label: 'Good Standing', color: 'text-green-600 bg-green-50' };
    }
}
