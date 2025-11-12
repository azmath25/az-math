// js/edit-problem-utils.js
// Utility classes for edit-problem.js - handles block management, auto-save, and validation

import { doc, setDoc } from "./firebase.js";

/**
 * BlockRegistry - Centralized block management with automatic cleanup
 * Prevents memory leaks and provides fallback content retrieval
 */
export class BlockRegistry {
  constructor() {
    this.blocks = new Map(); // blockId -> { element, rte, type, data }
  }

  /**
   * Register a new block
   */
  register(blockId, blockData) {
    this.blocks.set(blockId, blockData);
    console.log(`[BlockRegistry] Registered block: ${blockId}, type: ${blockData.type}`);
  }

  /**
   * Get block by ID
   */
  get(blockId) {
    return this.blocks.get(blockId);
  }

  /**
   * Check if block exists
   */
  has(blockId) {
    return this.blocks.has(blockId);
  }

  /**
   * Remove block and cleanup RTE instance
   */
  remove(blockId) {
    const block = this.blocks.get(blockId);
    if (block?.rte) {
      try {
        block.rte.destroy();
        console.log(`[BlockRegistry] Destroyed RTE for block: ${blockId}`);
      } catch (err) {
        console.warn(`[BlockRegistry] Error destroying RTE for ${blockId}:`, err);
      }
    }
    this.blocks.delete(blockId);
  }

  /**
   * Get content from block with fallback strategies
   */
  getContent(blockId) {
    const block = this.blocks.get(blockId);
    if (!block) {
      console.warn(`[BlockRegistry] Block not found: ${blockId}`);
      return null;
    }

    // Strategy 1: Get from RTE instance
    if (block.rte) {
      try {
        const content = block.rte.getContent();
        console.log(`[BlockRegistry] Got content from RTE for ${blockId}, length: ${content.length}`);
        return content;
      } catch (err) {
        console.warn(`[BlockRegistry] Error getting RTE content for ${blockId}:`, err);
      }
    }

    // Strategy 2: Get from DOM directly
    if (block.element) {
      const editor = block.element.querySelector('.rte-editor');
      if (editor) {
        const content = editor.innerHTML;
        console.log(`[BlockRegistry] Got content from DOM for ${blockId}, length: ${content.length}`);
        return content;
      }
    }

    console.warn(`[BlockRegistry] No content retrieval method available for ${blockId}`);
    return null;
  }

  /**
   * Get all blocks from a container in order
   */
  getAllBlocks(container) {
    const blocks = [];
    const blockElements = container.querySelectorAll('.block-editor');
    
    console.log(`[BlockRegistry] Gathering ${blockElements.length} blocks from container`);
    
    blockElements.forEach((blockEl, index) => {
      const blockId = blockEl.dataset.blockId;
      const block = this.get(blockId);
      
      if (block) {
        const blockData = this.extractBlockData(block);
        if (blockData && this.isBlockValid(blockData)) {
          blocks.push(blockData);
        } else {
          console.warn(`[BlockRegistry] Invalid or empty block at index ${index}, blockId: ${blockId}`);
        }
      } else {
        console.warn(`[BlockRegistry] Block not in registry at index ${index}, blockId: ${blockId}`);
        // Fallback: try to extract from DOM
        const fallbackData = this.extractFromDOM(blockEl);
        if (fallbackData && this.isBlockValid(fallbackData)) {
          blocks.push(fallbackData);
          console.log(`[BlockRegistry] Recovered block from DOM at index ${index}`);
        }
      }
    });
    
    console.log(`[BlockRegistry] Successfully gathered ${blocks.length} valid blocks`);
    return blocks;
  }

  /**
   * Extract block data based on type
   */
  extractBlockData(block) {
    const blockId = block.element?.dataset.blockId;
    
    try {
      switch (block.type) {
        case 'text':
          const content = this.getContent(blockId);
          return { type: 'text', content: content || '' };
        
        case 'image':
          const urlInput = block.element.querySelector('.image-url-input');
          return { type: 'image', url: urlInput?.value || '' };
        
        case 'problem':
          const problemInput = block.element.querySelector('.block-input');
          return { type: 'problem', problemId: problemInput?.value || '' };
        
        case 'lesson':
          const lessonInput = block.element.querySelector('.block-input');
          return { type: 'lesson', lessonId: lessonInput?.value || '' };
        
        default:
          console.warn(`[BlockRegistry] Unknown block type: ${block.type}`);
          return null;
      }
    } catch (err) {
      console.error(`[BlockRegistry] Error extracting block data for ${blockId}:`, err);
      return null;
    }
  }

  /**
   * Fallback: Extract block data directly from DOM element
   */
  extractFromDOM(blockEl) {
    const header = blockEl.querySelector('.block-header span')?.textContent || '';
    
    if (header.includes('Text')) {
      const editor = blockEl.querySelector('.rte-editor');
      return { type: 'text', content: editor?.innerHTML || '' };
    } else if (header.includes('Image')) {
      const input = blockEl.querySelector('.image-url-input, .block-input');
      return { type: 'image', url: input?.value || '' };
    } else if (header.includes('Problem')) {
      const input = blockEl.querySelector('.block-input');
      return { type: 'problem', problemId: input?.value || '' };
    } else if (header.includes('Lesson')) {
      const input = blockEl.querySelector('.block-input');
      return { type: 'lesson', lessonId: input?.value || '' };
    }
    
    return null;
  }

  /**
   * Validate that a block has meaningful content
   */
  isBlockValid(block) {
    if (!block) return false;

    switch (block.type) {
      case 'text':
        const stripped = block.content.replace(/<[^>]*>/g, '').trim();
        return stripped.length > 0;
      
      case 'image':
        return block.url && block.url.trim().length > 0;
      
      case 'problem':
        return block.problemId && block.problemId.trim().length > 0;
      
      case 'lesson':
        return block.lessonId && block.lessonId.trim().length > 0;
      
      default:
        return false;
    }
  }

  /**
   * Clear all blocks (for cleanup)
   */
  clear() {
    this.blocks.forEach((block, blockId) => {
      if (block.rte) {
        try {
          block.rte.destroy();
        } catch (err) {
          console.warn(`Error destroying RTE for ${blockId}:`, err);
        }
      }
    });
    this.blocks.clear();
    console.log('[BlockRegistry] Cleared all blocks');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this.blocks.size,
      byType: Array.from(this.blocks.values()).reduce((acc, block) => {
        acc[block.type] = (acc[block.type] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

/**
 * AutoSaver - Automatic draft saving to localStorage
 */
export class AutoSaver {
  constructor(problemId, interval = 30000) {
    this.problemId = problemId;
    this.interval = interval;
    this.timerId = null;
    this.storageKey = `draft_problem_${problemId || 'new'}`;
    this.lastSaveTime = null;
  }

  /**
   * Start auto-saving
   */
  start(getDataFn) {
    this.stop(); // Clear any existing timer
    
    console.log(`[AutoSaver] Started for problem ${this.problemId}, interval: ${this.interval}ms`);
    
    this.timerId = setInterval(() => {
      try {
        const data = getDataFn();
        this.saveDraft(data);
      } catch (err) {
        console.error('[AutoSaver] Error during auto-save:', err);
      }
    }, this.interval);
  }

  /**
   * Stop auto-saving
   */
  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.log('[AutoSaver] Stopped');
    }
  }

  /**
   * Save draft to localStorage
   */
  saveDraft(data) {
    try {
      const draft = {
        data,
        timestamp: Date.now(),
        version: 1
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(draft));
      this.lastSaveTime = Date.now();
      
      this.showAutoSaveIndicator();
      console.log('[AutoSaver] Draft saved successfully');
      
    } catch (err) {
      console.warn('[AutoSaver] Failed to save draft:', err);
      
      // Handle quota exceeded
      if (err.name === 'QuotaExceededError') {
        this.clearOldDrafts();
      }
    }
  }

  /**
   * Load draft from localStorage
   */
  loadDraft() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const draft = JSON.parse(saved);
        console.log('[AutoSaver] Draft loaded, timestamp:', new Date(draft.timestamp).toLocaleString());
        return draft;
      }
    } catch (err) {
      console.warn('[AutoSaver] Failed to load draft:', err);
    }
    return null;
  }

  /**
   * Check if draft exists and is newer than server version
   */
  hasDraft() {
    const draft = this.loadDraft();
    return draft !== null;
  }

  /**
   * Get draft age in milliseconds
   */
  getDraftAge() {
    const draft = this.loadDraft();
    if (draft) {
      return Date.now() - draft.timestamp;
    }
    return null;
  }

  /**
   * Format draft age for display
   */
  formatDraftAge() {
    const age = this.getDraftAge();
    if (!age) return null;

    const minutes = Math.floor(age / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  }

  /**
   * Clear draft from localStorage
   */
  clearDraft() {
    localStorage.removeItem(this.storageKey);
    console.log('[AutoSaver] Draft cleared');
  }

  /**
   * Clear old drafts to free space
   */
  clearOldDrafts() {
    const keys = Object.keys(localStorage);
    const draftKeys = keys.filter(k => k.startsWith('draft_problem_'));
    
    // Sort by age and remove oldest
    const drafts = draftKeys.map(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        return { key, timestamp: data.timestamp };
      } catch {
        return { key, timestamp: 0 };
      }
    }).sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest half
    const toRemove = Math.ceil(drafts.length / 2);
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(drafts[i].key);
    }
    
    console.log(`[AutoSaver] Cleared ${toRemove} old drafts`);
  }

  /**
   * Show auto-save indicator
   */
  showAutoSaveIndicator() {
    const indicator = document.getElementById('autosave-indicator');
    if (!indicator) return;

    indicator.textContent = '✓ Auto-saved';
    indicator.style.opacity = '1';
    indicator.style.color = '#10b981';

    setTimeout(() => {
      indicator.style.opacity = '0';
    }, 2000);
  }
}

/**
 * ProblemValidator - Validates problem data before save
 */
export class ProblemValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate problem data
   */
  validate(data) {
    this.errors = [];
    this.warnings = [];

    this.validateId(data.id);
    this.validateTitle(data.title);
    this.validateCategory(data.category);
    this.validateDifficulty(data.difficulty);
    this.validateStatement(data.statement);
    this.validateSolutions(data.solutions);
    this.validateTags(data.tags);
    this.validateImageUrls(data);

    return this.errors.length === 0;
  }

  /**
   * Validate problem ID
   */
  validateId(id) {
    if (!id) {
      this.errors.push('Problem ID is required');
      return;
    }

    const numId = parseInt(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      this.errors.push('Problem ID must be a positive integer');
    }
  }

  /**
   * Validate title
   */
  validateTitle(title) {
    if (title && title.length > 200) {
      this.warnings.push('Title is very long (>200 characters)');
    }
  }

  /**
   * Validate category
   */
  validateCategory(category) {
    if (!category || category.trim() === '') {
      this.errors.push('Please select a category');
    }
  }

  /**
   * Validate difficulty
   */
  validateDifficulty(difficulty) {
    const validDifficulties = ['Easy', 'Medium', 'Hard'];
    if (!validDifficulties.includes(difficulty)) {
      this.errors.push('Please select a valid difficulty level');
    }
  }

  /**
   * Validate statement blocks
   */
  validateStatement(statement) {
    if (!statement || statement.length === 0) {
      this.errors.push('Problem statement cannot be empty');
      return;
    }

    // Check if at least one block has content
    const hasContent = statement.some(block => {
      if (block.type === 'text') {
        const stripped = block.content.replace(/<[^>]*>/g, '').trim();
        return stripped.length > 0;
      }
      return block.url || block.problemId || block.lessonId;
    });

    if (!hasContent) {
      this.errors.push('Problem statement must have at least one non-empty block');
    }

    // Validate individual blocks
    statement.forEach((block, idx) => {
      if (block.type === 'text') {
        const stripped = block.content.replace(/<[^>]*>/g, '').trim();
        if (stripped.length === 0) {
          this.warnings.push(`Statement block ${idx + 1} is empty`);
        }
      } else if (block.type === 'image' && block.url) {
        if (!this.isValidUrl(block.url)) {
          this.errors.push(`Statement block ${idx + 1}: Invalid image URL`);
        }
      }
    });
  }

  /**
   * Validate solutions
   */
  validateSolutions(solutions) {
    if (!solutions || solutions.length === 0) {
      this.warnings.push('Problem has no solutions');
      return;
    }

    solutions.forEach((solution, idx) => {
      if (!solution.blocks || solution.blocks.length === 0) {
        this.warnings.push(`Solution ${idx + 1} is empty`);
      }
    });
  }

  /**
   * Validate tags
   */
  validateTags(tags) {
    if (tags && tags.length > 20) {
      this.warnings.push('Too many tags (>20), consider reducing');
    }
  }

  /**
   * Validate image URLs throughout the problem
   */
  validateImageUrls(data) {
    // Check statement images
    if (data.statement) {
      data.statement.forEach((block, idx) => {
        if (block.type === 'image' && block.url) {
          if (!this.isValidImageUrl(block.url)) {
            this.errors.push(`Statement image ${idx + 1}: URL does not point to a valid image`);
          }
        }
      });
    }

    // Check solution images
    if (data.solutions) {
      data.solutions.forEach((solution, solIdx) => {
        if (solution.blocks) {
          solution.blocks.forEach((block, blockIdx) => {
            if (block.type === 'image' && block.url) {
              if (!this.isValidImageUrl(block.url)) {
                this.errors.push(`Solution ${solIdx + 1}, image ${blockIdx + 1}: URL does not point to a valid image`);
              }
            }
          });
        }
      });
    }
  }

  /**
   * Check if URL is valid
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if URL points to an image
   */
  isValidImageUrl(url) {
    if (!this.isValidUrl(url)) return false;

    try {
      const parsed = new URL(url);
      const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(parsed.pathname);
      const isFirebaseStorage = url.includes('firebasestorage.googleapis.com');
      
      return hasImageExtension || isFirebaseStorage;
    } catch {
      return false;
    }
  }

  /**
   * Get all errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Get all warnings
   */
  getWarnings() {
    return this.warnings;
  }

  /**
   * Check if there are any errors
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Check if there are any warnings
   */
  hasWarnings() {
    return this.warnings.length > 0;
  }

  /**
   * Show errors in an alert
   */
  showErrors() {
    if (this.errors.length === 0) return;

    const errorList = this.errors.map(e => `• ${e}`).join('\n');
    alert(`Please fix the following errors:\n\n${errorList}`);
  }

  /**
   * Show warnings in a confirm dialog
   */
  showWarnings() {
    if (this.warnings.length === 0) return true;

    const warningList = this.warnings.map(w => `• ${w}`).join('\n');
    return confirm(`Warnings:\n\n${warningList}\n\nDo you want to continue anyway?`);
  }
}

/**
 * Show a toast notification
 */
export function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 1rem 1.5rem;
    background: ${colors[type] || colors.info};
    color: white;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-weight: 600;
    animation: slideInRight 0.3s ease;
    max-width: 400px;
  `;

  // Add animation styles if not already present
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

/**
 * Show a loading overlay
 */
export function showLoadingOverlay(message = 'Loading...') {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  `;

  overlay.innerHTML = `
    <div style="
      background: white;
      padding: 2rem;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    ">
      <div style="
        width: 48px;
        height: 48px;
        border: 4px solid #e5e7eb;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
      "></div>
      <div style="font-weight: 600; color: #1f2937;">${message}</div>
    </div>
  `;

  // Add spin animation if not present
  if (!document.getElementById('spin-animation')) {
    const style = document.createElement('style');
    style.id = 'spin-animation';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Hide loading overlay
 */
export function hideLoadingOverlay(overlay) {
  if (overlay && overlay.parentNode) {
    overlay.remove();
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Generate unique block ID
 */
export function generateBlockId() {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
