import { Component, Signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramService } from '../../services/diagram.service';

@Component({
    selector: 'app-json-viewer',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './json-viewer.component.html',
    styleUrls: ['./json-viewer.component.css']
})
export class JsonViewerComponent {
    jsonContent: Signal<string>;
    isOpen: Signal<boolean>;

    constructor(private diagramService: DiagramService) {
        this.isOpen = this.diagramService.isJsonDrawerOpen;
        this.jsonContent = computed(() => {
            const data = {
                nodes: this.diagramService.nodes(),
                edges: this.diagramService.edges()
            };
            return JSON.stringify(data, null, 2);
        });
    }

    toggle() {
        this.diagramService.isJsonDrawerOpen.update(v => !v);
    }
}
