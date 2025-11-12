// js/edit-problem.js - Complete rewrite with robust error handling
import { db, doc, getDoc, setDoc, serverTimestamp } from "./firebase.js";
import { populateCategorySelect } from "./categories-utils.js";
import { createRichTextEditor } from "./rte.js";
import { openPhotoUploadModal, uploadPhotoToStorage } from "./photo-utils.js";
import {
  BlockRegistry,
  AutoSaver,
  ProblemValidator,
  showNotification,
  showLoadingOverlay,
  hideLoadingOverlay,
  escapeHtml,
  generateBlockId
} from "./edit-problem-utils.js";

// Global instances
const blockRegistry = new BlockRegistry();
let autoSaver = null;
let currentProblemId = null;

// DOM elements
let problemIdInput, titleInput, categoryInput, difficultyInput, tagsInput;
let statementContainer, solutionsContainer, lessonRefsInput;
let saveDraftBtn, publishBtn, previewBtn;
let editorForm, previewMode;

/**
 * Create a text block with RTE
 */
function createTextBlock(block = { content: '' }, blockId = null) {
  if (!blockId) blockId = generateBlockId();

  const wrapper = document.createElement('div');
  wrapper.className = 'block-editor';
  wrapper.dataset.blockId = blockId;
  wrapper.dataset.type = 'text';

  wrapper.innerHTML = `
    <div class="block-header">
      <span>📝 Text Block</span>
      <div class="block-controls">
        <button type="button" class="btn-icon move-up" title="Move Up" aria-label="Move block up">↑</button>
        <button type="button" class="btn-icon move-down" title="Move Down" aria-label="Move block down">↓</button>
        <button type="button" class="btn-icon remove-block" title="Remove" aria-label="Remove block">✕</button>
      </div>
    </div>
    <div class="rte-container"></div>
  `;

  // Create RTE instance
  const container = wrapper.querySelector('.rte-container');
  const rte = createRichTextEditor(container, {
    initialContent: block.content || '<p><br></p>',
    placeholder: 'Enter problem text (supports math with $...$ and $$...$$)',
    minHeight: '150px',
    onChange: () => {
      // Trigger auto-save on content change
      if (autoSaver) {
        // Debounce: save after 2 seconds of no typing
        clearTimeout(wrapper._saveTimeout);
        wrapper._saveTimeout = setTimeout(() => {
          console.log('[TextBlock] Content changed, will auto-save');
        }, 2000);
      }
    }
  });

  // Register block
  blockRegistry.register(blockId, {
    element: wrapper,
    type: 'text',
    rte: rte,
    data: block
  });

  // Attach controls
  attachBlockControls(wrapper, blockId);

  return wrapper;
}

/**
 * Create an image block with URL/Upload toggle
 */
function createImageBlock(block = { url: '' }, blockId = null) {
  if (!blockId) blockId = generateBlockId();

  const wrapper = document.createElement('div');
  wrapper.className = 'block-editor';
  wrapper.dataset.blockId = blockId;
  wrapper.dataset.type = 'image';

  wrapper.innerHTML = `
    <div class="block-header">
      <span>🖼️ Image Block</span>
      <div class="block-controls">
        <button type="button" class="btn-icon move-up" title="Move Up" aria-label="Move block up">↑</button>
        <button type="button" class="btn-icon move-down" title="Move Down" aria-label="Move block down">↓</button>
        <button type="button" class="btn-icon remove-block" title="Remove" aria-label="Remove block">✕</button>
      </div>
    </div>

    <!-- Upload Mode Toggle -->
    <div class="image-mode-toggle">
      <button type="button" class="mode-btn active" data-mode="url">🔗 URL</button>
      <button type="button" class="mode-btn" data-mode="upload">📤 Upload</button>
    </div>

    <!-- URL Input (default visible) -->
    <div class="url-mode active">
      <input type="text" class="block-input image-url-input" 
             placeholder="Image URL (https://...)" 
             value="${escapeHtml(block.url || '')}"
             aria-label="Image URL">
      ${block.url ? `
        <div class="image-preview-container">
          <img class="image-preview" src="${escapeHtml(block.url)}" alt="Preview" />
        </div>
      ` : ''}
    </div>

    <!-- Upload Section (hidden by default) -->
    <div class="upload-mode">
      <button type="button" class="btn btn-small upload-image-btn">📤 Choose Image</button>
      <span class="upload-status"></span>
      
      <div class="image-preview-container" style="display: none;">
        <img class="uploaded-image-preview" src="" alt="Uploaded preview" />
        <button type="button" class="btn btn-small btn-secondary remove-image-btn">Remove Image</button>
      </div>
    </div>
  `;

  // Mode toggle handlers
  const modeButtons = wrapper.querySelectorAll('.mode-btn');
  const urlMode = wrapper.querySelector('.url-mode');
  const uploadMode = wrapper.querySelector('.upload-mode');

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (mode === 'url') {
        urlMode.classList.add('active');
        uploadMode.classList.remove('active');
      } else {
        urlMode.classList.remove('active');
        uploadMode.classList.add('active');
      }
    });
  });

  // Upload button handler
  const uploadBtn = wrapper.querySelector('.upload-image-btn');
  const uploadStatus = wrapper.querySelector('.upload-status');
  const imageInput = wrapper.querySelector('.image-url-input');
  const uploadPreviewContainer = uploadMode.querySelector('.image-preview-container');
  const uploadPreviewImg = uploadMode.querySelector('.uploaded-image-preview');
  const removeBtn = wrapper.querySelector('.remove-image-btn');

  uploadBtn.addEventListener('click', () => {
    openPhotoUploadModal({
      aspectRatio: 16/9,
      cropShape: 'rectangle',
      onSave: async (blob) => {
        try {
          uploadBtn.disabled = true;
          uploadStatus.textContent = '⏳ Uploading...';
          uploadStatus.style.color = '#f59e0b';

          // Upload to Firebase Storage
          const pid = problemIdInput.value || 'temp';
          const path = `problem_images/${pid}/${blockId}`;
          const downloadURL = await uploadPhotoToStorage(blob, path);

          // Update input and preview
          imageInput.value = downloadURL;
          uploadPreviewImg.src = downloadURL;
          uploadPreviewContainer.style.display = 'block';

          uploadStatus.textContent = '✅ Uploaded';
          uploadStatus.style.color = '#10b981';

          showNotification('✅ Image uploaded successfully', 'success');

          setTimeout(() => {
            uploadStatus.textContent = '';
          }, 3000);

        } catch (err) {
          console.error('Upload failed:', err);
          uploadStatus.textContent = '❌ Upload failed';
          uploadStatus.style.color = '#ef4444';
          showNotification('❌ Upload failed: ' + err.message, 'error');
        } finally {
          uploadBtn.disabled = false;
        }
      }
    });
  });

  removeBtn.addEventListener('click', () => {
    imageInput.value = '';
    uploadPreviewImg.src = '';
    uploadPreviewContainer.style.display = 'none';
  });

  // Show preview if URL exists on load
  if (block.url) {
    const urlPreview = urlMode.querySelector('.image-preview');
    if (urlPreview) {
      urlPreview.src = block.url;
    }
  }

  // Register block
  blockRegistry.register(blockId, {
    element: wrapper,
    type: 'image',
    rte: null,
    data: block
  });

  // Attach controls
  attachBlockControls(wrapper, blockId);

  return wrapper;
}

/**
 * Create a problem reference block
 */
function createProblemRefBlock(block = { problemId: '' }, blockId = null) {
  if (!blockId) blockId = generateBlockId();

  const wrapper = document.createElement('div');
  wrapper.className = 'block-editor';
  wrapper.dataset.blockId = blockId;
  wrapper.dataset.type = 'problem';

  wrapper.innerHTML = `
    <div class="block-header">
      <span>🔗 Problem Reference</span>
      <div class="block-controls">
        <button type="button" class="btn-icon move-up" title="Move Up" aria-label="Move block up">↑</button>
        <button type="button" class="btn-icon move-down" title="Move Down" aria-label="Move block down">↓</button>
        <button type="button" class="btn-icon remove-block" title="Remove" aria-label="Remove block">✕</button>
      </div>
    </div>
    <input type="text" class="block-input" 
           placeholder="Problem ID (e.g., 42)" 
           value="${escapeHtml(block.problemId || '')}"
           aria-label="Problem ID">
  `;

  blockRegistry.register(blockId, {
    element: wrapper,
    type: 'problem',
    rte: null,
    data: block
  });

  attachBlockControls(wrapper, blockId);
  return wrapper;
}

/**
 * Create a lesson reference block
 */
function createLessonRefBlock(block = { lessonId: '' }, blockId = null) {
  if (!blockId) blockId = generateBlockId();

  const wrapper = document.createElement('div');
  wrapper.className = 'block-editor';
  wrapper.dataset.blockId = blockId;
  wrapper.dataset.type = 'lesson';

  wrapper.innerHTML = `
    <div class="block-header">
      <span>📚 Lesson Reference</span>
      <div class="block-controls">
        <button type="button" class="btn-icon move-up" title="Move Up" aria-label="Move block up">↑</button>
        <button type="button" class="btn-icon move-down" title="Move Down" aria-label="Move block down">↓</button>
        <button type="button" class="btn-icon remove-block" title="Remove" aria-label="Remove block">✕</button>
      </div>
    </div>
    <input type="text" class="block-input" 
           placeholder="Lesson ID (e.g., 5)" 
           value="${escapeHtml(block.lessonId || '')}"
           aria-label="Lesson ID">
  `;

  blockRegistry.register(blockId, {
    element: wrapper,
    type: 'lesson',
    rte: null,
    data: block
  });

  attachBlockControls(wrapper, blockId);
  return wrapper;
}

/**
 * Attach control buttons to a block
 */
function attachBlockControls(wrapper, blockId) {
  const removeBtn = wrapper.querySelector('.remove-block');
  const moveUpBtn = wrapper.querySelector('.move-up');
  const moveDownBtn = wrapper.querySelector('.move-down');

  removeBtn.addEventListener('click', () => {
    if (confirm('Remove this block?')) {
      blockRegistry.remove(blockId);
      wrapper.remove();
    }
  });

  moveUpBtn.addEventListener('click', () => moveBlock(wrapper, -1));
  moveDownBtn.addEventListener('click', () => moveBlock(wrapper, 1));
}

/**
 * Move block up or down
 */
function moveBlock(blockElement, direction) {
  const container = blockElement.parentElement;
  const blocks = Array.from(container.children);
  const index = blocks.indexOf(blockElement);
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= blocks.length) return;

  if (direction === -1) {
    container.insertBefore(blockElement, blocks[newIndex]);
  } else {
    container.insertBefore(blocks[newIndex], blockElement);
  }
}

/**
 * Create solution editor
 */
function createSolutionEditor(solution = { title: '', blocks: [] }, solutionIndex) {
  const wrapper = document.createElement('div');
  wrapper.className = 'solution-editor';
  wrapper.dataset.solutionIndex = solutionIndex;

  wrapper.innerHTML = `
    <div class="solution-header">
      <h3>Solution ${solutionIndex + 1}</h3>
      <button type="button" class="btn-icon remove-solution" title="Remove Solution" aria-label="Remove solution">✕</button>
    </div>
    <label for="solution-title-${solutionIndex}">Solution Title (optional)</label>
    <input type="text" 
           id="solution-title-${solutionIndex}" 
           class="solution-title" 
           placeholder="e.g., Solution 1, Algebraic Method" 
           value="${escapeHtml(solution.title || '')}">
    <div class="solution-blocks"></div>
    <div class="block-actions">
      <button type="button" class="add-text-solution btn btn-small" aria-label="Add text block to solution">➕ Text</button>
      <button type="button" class="add-image-solution btn btn-small" aria-label="Add image to solution">🖼️ Image</button>
    </div>
  `;

  const blocksContainer = wrapper.querySelector('.solution-blocks');

  // Load existing blocks
  (solution.blocks || []).forEach(block => {
    const blockElement = createBlockByType(block);
    if (blockElement) {
      blocksContainer.appendChild(blockElement);
    }
  });

  // Add block buttons
  wrapper.querySelector('.add-text-solution').addEventListener('click', () => {
    blocksContainer.appendChild(createTextBlock());
  });

  wrapper.querySelector('.add-image-solution').addEventListener('click', () => {
    blocksContainer.appendChild(createImageBlock());
  });

  // Remove solution
  wrapper.querySelector('.remove-solution').addEventListener('click', () => {
    if (confirm('Remove this solution?')) {
      // Clean up all blocks in this solution
      wrapper.querySelectorAll('.block-editor').forEach(blockEl => {
        const blockId = blockEl.dataset.blockId;
        if (blockId) {
          blockRegistry.remove(blockId);
        }
      });
      wrapper.remove();
    }
  });

  return wrapper;
}

/**
 * Create block by type
 */
function createBlockByType(block) {
  switch (block.type) {
    case 'text':
      return createTextBlock(block);
    case 'image':
      return createImageBlock(block);
    case 'problem':
      return createProblemRefBlock(block);
    case 'lesson':
      return createLessonRefBlock(block);
    default:
      console.warn('Unknown block type:', block.type);
      return null;
  }
}

/**
 * Gather all problem data
 */
function gatherProblemData() {
  const pid = problemIdInput.value;

  return {
    id: parseInt(pid),
    title: titleInput.value.trim() || `Problem #${pid}`,
    category: categoryInput.value,
    difficulty: difficultyInput.value,
    tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
    statement: blockRegistry.getAllBlocks(statementContainer),
    solutions: gatherSolutions(),
    lessons: lessonRefsInput.value.split(',').map(x => x.trim()).filter(Boolean).map(x => parseInt(x)),
    draft: false, // Will be set by save function
    author: 'admin',
    timestamp: serverTimestamp()
  };
}

/**
 * Gather all solutions
 */
function gatherSolutions() {
  const solutions = [];

  solutionsContainer.querySelectorAll('.solution-editor').forEach(solEl => {
    const title = solEl.querySelector('.solution-title').value.trim();
    const blocksContainer = solEl.querySelector('.solution-blocks');
    const blocks = blockRegistry.getAllBlocks(blocksContainer);

    solutions.push({ title, blocks });
  });

  return solutions;
}

/**
 * Save problem with validation and error handling
 */
async function saveProblem(publish = false) {
  const btn = publish ? publishBtn : saveDraftBtn;
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');

  // Gather data
  const problemData = gatherProblemData();
  problemData.draft = !publish;

  console.log('[Save] Gathered problem data:', problemData);

  // Validate
  const validator = new ProblemValidator();
  if (!validator.validate(problemData)) {
    validator.showErrors();
    return;
  }

  // Show warnings if any
  if (validator.hasWarnings()) {
    if (!validator.showWarnings()) {
      return; // User cancelled
    }
  }

  // Show loading state
  btn.disabled = true;
  btnText.style.display = 'none';
  btnSpinner.style.display = 'inline-block';

  try {
    await setDoc(doc(db, 'problems', String(problemData.id)), problemData, { merge: true });

    // Clear auto-save draft on successful save
    if (autoSaver) {
      autoSaver.clearDraft();
    }

    const message = publish ? '✅ Problem published successfully!' : '✅ Draft saved successfully!';
    showNotification(message, 'success');

    console.log('[Save] Success:', message);

    if (publish) {
      setTimeout(() => {
        window.location.href = 'problems.html';
      }, 1000);
    }

  } catch (err) {
    console.error('[Save] Error:', err);
    showNotification('❌ Failed to save: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline-block';
    btnSpinner.style.display = 'none';
  }
}

/**
 * Load existing problem
 */
async function loadProblem(problemId) {
  const overlay = showLoadingOverlay('Loading problem...');

  try {
    const problemDoc = await getDoc(doc(db, 'problems', String(problemId)));

    if (!problemDoc.exists()) {
      throw new Error('Problem not found');
    }

    const data = problemDoc.data();
    console.log('[Load] Problem data:', data);

    // Populate form
    titleInput.value = data.title || '';
    categoryInput.value = data.category || '';
    difficultyInput.value = data.difficulty || 'Medium';
    tagsInput.value = (data.tags || []).join(', ');
    lessonRefsInput.value = (data.lessons || []).join(', ');

    // Load statement blocks
    statementContainer.innerHTML = '';
    (data.statement || []).forEach(block => {
      const blockElement = createBlockByType(block);
      if (blockElement) {
        statementContainer.appendChild(blockElement);
      }
    });

    // Load solutions
    solutionsContainer.innerHTML = '';
    (data.solutions || []).forEach((solution, index) => {
      solutionsContainer.appendChild(createSolutionEditor(solution, index));
    });

    hideLoadingOverlay(overlay);
    showNotification('✅ Problem loaded successfully', 'success');

  } catch (err) {
    console.error('[Load] Error:', err);
    hideLoadingOverlay(overlay);

    const retry = confirm(
      `Failed to load problem: ${err.message}\n\nWould you like to retry or return to problems list?`
    );

    if (retry) {
      return loadProblem(problemId);
    } else {
      window.location.href = 'problems.html';
    }
  }
}

/**
 * Show preview mode
 */
async function showPreview() {
  editorForm.style.display = 'none';
  previewMode.style.display = 'block';
  previewBtn.textContent = '✏️ Edit';

  // Gather and render data
  const problemData = gatherProblemData();
  renderPreview(problemData);

  // Wait for DOM to settle
  await new Promise(resolve => setTimeout(resolve, 100));

  // Typeset math
  if (window.MathJax?.typesetPromise) {
    try {
      await window.MathJax.typesetPromise([previewMode]);
    } catch (err) {
      console.error('[Preview] MathJax error:', err);
      showNotification('⚠️ Some math formulas may not have rendered correctly', 'warning', 5000);
    }
  }
}

/**
 * Hide preview mode
 */
function hidePreview() {
  editorForm.style.display = 'block';
  previewMode.style.display = 'none';
  previewBtn.textContent = '👁️ Preview';
}

/**
 * Render problem preview
 */
function renderPreview(data) {
  const title = data.title || `Problem #${data.id}`;
  
  document.getElementById('preview-title').textContent = title;
  document.getElementById('preview-id').textContent = `#${data.id}`;
  document.getElementById('preview-category').textContent = data.category || 'General';
  
  const difficultyEl = document.getElementById('preview-difficulty');
  difficultyEl.textContent = data.difficulty;
  difficultyEl.className = `meta-item difficulty-${data.difficulty.toLowerCase()}`;

  // Tags
  const previewTags = document.getElementById('preview-tags');
  previewTags.innerHTML = '';
  (data.tags || []).forEach(tag => {
    previewTags.insertAdjacentHTML('beforeend', `<span class="tag">${escapeHtml(tag)}</span>`);
  });

  // Statement
  const previewStatement = document.getElementById('preview-statement');
  previewStatement.innerHTML = '';
  (data.statement || []).forEach(block => {
    previewStatement.insertAdjacentHTML('beforeend', renderBlockPreview(block));
  });

  // Solutions
  const previewSolutions = document.getElementById('preview-solutions');
  previewSolutions.innerHTML = '';

  (data.solutions || []).forEach((solution, index) => {
    const solutionTitle = solution.title || `Solution ${index + 1}`;
    let solutionHtml = `<div class="solution-block"><h3>${escapeHtml(solutionTitle)}</h3>`;
    
    (solution.blocks || []).forEach(block => {
      solutionHtml += renderBlockPreview(block);
    });
    
    solutionHtml += '</div>';
    previewSolutions.insertAdjacentHTML('beforeend', solutionHtml);
  });
}

/**
 * Render block for preview
 */
function renderBlockPreview(block) {
  if (!block) return '';

  switch (block.type) {
    case 'text':
      return `<div class="block-text">${block.content || ''}</div>`;
    
    case 'image':
      return `<div class="block-image"><img src="${escapeHtml(block.url || '')}" style="max-width:100%; border-radius: 8px; margin: 1rem 0;" alt="Problem image" /></div>`;
    
    case 'problem':
      return `<div class="ref-block"><strong>📝 Related Problem:</strong> <a href="../problem.html?id=${escapeHtml(block.problemId || '')}" class="ref-link">Problem #${escapeHtml(block.problemId || '')}</a></div>`;
    
    case 'lesson':
      return `<div class="ref-block"><strong>📚 Related Lesson:</strong> <a href="../lesson.html?id=${escapeHtml(block.lessonId || '')}" class="ref-link">Lesson #${escapeHtml(block.lessonId || '')}</a></div>`;
    
    default:
      return '';
  }
}

/**
 * Check for draft and show recovery modal
 */
function checkForDraft() {
  if (!autoSaver) return;

  const draft = autoSaver.loadDraft();
  if (!draft) return;

  const age = autoSaver.formatDraftAge();
  const shouldRestore = confirm(
    `A draft was found from ${age}.\n\nWould you like to restore it?`
  );

  if (shouldRestore) {
    restoreDraft(draft.data);
    showNotification('✅ Draft restored', 'success');
  } else {
    autoSaver.clearDraft();
  }
}

/**
 * Restore draft data
 */
function restoreDraft(data) {
  titleInput.value = data.title || '';
  categoryInput.value = data.category || '';
  difficultyInput.value = data.difficulty || 'Medium';
  tagsInput.value = (data.tags || []).join(', ');
  lessonRefsInput.value = (data.lessons || []).join(', ');

  // Restore statement blocks
  statementContainer.innerHTML = '';
  (data.statement || []).forEach(block => {
    const blockElement = createBlockByType(block);
    if (blockElement) {
      statementContainer.appendChild(blockElement);
    }
  });

  // Restore solutions
  solutionsContainer.innerHTML = '';
  (data.solutions || []).forEach((solution, index) => {
    solutionsContainer.appendChild(createSolutionEditor(solution, index));
  });
}

/**
 * Initialize editor
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  problemIdInput = document.getElementById('problem-id');
  titleInput = document.getElementById('problem-title');
  categoryInput = document.getElementById('problem-category');
  difficultyInput = document.getElementById('problem-difficulty');
  tagsInput = document.getElementById('problem-tags');
  statementContainer = document.getElementById('statement-blocks');
  solutionsContainer = document.getElementById('solutions-container');
  lessonRefsInput = document.getElementById('lesson-refs');
  saveDraftBtn = document.getElementById('save-draft-btn');
  publishBtn = document.getElementById('publish-btn');
  previewBtn = document.getElementById('preview-btn');
  editorForm = document.getElementById('editor-form');
  previewMode = document.getElementById('preview-mode');

  // Add button spinners
  saveDraftBtn.innerHTML = '<span class="btn-text">💾 Save as Draft</span><span class="btn-spinner" style="display:none;">⏳</span>';
  publishBtn.innerHTML = '<span class="btn-text">✅ Publish</span><span class="btn-spinner" style="display:none;">⏳</span>';

  // Get problem ID from URL
  const params = new URLSearchParams(window.location.search);
  currentProblemId = params.get('id');

  if (currentProblemId) {
    problemIdInput.value = currentProblemId;
    problemIdInput.readOnly = true;
  }

  // Load categories
  await populateCategorySelect(categoryInput);

  // Setup statement block buttons
  document.getElementById('add-text-statement').addEventListener('click', () => {
    statementContainer.appendChild(createTextBlock());
  });

  document.getElementById('add-image-statement').addEventListener('click', () => {
    statementContainer.appendChild(createImageBlock());
  });

  document.getElementById('add-problem-ref-statement').addEventListener('click', () => {
    statementContainer.appendChild(createProblemRefBlock());
  });

  document.getElementById('add-lesson-ref-statement').addEventListener('click', () => {
    statementContainer.appendChild(createLessonRefBlock());
  });

  // Setup solution button
  document.getElementById('add-solution-btn').addEventListener('click', () => {
    const index = solutionsContainer.children.length;
    solutionsContainer.appendChild(createSolutionEditor({}, index));
  });

  // Setup save buttons
  saveDraftBtn.addEventListener('click', () => saveProblem(false));
  publishBtn.addEventListener('click', () => saveProblem(true));

  // Setup preview button
  previewBtn.addEventListener('click', () => {
    if (previewMode.style.display === 'block') {
      hidePreview();
    } else {
      showPreview();
    }
  });

  // Setup keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveProblem(false);
    }
  });

  // Load existing problem or check for draft
  if (currentProblemId) {
    await loadProblem(currentProblemId);
  }

  // Initialize auto-saver
  autoSaver = new AutoSaver(currentProblemId || 'new', 30000);
  
  // Check for draft after a short delay
  setTimeout(() => {
    checkForDraft();
  }, 500);

  // Start auto-saving
  autoSaver.start(() => gatherProblemData());

  console.log('[Init] Editor initialized successfully');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (autoSaver) {
    autoSaver.stop();
  }
  blockRegistry.clear();
});
