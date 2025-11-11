// js/rte.js - Reusable Rich Text Editor
// A modular, CSP-compliant rich text editor with math support

/**
 * Creates a rich text editor instance
 * @param {HTMLElement} container - The container element to attach the editor to
 * @param {Object} options - Configuration options
 * @returns {Object} - Editor instance with methods
 */
export function createRichTextEditor(container, options = {}) {
  const config = {
    initialContent: options.initialContent || '',
    placeholder: options.placeholder || 'Type your content here...',
    minHeight: options.minHeight || '150px',
    maxHeight: options.maxHeight || '500px',
    toolbar: options.toolbar || ['bold', 'italic', 'underline', 'headings', 'lists', 'align', 'link', 'math', 'clear'],
    onChange: options.onChange || null,
    enableMath: options.enableMath !== false, // Default true
    mathJaxConfig: options.mathJaxConfig || null
  };

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'rte-wrapper';

  // Create toolbar
  const toolbar = createToolbar(config.toolbar);
  wrapper.appendChild(toolbar);

  // Create editor
  const editorDiv = document.createElement('div');
  editorDiv.className = 'rte-editor';
  editorDiv.contentEditable = true;
  editorDiv.innerHTML = config.initialContent || '<p><br></p>';
  editorDiv.setAttribute('data-placeholder', config.placeholder);
  editorDiv.style.minHeight = config.minHeight;
  editorDiv.style.maxHeight = config.maxHeight;

  wrapper.appendChild(editorDiv);
  container.appendChild(wrapper);

  // Track saved selection for modals
  let savedSelection = null;

  // Save selection on blur (when editor loses focus)
  editorDiv.addEventListener('blur', () => {
    saveSelection();
  });

  // Save selection before any button click
  editorDiv.addEventListener('mouseup', saveSelection);
  editorDiv.addEventListener('keyup', saveSelection);

  function saveSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      savedSelection = selection.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    if (savedSelection) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedSelection);
      return true;
    }
    return false;
  }

  // Attach toolbar event listeners
  toolbar.querySelectorAll('.rte-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const command = btn.dataset.command;
      const value = btn.dataset.value;
      handleCommand(command, value);
    });
  });

  // Handle commands
  function handleCommand(command, value = null) {
    editorDiv.focus();

    switch(command) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'insertUnorderedList':
      case 'insertOrderedList':
      case 'justifyLeft':
      case 'justifyCenter':
      case 'justifyRight':
      case 'removeFormat':
        document.execCommand(command, false, null);
        break;

      case 'formatBlock':
        if (value) {
          document.execCommand('formatBlock', false, value);
        }
        break;

      case 'createLink':
        handleLinkInsertion();
        break;

      case 'insertMath':
        if (config.enableMath) {
          showMathModal();
        }
        break;

      default:
        console.warn('Unknown command:', command);
    }

    // Trigger onChange callback
    if (config.onChange) {
      config.onChange(getContent());
    }
  }

  // Handle link insertion
  function handleLinkInsertion() {
    saveSelection();
    const url = prompt('Enter URL:', 'https://');
    if (url && url !== 'https://') {
      restoreSelection();
      document.execCommand('createLink', false, url);
    }
    editorDiv.focus();
  }

  // Show math modal
  function showMathModal() {
    saveSelection(); // Save selection before opening modal

    const modal = document.createElement('div');
    modal.className = 'math-modal-overlay';

    modal.innerHTML = `
      <div class="math-modal">
        <div class="math-modal-header">
          <h3>Insert Math (LaTeX)</h3>
          <button type="button" class="math-modal-close">&times;</button>
        </div>
        
        <div class="math-modal-body">
          <div class="math-mode-selector">
            <label class="math-mode-option">
              <input type="radio" name="math-mode-${Date.now()}" value="inline" checked />
              <span>Inline: <code>$...$</code></span>
            </label>
            <label class="math-mode-option">
              <input type="radio" name="math-mode-${Date.now()}" value="display" />
              <span>Display: <code>$$...$$</code></span>
            </label>
          </div>
          
          <label class="math-label">LaTeX Code</label>
          <textarea class="math-latex-input" placeholder="e.g., x^2 + y^2 = r^2&#10;or \\frac{a}{b}" rows="4"></textarea>
          
          <div class="math-examples">
            <strong>Quick examples:</strong>
            <button type="button" class="math-example-btn" data-latex="x^2">x²</button>
            <button type="button" class="math-example-btn" data-latex="\\frac{a}{b}">a/b</button>
            <button type="button" class="math-example-btn" data-latex="\\sqrt{x}">√x</button>
            <button type="button" class="math-example-btn" data-latex="\\sum_{i=1}^{n}">Σ</button>
            <button type="button" class="math-example-btn" data-latex="\\int_{a}^{b}">∫</button>
            <button type="button" class="math-example-btn" data-latex="\\alpha">α</button>
            <button type="button" class="math-example-btn" data-latex="\\beta">β</button>
            <button type="button" class="math-example-btn" data-latex="\\infty">∞</button>
          </div>
          
          <label class="math-label">Preview</label>
          <div class="math-preview">
            <small>Type LaTeX above to see preview</small>
          </div>
        </div>
        
        <div class="math-modal-footer">
          <button type="button" class="btn btn-secondary math-cancel-btn">Cancel</button>
          <button type="button" class="btn math-insert-btn">Insert Math</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const latexInput = modal.querySelector('.math-latex-input');
    const previewArea = modal.querySelector('.math-preview');
    const closeBtn = modal.querySelector('.math-modal-close');
    const cancelBtn = modal.querySelector('.math-cancel-btn');
    const insertBtn = modal.querySelector('.math-insert-btn');
    const modeRadios = modal.querySelectorAll('input[type="radio"]');
    const exampleBtns = modal.querySelectorAll('.math-example-btn');

    latexInput.focus();

    // Example buttons
    exampleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        latexInput.value = btn.dataset.latex;
        latexInput.dispatchEvent(new Event('input'));
        latexInput.focus();
      });
    });

    // Live preview
    let previewTimeout;
    function updatePreview() {
      clearTimeout(previewTimeout);
      previewTimeout = setTimeout(() => {
        const latex = latexInput.value.trim();
        if (latex) {
          const mode = modal.querySelector('input[type="radio"]:checked').value;
          const wrapped = mode === 'inline' ? `$${latex}$` : `$$${latex}$$`;
          previewArea.innerHTML = wrapped;

          if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([previewArea]).catch(err => {
              previewArea.innerHTML = '<small style="color: #ef4444;">Invalid LaTeX syntax</small>';
            });
          }
        } else {
          previewArea.innerHTML = '<small>Type LaTeX above to see preview</small>';
        }
      }, 500);
    }

    latexInput.addEventListener('input', updatePreview);
    modeRadios.forEach(radio => radio.addEventListener('change', updatePreview));

    const closeModal = () => {
      modal.remove();
      editorDiv.focus();
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Handle Enter key
    latexInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertBtn.click();
      }
    });

    // Handle Escape key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });

    // Insert button handler
    insertBtn.addEventListener('click', () => {
      const latex = latexInput.value.trim();
      if (!latex) {
        alert('Please enter LaTeX code');
        return;
      }

      const mode = modal.querySelector('input[type="radio"]:checked').value;
      const mathText = mode === 'inline' ? `$${latex}$` : `$$${latex}$$`;

      // Create math span
      const mathSpan = document.createElement('span');
      mathSpan.className = 'math-formula';
      mathSpan.textContent = mathText;
      mathSpan.contentEditable = 'false';

      // Restore selection and insert
      if (restoreSelection()) {
        try {
          const range = savedSelection;
          range.deleteContents();
          range.insertNode(mathSpan);

          // Add space after
          const space = document.createTextNode('\u00A0');
          range.setStartAfter(mathSpan);
          range.insertNode(space);
          range.setStartAfter(space);
          range.collapse(true);

          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (err) {
          console.error('Error inserting math:', err);
          editorDiv.appendChild(mathSpan);
          editorDiv.appendChild(document.createTextNode('\u00A0'));
        }
      } else {
        // No saved selection - append to end
        editorDiv.appendChild(mathSpan);
        editorDiv.appendChild(document.createTextNode('\u00A0'));
      }

      editorDiv.focus();
      closeModal();

      // Trigger onChange
      if (config.onChange) {
        config.onChange(getContent());
      }
    });
  }

  // Keyboard shortcuts
  editorDiv.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          handleCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          handleCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          handleCommand('underline');
          break;
      }
    }
  });

  // Content change detection
  editorDiv.addEventListener('input', () => {
    if (config.onChange) {
      config.onChange(getContent());
    }
  });

  // Get content
  function getContent() {
    return editorDiv.innerHTML;
  }

  // Set content
  function setContent(html) {
    editorDiv.innerHTML = html || '<p><br></p>';
  }

  // Clear content
  function clear() {
    editorDiv.innerHTML = '<p><br></p>';
    if (config.onChange) {
      config.onChange('');
    }
  }

  // Focus
  function focus() {
    editorDiv.focus();
  }

  // Destroy
  function destroy() {
    wrapper.remove();
  }

  // Return public API
  return {
    getContent,
    setContent,
    clear,
    focus,
    destroy,
    element: wrapper,
    editorElement: editorDiv
  };
}

// Create toolbar HTML
function createToolbar(enabledTools) {
  const toolbar = document.createElement('div');
  toolbar.className = 'rte-toolbar';

  const toolGroups = {
    basic: ['bold', 'italic', 'underline'],
    headings: ['formatBlock'],
    lists: ['insertUnorderedList', 'insertOrderedList'],
    align: ['justifyLeft', 'justifyCenter', 'justifyRight'],
    insert: ['createLink', 'insertMath'],
    clear: ['removeFormat']
  };

  // Basic formatting
  if (enabledTools.includes('bold') || enabledTools.includes('italic') || enabledTools.includes('underline')) {
    const group = document.createElement('div');
    group.className = 'rte-toolbar-group';

    if (enabledTools.includes('bold')) {
      group.innerHTML += `<button type="button" class="rte-btn" data-command="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>`;
    }
    if (enabledTools.includes('italic')) {
      group.innerHTML += `<button type="button" class="rte-btn" data-command="italic" title="Italic (Ctrl+I)"><em>I</em></button>`;
    }
    if (enabledTools.includes('underline')) {
      group.innerHTML += `<button type="button" class="rte-btn" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>`;
    }

    toolbar.appendChild(group);
    toolbar.appendChild(createDivider());
  }

  // Headings
  if (enabledTools.includes('headings')) {
    const group = document.createElement('div');
    group.className = 'rte-toolbar-group';
    group.innerHTML = `
      <button type="button" class="rte-btn rte-btn-wide" data-command="formatBlock" data-value="p" title="Normal Text">Normal</button>
      <button type="button" class="rte-btn rte-btn-wide" data-command="formatBlock" data-value="h2" title="Large Heading">Heading 2</button>
      <button type="button" class="rte-btn rte-btn-wide" data-command="formatBlock" data-value="h3" title="Medium Heading">Heading 3</button>
      <button type="button" class="rte-btn rte-btn-wide" data-command="formatBlock" data-value="h4" title="Small Heading">Heading 4</button>
    `;
    toolbar.appendChild(group);
    toolbar.appendChild(createDivider());
  }

  // Lists
  if (enabledTools.includes('lists')) {
    const group = document.createElement('div');
    group.className = 'rte-toolbar-group';
    group.innerHTML = `
      <button type="button" class="rte-btn" data-command="insertUnorderedList" title="Bullet List">• List</button>
      <button type="button" class="rte-btn" data-command="insertOrderedList" title="Numbered List">1. List</button>
    `;
    toolbar.appendChild(group);
    toolbar.appendChild(createDivider());
  }

  // Align
  if (enabledTools.includes('align')) {
    const group = document.createElement('div');
    group.className = 'rte-toolbar-group';
    group.innerHTML = `
      <button type="button" class="rte-btn" data-command="justifyLeft" title="Align Left">⬅</button>
      <button type="button" class="rte-btn" data-command="justifyCenter" title="Align Center">↔</button>
      <button type="button" class="rte-btn" data-command="justifyRight" title="Align Right">➡</button>
    `;
    toolbar.appendChild(group);
    toolbar.appendChild(createDivider());
  }

  // Insert
  if (enabledTools.includes('link') || enabledTools.includes('math')) {
    const group = document.createElement('div');
    group.className = 'rte-toolbar-group';

    if (enabledTools.includes('link')) {
      group.innerHTML += `<button type="button" class="rte-btn" data-command="createLink" title="Insert Link">🔗</button>`;
    }
    if (enabledTools.includes('math')) {
      group.innerHTML += `<button type="button" class="rte-btn rte-btn-math" data-command="insertMath" title="Insert Math (LaTeX)"><em>f(x)</em></button>`;
    }

    toolbar.appendChild(group);
    toolbar.appendChild(createDivider());
  }

  // Clear
  if (enabledTools.includes('clear')) {
    const group = document.createElement('div');
    group.className = 'rte-toolbar-group';
    group.innerHTML = `<button type="button" class="rte-btn" data-command="removeFormat" title="Clear Formatting">✕</button>`;
    toolbar.appendChild(group);
  }

  return toolbar;
}

function createDivider() {
  const divider = document.createElement('div');
  divider.className = 'rte-toolbar-divider';
  return divider;
}
