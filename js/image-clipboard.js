// js/image-clipboard.js - Clipboard image paste utilities
// Provides easy clipboard paste support for images across the application

/**
 * Enable global image paste from clipboard
 * @param {Function} onImagePasted - Callback when image is pasted (receives blob and event)
 * @param {Object} options - Configuration options
 */
export function enableGlobalImagePaste(onImagePasted, options = {}) {
  const config = {
    showIndicator: options.showIndicator !== false,
    excludeElements: options.excludeElements || ['.rte-editor', 'input', 'textarea'],
    ...options
  };

  const pasteHandler = async (e) => {
    // Check if we're in an excluded element
    const activeElement = document.activeElement;
    if (activeElement) {
      for (const selector of config.excludeElements) {
        if (activeElement.matches && activeElement.matches(selector)) {
          return; // Let the element handle it
        }
      }
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) continue;

        if (config.showIndicator) {
          showPasteIndicator('📋 Image pasted! Processing...');
        }

        try {
          // Convert file to blob
          const blob = await file;
          
          // Call callback with blob and original event
          await onImagePasted(blob, e);
          
          if (config.showIndicator) {
            showPasteIndicator('✅ Image processed successfully!', 'success');
          }
        } catch (err) {
          console.error('[Clipboard] Error processing pasted image:', err);
          if (config.showIndicator) {
            showPasteIndicator('❌ Failed to process image', 'error');
          }
        }
        
        return;
      }
    }
  };

  document.addEventListener('paste', pasteHandler);
  
  console.log('[Clipboard] Global image paste enabled');

  // Return cleanup function
  return () => {
    document.removeEventListener('paste', pasteHandler);
    console.log('[Clipboard] Global image paste disabled');
  };
}

/**
 * Enable image paste for a specific element
 * @param {HTMLElement} element - Element to attach paste handler to
 * @param {Function} onImagePasted - Callback when image is pasted
 * @param {Object} options - Configuration options
 */
export function enableElementImagePaste(element, onImagePasted, options = {}) {
  if (!element) {
    console.warn('[Clipboard] No element provided');
    return null;
  }

  const config = {
    showIndicator: options.showIndicator !== false,
    ...options
  };

  const pasteHandler = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        
        const file = item.getAsFile();
        if (!file) continue;

        if (config.showIndicator) {
          showPasteIndicator('📋 Image pasted! Processing...');
        }

        try {
          const blob = await file;
          await onImagePasted(blob, e);
          
          if (config.showIndicator) {
            showPasteIndicator('✅ Image processed!', 'success');
          }
        } catch (err) {
          console.error('[Clipboard] Error processing pasted image:', err);
          if (config.showIndicator) {
            showPasteIndicator('❌ Failed to process image', 'error');
          }
        }
        
        return;
      }
    }
  };

  element.addEventListener('paste', pasteHandler);
  
  console.log('[Clipboard] Image paste enabled for element:', element);

  // Return cleanup function
  return () => {
    element.removeEventListener('paste', pasteHandler);
    console.log('[Clipboard] Image paste disabled for element');
  };
}

/**
 * Show paste indicator notification
 * @param {string} message - Message to display
 * @param {string} type - Type of notification ('info', 'success', 'error')
 * @param {number} duration - Duration in milliseconds
 */
export function showPasteIndicator(message = '📋 Image pasted!', type = 'info', duration = 2000) {
  // Remove existing indicator
  const existing = document.getElementById('clipboard-paste-indicator');
  if (existing) {
    existing.remove();
  }

  const indicator = document.createElement('div');
  indicator.id = 'clipboard-paste-indicator';
  
  const colors = {
    info: {
      bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      icon: '📋'
    },
    success: {
      bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      icon: '✅'
    },
    error: {
      bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      icon: '❌'
    }
  };

  const style = colors[type] || colors.info;

  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${style.bg};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    font-weight: 600;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    animation: slideInUp 0.3s ease;
    max-width: 300px;
  `;

  indicator.innerHTML = `
    <span style="font-size: 1.5rem;">${style.icon}</span>
    <span>${message}</span>
  `;

  // Add animation styles if not present
  if (!document.getElementById('clipboard-paste-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'clipboard-paste-styles';
    styleEl.textContent = `
      @keyframes slideInUp {
        from {
          transform: translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutDown {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  document.body.appendChild(indicator);

  // Auto-remove after duration
  setTimeout(() => {
    indicator.style.animation = 'slideOutDown 0.3s ease';
    setTimeout(() => indicator.remove(), 300);
  }, duration);
}

/**
 * Get image from clipboard programmatically
 * @returns {Promise<Blob|null>} Image blob or null if no image in clipboard
 */
export async function getImageFromClipboard() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      console.warn('[Clipboard] Clipboard API not available');
      return null;
    }

    const clipboardItems = await navigator.clipboard.read();
    
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          return blob;
        }
      }
    }
    
    return null;
  } catch (err) {
    console.error('[Clipboard] Error reading from clipboard:', err);
    return null;
  }
}

/**
 * Check if clipboard contains an image
 * @returns {Promise<boolean>}
 */
export async function hasImageInClipboard() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      return false;
    }

    const clipboardItems = await navigator.clipboard.read();
    
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          return true;
        }
      }
    }
    
    return false;
  } catch (err) {
    console.error('[Clipboard] Error checking clipboard:', err);
    return false;
  }
}

/**
 * Show paste hint on page (optional visual reminder)
 * @param {string} message - Hint message
 * @param {HTMLElement} targetElement - Element to show hint near
 */
export function showPasteHint(message = '💡 Tip: You can paste images with Ctrl+V', targetElement = null) {
  const hint = document.createElement('div');
  hint.className = 'clipboard-paste-hint';
  hint.style.cssText = `
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    color: #92400e;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    margin: 1rem 0;
    border-left: 4px solid #f59e0b;
    animation: fadeIn 0.3s ease;
  `;
  hint.textContent = message;

  if (targetElement && targetElement.parentElement) {
    targetElement.parentElement.insertBefore(hint, targetElement);
  } else {
    document.body.appendChild(hint);
  }

  // Auto-remove after 5 seconds
  setTimeout(() => {
    hint.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => hint.remove(), 300);
  }, 5000);
}

// Export default object with all functions
export default {
  enableGlobalImagePaste,
  enableElementImagePaste,
  showPasteIndicator,
  getImageFromClipboard,
  hasImageInClipboard,
  showPasteHint
};
