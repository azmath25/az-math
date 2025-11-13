// js/edit-problem.js - Enhanced with image positioning, sizing, and clipboard support
import { db, doc, getDoc, setDoc, serverTimestamp } from "./firebase.js";
import { populateCategorySelect } from "./categories-utils.js";
import { createRichTextEditor } from "./rte.js";
import { openPhotoUploadModal, uploadPhotoToStorage, validateImageUrl } from "./photo-utils.js";
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
        <button type="button" class="btn-icon move-up" title="Move Up">↑</button>
        <button type="button" class="btn-icon move-down" title="Move Down">↓</button>
        <button type="button" class="btn-icon remove-block" title="Remove">✕</button>
      </div>
    </div>
    <div class="rte-container"></div>
  `;

  const container = wrapper.querySelector('.rte-container');
  const rte = createRichTextEditor(container, {
    initialContent: block.content || '<p><br></p>',
    placeholder: 'Enter problem text (supports math with $...$ and $$...$$)',
    minHeight: '150px',
    onChange: () => {
      clearTimeout(wrapper._saveTimeout);
      wrapper._saveTimeout = setTimeout(() => {
        console.log('[TextBlock] Content changed, will auto-save');
      }, 2000);
    }
  });

  blockRegistry.register(blockId, {
    element: wrapper,
    type: 'text',
    rte: rte,
    data: block
  });

  attachBlockControls(wrapper, blockId);
  return wrapper;
}

/**
 * Create an enhanced image block with positioning, sizing, and caption
 */
function createImageBlock(block = {
  url: '',
  alignment: 'center',
  size: 'medium',
  caption: '',
  alt: ''
}, blockId = null) {
  if (!blockId) blockId = generateBlockId();

  const wrapper = document.createElement('div');
  wrapper.className = 'block-editor block-editor-image';
  wrapper.dataset.blockId = blockId;
  wrapper.dataset.type = 'image';

  wrapper.innerHTML = `
    <div class="block-header">
      <span>🖼️ Image Block</span>
      <div class="block-controls">
        <button type="button" class="btn-icon move-up" title="Move Up">↑</button>
        <button type="button" class="btn-icon move-down" title="Move Down">↓</button>
        <button type="button" class="btn-icon remove-block" title="Remove">✕</button>
      </div>
    </div>

    <!-- Image Mode Toggle -->
    <div class="image-mode-toggle">
      <button type="button" class="mode-btn active" data-mode="url">🔗 URL</button>
      <button type="button" class="mode-btn" data-mode="upload">📤 Upload</button>
    </div>

    <!-- URL Input -->
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

    <!-- Upload Section -->
    <div class="upload-mode">
      <button type="button" class="btn btn-small upload-image-btn">📤 Choose Image</button>
      <span class="upload-status"></span>
      
      <div class="image-preview-container" style="display: none;">
        <img class="uploaded-image-preview" src="" alt="Uploaded preview" />
        <button type="button" class="btn btn-small btn-secondary remove-image-btn">Remove</button>
      </div>
    </div>

    <!-- Enhanced Image Controls -->
    <div class="image-block-settings" style="display: ${block.url ? 'block' : 'none'};">
      <div class="settings-section">
        <label class="settings-label">📐 Alignment</label>
        <div class="image-alignment-selector">
          <button type="button" class="alignment-btn ${block.alignment === 'left' ? 'active' : ''}" data-align="left" title="Align Left">⬅️ Left</button>
          <button type="button" class="alignment-btn ${block.alignment === 'center' || !block.alignment ? 'active' : ''}" data-align="center" title="Center">↔️ Center</button>
          <button type="button" class="alignment-btn ${block.alignment === 'right' ? 'active' : ''}" data-align="right" title="Align Right">➡️ Right</button>
          <button type="button" class="alignment-btn ${block.alignment === 'float-left' ? 'active' : ''}" data-align="float-left" title="Float Left (text wraps right)">📐← Float Left</button>
          <button type="button" class="alignment-btn ${block.alignment === 'float-right' ? 'active' : ''}" data-align="float-right" title="Float Right (text wraps left)">📐→ Float Right</button>
        </div>
      </div>

      <div class="settings-section">
        <label class="settings-label">📏 Size</label>
        <div class="image-size-selector">
          <button type="button" class="size-btn ${block.size === 'small' ? 'active' : ''}" data-size="small" title="Small (400px)">S</button>
          <button type="button" class="size-btn ${block.size === 'medium' || !block.size ? 'active' : ''}" data-size="medium" title="Medium (600px)">M</button>
          <button type="button" class="size-btn ${block.size === 'large' ? 'active' : ''}" data-size="large" title="Large (800px)">L</button>
          <button type="button" class="size-btn ${block.size === 'full' ? 'active' : ''}" data-size="full" title="Full Width">Full</button>
        </div>
      </div>

      <div class="settings-section">
        <label class="settings-label" for="caption-${blockId}">💬 Caption (Optional)</label>
        <input type="text" 
               id="caption-${blockId}"
               class="image-caption-input" 
               placeholder="Add a caption to describe the image"
               value="${escapeHtml(block.caption || '')}" />
      </div>

      <div class="settings-section">
        <label class="settings-label" for="alt-${blockId}">♿ Alt Text (Accessibility)</label>
        <input type="text" 
               id="alt-${blockId}"
               class="image-alt-input" 
               placeholder="Describe image for screen readers"
               value="${escapeHtml(block.alt || '')}" />
      </div>

      <div class="settings-section">
        <button type="button" class="btn btn-small change-image-btn">🔄 Change Image</button>
      </div>
    </div>
  `;

  // Store current settings
  let currentSettings = {
    alignment: block.alignment || 'center',
    size: block.size || 'medium'
  };

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

  // Image URL input handler
  const imageInput = wrapper.querySelector('.image-url-input');
  const imageSettings = wrapper.querySelector('.image-block-settings');

  imageInput.addEventListener('change', async () => {
    const url = imageInput.value.trim();
    if (url) {
      // Validate URL
      const validation = await validateImageUrl(url);
      if (validation.valid) {
        showImagePreview(url);
        imageSettings.style.display = 'block';
        showNotification('✅ Image loaded successfully', 'success', 2000);
      } else {
        showNotification(`❌ ${validation.error}`, 'error');
        imageSettings.style.display = 'none';
      }
    } else {
      imageSettings.style.display = 'none';
    }
  });

  // Show image preview in URL mode
  function showImagePreview(url) {
    let previewContainer = urlMode.querySelector('.image-preview-container');
    if (!previewContainer) {
      previewContainer = document.createElement('div');
      previewContainer.className = 'image-preview-container';
      urlMode.appendChild(previewContainer);
    }
    previewContainer.innerHTML = `<img class="image-preview" src="${escapeHtml(url)}" alt="Preview" />`;
    previewContainer.style.display = 'block';
  }

  // Upload button handler
  const uploadBtn = wrapper.querySelector('.upload-image-btn');
  const uploadStatus = wrapper.querySelector('.upload-status');
  const uploadPreviewContainer = uploadMode.querySelector('.image-preview-container');
  const uploadPreviewImg = uploadMode.querySelector('.uploaded-image-preview');
  const removeBtn = wrapper.querySelector('.remove-image-btn');

  uploadBtn.addEventListener('click', () => {
    openPhotoUploadModal({
      aspectRatio: 16/9,
      cropShape: 'rectangle',
      showEffects: true,
      onSave: async (blob) => {
        try {
          uploadBtn.disabled = true;
          uploadStatus.textContent = '⏳ Uploading...';
          uploadStatus.style.color = '#f59e0b';

          const pid = problemIdInput.value || 'temp';
          
          // Path format: problem_images/{problemId}/{blockId}
          // uploadPhotoToStorage will add timestamp and .jpg extension
          const path = `problem_images/${pid}/${blockId}`;
          
          const downloadURL = await uploadPhotoToStorage(blob, path);

          imageInput.value = downloadURL;
          uploadPreviewImg.src = downloadURL;
          uploadPreviewContainer.style.display = 'block';
          imageSettings.style.display = 'block';

          uploadStatus.textContent = '✅ Uploaded';
          uploadStatus.style.color = '#10b981';

          showNotification('✅ Image uploaded successfully', 'success');

          setTimeout(() => {
            uploadStatus.textContent = '';
          }, 3000);

        } catch (err) {
          console.error('Upload failed:', err);
          uploadStatus.textContent = '❌ Failed';
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
    imageSettings.style.display = 'none';
  });

  // Alignment buttons
  const alignmentButtons = wrapper.querySelectorAll('.alignment-btn');
  alignmentButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      alignmentButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.alignment = btn.dataset.align;
    });
  });

  // Size buttons
  const sizeButtons = wrapper.querySelectorAll('.size-btn');
  sizeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.size = btn.dataset.size;
    });
  });

  // Change image button
  const changeImageBtn = wrapper.querySelector('.change-image-btn');
  changeImageBtn.addEventListener('click', () => {
    uploadBtn.click();
  });

  // Register block with getter for current settings
  blockRegistry.register(blockId, {
    element: wrapper,
    type: 'image',
    rte: null,
    data: block,
    getImageData: () => ({
      url: imageInput.value.trim(),
      alignment: currentSettings.alignment,
      size: currentSettings.size,
      caption: wrapper.querySelector('.image-caption-input').value.trim(),
      alt: wrapper.querySelector('.image-alt-input').value.trim()
    })
  });

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
        <button type="button" class="btn-icon move-up" title="Move Up">↑</button>
        <button type="button" class="btn-icon move-down" title="Move Down">↓</button>
        <button type="button" class="btn-icon remove-block" title="Remove">✕</button>
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
        <button type="button" class="btn-icon move-up" title="Move Up">↑</button>
        <button type="button" class="btn-icon move-down" title="Move Down">↓</button>
        <button type="button" class="btn-icon remove-block" title="Remove">✕</button>
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
      <button type="button" class="btn-icon remove-solution" title="Remove Solution">✕</button>
    </div>
    <label for="solution-title-${solutionIndex}">Solution Title (optional)</label>
    <input type="text" 
           id="solution-title-${solutionIndex}" 
           class="solution-title" 
           placeholder="e.g., Solution 1, Algebraic Method" 
           value="${escapeHtml(solution.title || '')}">
    <div class="solution-blocks"></div>
    <div class="block-actions">
      <button type="button" class="add-text-solution btn btn-small">➕ Text</button>
      <button type="button" class="add-image-solution btn btn-small">🖼️ Image</button>
    </div>
  `;

  const blocksContainer = wrapper.querySelector('.solution-blocks');

  (solution.blocks || []).forEach(block => {
    const blockElement = createBlockByType(block);
    if (blockElement) {
      blocksContainer.appendChild(blockElement);
    }
  });

  wrapper.querySelector('.add-text-solution').addEventListener('click', () => {
    blocksContainer.appendChild(createTextBlock());
  });

  wrapper.querySelector('.add-image-solution').addEventListener('click', () => {
    blocksContainer.appendChild(createImageBlock());
  });

  wrapper.querySelector('.remove-solution').addEventListener('click', () => {
    if (confirm('Remove this solution?')) {
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
 * Gather all problem data with enhanced image properties
 */
function gatherProblemData() {
  const pid = problemIdInput.value;

  return {
    id: parseInt(pid),
    title: titleInput.value.trim() || `Problem #${pid}`,
    category: categoryInput.value,
    difficulty: difficultyInput.value,
    tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
    statement: gatherBlocksWithEnhancedImages(statementContainer),
    solutions: gatherSolutions(),
    lessons: lessonRefsInput.value.split(',').map(x => x.trim()).filter(Boolean).map(x => parseInt(x)),
    draft: false,
    author: 'admin',
    timestamp: serverTimestamp()
  };
}

/**
 * Gather blocks with enhanced image data
 */
function gatherBlocksWithEnhancedImages(container) {
  const blocks = [];
  const blockElements = container.querySelectorAll('.block-editor');
  
  blockElements.forEach((blockEl) => {
    const blockId = blockEl.dataset.blockId;
    const block = blockRegistry.get(blockId);
    
    if (block) {
      let blockData;
      
      if (block.type === 'image' && block.getImageData) {
        // Use the enhanced getter for image blocks
        const imageData = block.getImageData();
        if (imageData.url && imageData.url.trim().length > 0) {
          blockData = {
            type: 'image',
            ...imageData
          };
        }
      } else {
        blockData = blockRegistry.extractBlockData(block);
      }
      
      if (blockData && blockRegistry.isBlockValid(blockData)) {
        blocks.push(blockData);
      }
    }
  });
  
  return blocks;
}

/**
 * Gather all solutions
 */
function gatherSolutions() {
  const solutions = [];

  solutionsContainer.querySelectorAll('.solution-editor').forEach(solEl => {
    const title = solEl.querySelector('.solution-title').value.trim();
    const blocksContainer = solEl.querySelector('.solution-blocks');
    const blocks = gatherBlocksWithEnhancedImages(blocksContainer);

    solutions.push({ title, blocks });
  });

  return solutions;
}

/**
 * Save problem
 */
async function saveProblem(publish = false) {
  const btn = publish ? publishBtn : saveDraftBtn;
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');

  const problemData = gatherProblemData();
  problemData.draft = !publish;

  console.log('[Save] Gathered problem data:', problemData);

  const validator = new ProblemValidator();
  if (!validator.validate(problemData)) {
    validator.showErrors();
    return;
  }

  if (validator.hasWarnings()) {
    if (!validator.showWarnings()) {
      return;
    }
  }

  btn.disabled = true;
  btnText.style.display = 'none';
  btnSpinner.style.display = 'inline-block';

  try {
    await setDoc(doc(db, 'problems', String(problemData.id)), problemData, { merge: true });

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

    titleInput.value = data.title || '';
    categoryInput.value = data.category || '';
    difficultyInput.value = data.difficulty || 'Medium';
    tagsInput.value = (data.tags || []).join(', ');
    lessonRefsInput.value = (data.lessons || []).join(', ');

    statementContainer.innerHTML = '';
    (data.statement || []).forEach(block => {
      const blockElement = createBlockByType(block);
      if (blockElement) {
        statementContainer.appendChild(blockElement);
      }
    });

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
      `Failed to load problem: ${err.message}\n\nRetry or return to problems list?`
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

  const problemData = gatherProblemData();
  renderPreview(problemData);

  await new Promise(resolve => setTimeout(resolve, 100));

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
 * Render problem preview with enhanced image display
 */
function renderPreview(data) {
  const title = data.title || `Problem #${data.id}`;
  
  document.getElementById('preview-title').textContent = title;
  document.getElementById('preview-id').textContent = `#${data.id}`;
  document.getElementById('preview-category').textContent = data.category || 'General';
  
  const difficultyEl = document.getElementById('preview-difficulty');
  difficultyEl.textContent = data.difficulty;
  difficultyEl.className = `meta-item difficulty-${data.difficulty.toLowerCase()}`;

  const previewTags = document.getElementById('preview-tags');
  previewTags.innerHTML = '';
  (data.tags || []).forEach(tag => {
    previewTags.insertAdjacentHTML('beforeend', `<span class="tag">${escapeHtml(tag)}</span>`);
  });

  const previewStatement = document.getElementById('preview-statement');
  previewStatement.innerHTML = '';
  (data.statement || []).forEach(block => {
    previewStatement.insertAdjacentHTML('beforeend', renderBlockPreview(block));
  });

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
 * Render block with enhanced image support
 */
function renderBlockPreview(block) {
  if (!block) return '';

  switch (block.type) {
    case 'text':
      return `<div class="block-text">${block.content || ''}</div>`;
    
    case 'image':
      const alignment = block.alignment || 'center';
      const size = block.size || 'medium';
      const caption = block.caption || '';
      const alt = block.alt || 'Problem image';
      
      return `
        <div class="image-block-wrapper image-alignment-${alignment} image-size-${size}">
          <img src="${escapeHtml(block.url || '')}" 
               alt="${escapeHtml(alt)}" 
               class="problem-image" 
               loading="lazy" />
          ${caption ? `<div class="image-caption">${escapeHtml(caption)}</div>` : ''}
        </div>
      `;
    
    case 'problem':
      return `<div class="ref-block"><strong>📝 Related Problem:</strong> <a href="../problem.html?id=${escapeHtml(block.problemId || '')}" class="ref-link">Problem #${escapeHtml(block.problemId || '')}</a></div>`;
    
    case 'lesson':
      return `<div class="ref-block"><strong>📚 Related Lesson:</strong> <a href="../lesson.html?id=${escapeHtml(block.lessonId || '')}" class="ref-link">Lesson #${escapeHtml(block.lessonId || '')}</a></div>`;
    
    default:
      return '';
  }
}

/**
 * Check for draft
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

  statementContainer.innerHTML = '';
  (data.statement || []).forEach(block => {
    const blockElement = createBlockByType(block);
    if (blockElement) {
      statementContainer.appendChild(blockElement);
    }
  });

  solutionsContainer.innerHTML = '';
  (data.solutions || []).forEach((solution, index) => {
    solutionsContainer.appendChild(createSolutionEditor(solution, index));
  });
}

/**
 * Enable clipboard image paste for all containers
 */
function enableClipboardImagePaste() {
  document.addEventListener('paste', async (e) => {
    // Check if we're in a text editor (RTE)
    const activeElement = document.activeElement;
    if (activeElement && activeElement.classList.contains('rte-editor')) {
      return; // Let RTE handle it
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) continue;

        // Show notification
        showNotification('📋 Image pasted! Creating image block...', 'info', 2000);

        try {
          // Create a new image block
          const imageBlock = createImageBlock();
          
          // Find the appropriate container (statement or active solution)
          const activeSolution = document.querySelector('.solution-editor:hover, .solution-editor:focus-within');
          const targetContainer = activeSolution 
            ? activeSolution.querySelector('.solution-blocks')
            : statementContainer;
          
          targetContainer.appendChild(imageBlock);

          // Upload the image
          const reader = new FileReader();
          reader.onload = async (event) => {
            const img = new Image();
            img.onload = async () => {
              // Create blob from image
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              
              canvas.toBlob(async (blob) => {
                try {
                  const pid = problemIdInput.value || 'temp';
                  const blockId = imageBlock.dataset.blockId;
                  const path = `problem_images/${pid}/${blockId}`;
                  
                  showNotification('⏳ Uploading pasted image...', 'info');
                  
                  const downloadURL = await uploadPhotoToStorage(blob, path);
                  
                  // Update the image block
                  const urlInput = imageBlock.querySelector('.image-url-input');
                  urlInput.value = downloadURL;
                  urlInput.dispatchEvent(new Event('change'));
                  
                  showNotification('✅ Image pasted and uploaded!', 'success');
                } catch (err) {
                  console.error('Failed to upload pasted image:', err);
                  showNotification('❌ Failed to upload pasted image', 'error');
                  imageBlock.remove();
                }
              }, 'image/jpeg', 0.85);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);

        } catch (err) {
          console.error('Error handling pasted image:', err);
          showNotification('❌ Failed to process pasted image', 'error');
        }
        
        return;
      }
    }
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

  // Enable clipboard paste
  enableClipboardImagePaste();

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
  
  setTimeout(() => {
    checkForDraft();
  }, 500);

  autoSaver.start(() => gatherProblemData());

  console.log('[Init] Enhanced editor initialized successfully with image positioning support');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (autoSaver) {
    autoSaver.stop();
  }
  blockRegistry.clear();
});
