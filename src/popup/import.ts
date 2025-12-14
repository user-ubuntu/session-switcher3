import { MESSAGE_ACTIONS } from "@shared/constants/messages";
import { ChromeApiService } from "./services/chromeApi.service";
import { ExtensionError, handleError } from "@shared/utils/errorHandling";
import { generateId } from "@shared/utils/idGenerator";
import { SessionData } from "@shared/types/session.types";

interface ImportData {
  sessions: SessionData[];
  exportDate: string;
  version: string;
}

interface FileInfo {
  file: File;
  content: string;
  sessions: SessionData[];
  size: string;
}

class ImportController {
  private chromeApi = new ChromeApiService();
  private fileInfo: FileInfo | null = null;
  private isImporting = false;

  // DOM Elements
  private uploadArea: HTMLElement;
  private jsonFileInput: HTMLInputElement;
  private fileInfoDiv: HTMLElement;
  private fileName: HTMLElement;
  private fileSize: HTMLElement;
  private clearFileBtn: HTMLButtonElement;
  private sessionPreview: HTMLElement;
  private previewSessionsList: HTMLElement;
  private importBtn: HTMLButtonElement;
  private backBtn: HTMLButtonElement;
  private statusMessage: HTMLElement;

  constructor() {
    // Get DOM elements
    this.uploadArea = document.getElementById('uploadArea')!;
    this.jsonFileInput = document.getElementById('jsonFileInput') as HTMLInputElement;
    this.fileInfoDiv = document.getElementById('fileInfo')!;
    this.fileName = document.getElementById('fileName')!;
    this.fileSize = document.getElementById('fileSize')!;
    this.clearFileBtn = document.getElementById('clearFileBtn') as HTMLButtonElement;
    this.sessionPreview = document.getElementById('sessionPreview')!;
    this.previewSessionsList = document.getElementById('previewSessionsList')!;
    this.importBtn = document.getElementById('importBtn') as HTMLButtonElement;
    this.backBtn = document.getElementById('backBtn') as HTMLButtonElement;
    this.statusMessage = document.getElementById('statusMessage')!;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // File input change
    this.jsonFileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.handleFileSelect(file);
      }
    });

    // Upload area click
    this.uploadArea.addEventListener('click', () => {
      this.jsonFileInput.click();
    });

    // Drag and drop
    this.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadArea.classList.add('drag-over');
    });

    this.uploadArea.addEventListener('dragleave', () => {
      this.uploadArea.classList.remove('drag-over');
    });

    this.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadArea.classList.remove('drag-over');
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (this.validateFile(file)) {
          this.handleFileSelect(file);
        }
      }
    });

    // Clear file
    this.clearFileBtn.addEventListener('click', () => {
      this.clearFile();
    });

    // Import button
    this.importBtn.addEventListener('click', () => {
      this.handleImport();
    });

    // Back button
    this.backBtn.addEventListener('click', () => {
      this.goBackToExtension();
    });
  }

  private validateFile(file: File): boolean {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      this.showStatus('Please select a JSON file.', 'error');
      return false;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showStatus('File size must be less than 10MB.', 'error');
      return false;
    }

    return true;
  }

  private async handleFileSelect(file: File): Promise<void> {
    if (!this.validateFile(file)) {
      return;
    }

    try {
      this.showStatus('Reading file...', 'loading');
      
      const content = await this.readFile(file);
      const sessions = await this.parseAndValidateSessions(content);
      
      this.fileInfo = {
        file,
        content,
        sessions,
        size: this.formatFileSize(file.size)
      };

      this.displayFileInfo();
      this.showStatus('File loaded successfully.', 'success');
      
    } catch (error) {
      console.error('Error reading file:', error);
      this.showStatus(handleError(error, 'File reading'), 'error');
      this.clearFile();
    }
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      
      reader.onerror = () => {
        reject(new ExtensionError('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }

  private async parseAndValidateSessions(content: string): Promise<SessionData[]> {
    try {
      const importData: ImportData = JSON.parse(content);
      
      if (!importData || !Array.isArray(importData.sessions)) {
        throw new ExtensionError('Invalid import data format');
      }

      const sessions = importData.sessions;
      
      // Validate sessions
      for (const session of sessions) {
        if (!session.id || !session.domain || !session.name) {
          throw new ExtensionError('Invalid session data in import file');
        }
        
        // Validate required properties
        if (!Array.isArray(session.cookies) || 
            typeof session.localStorage !== 'object' || 
            typeof session.sessionStorage !== 'object') {
          throw new ExtensionError('Invalid session data structure');
        }
      }

      // Generate new IDs for duplicate sessions to avoid conflicts
      const existingIds = new Set<string>(); // We'll check this via API call
      const processedSessions = await this.checkForExistingSessions(sessions);
      
      return processedSessions;
    } catch (error) {
      if (error instanceof ExtensionError) {
        throw error;
      }
      throw new ExtensionError('Invalid JSON format or corrupted file');
    }
  }


  private async checkForExistingSessions(sessions: SessionData[]): Promise<SessionData[]> {
    try {
      // For now, we'll generate new IDs for all imported sessions
      // This avoids the tabId: -1 error and ensures no conflicts
      return sessions.map(session => ({
        ...session,
        id: generateId()
      }));
    } catch (error) {
      // If we can't check existing sessions, still generate new IDs
      return sessions.map(session => ({
        ...session,
        id: generateId()
      }));
    }
  }

  private displayFileInfo(): void {
    if (!this.fileInfo) return;

    // Display file info
    this.fileName.textContent = this.fileInfo.file.name;
    this.fileSize.textContent = this.fileInfo.size;

    // Display file info div
    this.fileInfoDiv.style.display = 'block';

    // Display session preview
    this.displaySessionPreview();

    // Enable import button
    this.importBtn.disabled = false;
  }

  private displaySessionPreview(): void {
    if (!this.fileInfo) return;

    // Clear existing content
    this.previewSessionsList.innerHTML = '';

    // Add session items
    this.fileInfo.sessions.forEach(session => {
      const sessionItem = this.createSessionPreviewItem(session);
      this.previewSessionsList.appendChild(sessionItem);
    });

    // Show session preview
    this.sessionPreview.style.display = 'block';
  }

  private createSessionPreviewItem(session: SessionData): HTMLElement {
    const item = document.createElement('div');
    item.className = 'session-item';

    const icon = document.createElement('div');
    icon.className = 'session-icon';
    icon.textContent = '🔗';

    const details = document.createElement('div');
    details.className = 'session-details';

    const name = document.createElement('div');
    name.className = 'session-name';
    name.textContent = session.name;

    const meta = document.createElement('div');
    meta.className = 'session-meta';

    const domainSpan = document.createElement('span');
    domainSpan.textContent = `🌐 ${session.domain}`;

    const cookiesSpan = document.createElement('span');
    cookiesSpan.textContent = `🍪 ${session.cookies.length} cookies`;

    meta.appendChild(domainSpan);
    meta.appendChild(cookiesSpan);

    details.appendChild(name);
    details.appendChild(meta);

    item.appendChild(icon);
    item.appendChild(details);

    return item;
  }

  private async handleImport(): Promise<void> {
    if (!this.fileInfo || this.isImporting) {
      return;
    }

    try {
      this.isImporting = true;
      this.importBtn.disabled = true;
      this.showStatus('Importing sessions...', 'loading');

      // Get import mode
      const importMode = document.querySelector('input[name="importMode"]:checked') as HTMLInputElement;
      const mode = importMode?.value || 'merge';

      // Import sessions
      await this.importSessions(this.fileInfo.content, mode);

      this.showStatus(`Successfully imported ${this.fileInfo.sessions.length} sessions!`, 'success');
      
      // Close tab after successful import
      setTimeout(() => {
        this.goBackToExtension();
      }, 2000);

    } catch (error) {
      console.error('Import error:', error);
      this.showStatus(handleError(error, 'Import sessions'), 'error');
      this.importBtn.disabled = false;
    } finally {
      this.isImporting = false;
    }
  }



  private async importSessions(jsonData: string, mode: string): Promise<void> {
    try {
      const result = await this.chromeApi.getStorageData<{ sessions: SessionData[] }>(['sessions']);
      const currentSessions = result.sessions || [];
      
      const importData = JSON.parse(jsonData);
      
      if (!importData || !Array.isArray(importData.sessions)) {
        throw new ExtensionError("Invalid import data format");
      }

      let importedSessions: SessionData[] = importData.sessions;
      
      // Generate new IDs for all imported sessions to avoid conflicts
      importedSessions = importedSessions.map(session => ({
        ...session,
        id: generateId()
      }));

      // Merge with existing sessions
      const allSessions = [...currentSessions, ...importedSessions];
      
      await this.chromeApi.setStorageData({
        sessions: allSessions
      });

    } catch (error) {
      throw new ExtensionError(handleError(error, "Import sessions"));
    }
  }

  private clearFile(): void {
    this.fileInfo = null;
    this.jsonFileInput.value = '';
    this.fileInfoDiv.style.display = 'none';
    this.sessionPreview.style.display = 'none';
    this.importBtn.disabled = true;
    this.hideStatus();
  }

  private goBackToExtension(): void {
    // Close the import tab and return to the extension
    window.close();
  }

  private showStatus(message: string, type: 'success' | 'error' | 'loading'): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status-message ${type}`;
    this.statusMessage.style.display = 'block';
  }

  private hideStatus(): void {
    this.statusMessage.style.display = 'none';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Import page loaded');
  new ImportController();
});
