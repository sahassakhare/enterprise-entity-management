import { Component, Signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiagramService, DiagramNode } from '../../services/diagram.service';

@Component({
    selector: 'app-side-drawer',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './side-drawer.component.html',
    styleUrls: ['./side-drawer.component.css']
})
export class SideDrawerComponent {
    selectedNode: Signal<DiagramNode | null | undefined>;
    activeTab: 'general' | 'details' | 'officers' | 'compliance' = 'general';
    newOfficerName = '';

    constructor(private diagramService: DiagramService) {
        this.selectedNode = this.diagramService.selectedNode;
    }

    setActiveTab(tab: 'general' | 'details' | 'officers' | 'compliance') {
        this.activeTab = tab;
    }

    updateLabel(event: any) {
        const node = this.selectedNode();
        if (node) {
            this.diagramService.updateNode(node.id, { label: event.target.value });
        }
    }

    updateColor(event: any) {
        const node = this.selectedNode();
        if (node) {
            this.diagramService.updateNode(node.id, { color: event.target.value });
        }
    }

    updateField(field: keyof DiagramNode, value: any) {
        const node = this.selectedNode();
        if (node) {
            this.diagramService.updateNode(node.id, { [field]: value });
        }
    }

    addOfficer() {
        const node = this.selectedNode();
        if (node && this.newOfficerName.trim()) {
            const currentOfficers = node.officers || [];
            this.diagramService.updateNode(node.id, { officers: [...currentOfficers, this.newOfficerName.trim()] });
            this.newOfficerName = '';
        }
    }

    removeOfficer(index: number) {
        const node = this.selectedNode();
        if (node && node.officers) {
            const updated = [...node.officers];
            updated.splice(index, 1);
            this.diagramService.updateNode(node.id, { officers: updated });
        }
    }

    close() {
        this.diagramService.selectNode(null);
    }
}
