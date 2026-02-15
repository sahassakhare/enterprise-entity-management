import { Component, ViewChild, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasComponent } from './components/canvas/canvas.component';
import { SideDrawerComponent } from './components/side-drawer/side-drawer.component';
import { JsonViewerComponent } from './components/json-viewer/json-viewer.component';
import { EntityListComponent } from './components/entity-list/entity-list.component';
import { DiagramService } from './services/diagram.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CanvasComponent, SideDrawerComponent, JsonViewerComponent, EntityListComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  @ViewChild(CanvasComponent) canvasComponent!: CanvasComponent;
  viewMode: Signal<'diagram' | 'list'>;
  coloringMode: Signal<'type' | 'jurisdiction' | 'status'>;
  sandboxMode: Signal<boolean>;

  constructor(private diagramService: DiagramService) {
    this.viewMode = this.diagramService.viewMode;
    this.coloringMode = this.diagramService.coloringMode;
    this.sandboxMode = this.diagramService.sandboxMode;
  }

  toggleViewMode() {
    this.viewMode() === 'diagram'
      ? this.diagramService.viewMode.set('list')
      : this.diagramService.viewMode.set('diagram');
  }

  onColoringModeChange(event: any) {
    this.diagramService.toggleColoringMode(event.target.value);
  }

  toggleSandbox() {
    if (this.sandboxMode()) {
      if (confirm('Exit Sandbox? Unsaved changes will be lost.')) {
        this.diagramService.discardSandbox();
      }
    } else {
      this.diagramService.startSandbox();
    }
  }

  addDraftNode() {
    const newNode = {
      id: 'draft-' + Date.now(),
      label: 'New Draft Entity',
      type: 'Draft',
      isDraft: true,
      jurisdiction: 'Unknown',
      color: '#e0e7ff', // Indigo-100
      dimension: { width: 200, height: 90 }
    };
    this.diagramService.addNode(newNode);
  }

  commitSandbox() {
    if (confirm('Save all sandbox changes to the live chart?')) {
      this.diagramService.commitSandbox();
    }
  }

  discardSandbox() {
    if (confirm('Discard all sandbox experimentations?')) {
      this.diagramService.discardSandbox();
    }
  }

  exportJson() {
    const json = this.diagramService.exportDiagram();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagram.json';
    link.click();
  }

  exportPng() {
    this.canvasComponent.exportToPng();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const json = JSON.parse(e.target.result);
          this.diagramService.loadDiagram(json);
        } catch (err) {
          console.error('Invalid JSON', err);
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  }

  triggerFileInput() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }
}
