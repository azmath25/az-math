// js/edit-problem.js
import {
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "../js/firebase.js";

import { populateCategorySelect } from "../js/categories-utils.js";
import { openPhotoUploadModal, uploadPhotoToStorage } from "../js/photo-utils.js";
import { auth } from "../js/firebase.js";

let solutionCounter = 0;

// Create rich text editor toolbar
function createRichTextToolbar(editor) {
  const toolbar = document.createElement("div");
  toolbar.className = "rte-toolbar";
  
  toolbar.innerHTML = `
    <div class="rte-toolbar-group">
      <button type="button" class="rte-btn" data-command="bold" title="Bold (Ctrl+B)">
        <strong>B</strong>
      </button>
      <button type="button" class="rte-btn" data-command="italic" title="Italic (Ctrl+I)">
        <em>I</em>
      </button>
      <button type="button" class="rte-btn" data-command="underline" title="Underline (Ctrl+U)">
        <u>U</u>
      </button>
    </div>
    
    <div class="rte-toolbar-divider"></div>
    
    <div class="rte-toolbar-group">
      <select class="rte-select" data-command="formatBlock">
        <option value="">Normal</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
      </select>
      
      <select class="rte-select" data-command="fontSize">
        <option value="">Normal Size</option>
        <option value="1">Very Small</option>
        <option value="2">Small</option>
        <option value="3">Normal</option>
        <option value="4">Large</option>
        <option value="5">Very Large</option>
        <option value="6">Huge</option>
      </select>
    </div>
    
    <div class="rte-toolbar-divider"></div>
    
    <div class="rte-toolbar-group">
      <button type="button" class="rte-btn" data-command="insertUnorderedList" title="Bullet List">
        • List
      </button>
      <button type="button" class="rte-btn" data-command="insertOrderedList" title="Numbered List">
        1. List
      </button>
    </div>
    
    <div class="rte-toolbar-divider"></div>
    
    <div class="rte-toolbar-group">
      <button type="button" class="rte-btn" data-command="justifyLeft" title="Align Left">
        ⬅
      </button>
      <button type="button" class="rte-btn" data-command="justifyCenter" title="Align Center">
        ↔
      </button>
      <button type="button" class="rte-btn" data-command="justifyRight" title="Align Right">
        ➡
      </button>
    </div>
    
    <div class="rte-toolbar-divider"></div>
    
    <div class="rte-toolbar-group">
      <button type="button" class="rte-btn" data-command="createLink" title="Insert Link">
        🔗
      </button>
      <button type="button" class="rte-btn" data-command="insertMath" title="Insert Math (LaTeX)">
        𝑓(x)
      </button>
    </div>
    
    <div class="rte-toolbar-divider"></div>
    
    <div class="rte-toolbar-group">
      <button type="button" class="rte-btn" data-command="removeFormat" title="Clear Formatting">
        ✕
      </button>
    </div>
  `;
  
  return toolbar;
}

// Initialize rich text editor
function initializeRichTextEditor(container, initialContent = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "rte-wrapper";
  
  const toolbar = createRichTextToolbar();
  wrapper.appendChild(toolbar);
  
  const editorDiv = document.createElement("div");
  editorDiv.className = "rte-editor";
  editorDiv.contentEditable = true;
  editorDiv.innerHTML = initialContent || '<p><br></p>';
  editorDiv.setAttribute("data-placeholder", "Type your content here... Use $math$ for inline math and $$math$$ for display math");
  
  wrapper.appendChild(editorDiv);
  container.appendChild(wrapper);
  
  // Attach toolbar event listeners
  toolbar.querySelectorAll(".rte-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const command = btn.dataset.command;
      handleCommand(command, editorDiv);
    });
  });
  
  toolbar.querySelectorAll(".rte-select").forEach(select => {
    select.addEventListener("change", (e) => {
      const command = select.dataset.command;
      const value = select.value;
      if (value) {
        document.execCommand(command, false, value);
        editorDiv.focus();
      }
      select.value = "";
    });
  });
  
  // Keyboard shortcuts
  editorDiv.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          document.execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          document.execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          document.execCommand('underline');
          break;
      }
    }
  });
  
  return { wrapper, editorDiv };
}

// Handle toolbar commands
function handleCommand(command, editor) {
  editor.focus();
  
  switch(command) {
    case 'createLink':
      const url = prompt("Enter URL:", "https://");
      if (url) {
        document.execCommand('createLink', false, url);
      }
      break;
      
    case 'insertMath':
      showMathModal(editor);
      break;
      
    default:
      document.execCommand(command, false, null);
  }
}

// Show math insertion modal
function showMathModal(editor) {
  const modal = document.createElement("div");
  modal.className = "math-modal-overlay";
  
  modal.innerHTML = `
    <div class="math-modal">
      <h3>Insert Math (LaTeX)</h3>
      
      <div class="math-mode-selector">
        <label>
          <input type="radio" name="math-mode" value="inline" checked />
          Inline Math: $...$
        </label>
        <label>
          <input type="radio" name="math-mode" value="display" />
          Display Math: $$...$$
        </label>
      </div>
      
      <label>LaTeX Code</label>
      <textarea id="math-latex-input" placeholder="e.g., x^2 + y^2 = r^2" rows="4"></textarea>
      
      <div class="math-preview" id="math-preview-area">
        <small>Preview will appear here</small>
      </div>
      
      <div class="math-modal-actions">
        <button type="button" class="btn btn-secondary" id="math-cancel-btn">Cancel</button>
        <button type="button" class="btn" id="math-insert-btn">Insert</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const latexInput = modal.querySelector("#math-latex-input");
  const previewArea = modal.querySelector("#math-preview-area");
  const cancelBtn = modal.querySelector("#math-cancel-btn");
  const insertBtn = modal.querySelector("#math-insert-btn");
  const modeRadios = modal.querySelectorAll('input[name="math-mode"]');
  
  latexInput.focus();
  
  // Live preview
  let previewTimeout;
  latexInput.addEventListener("input", () => {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
      const latex = latexInput.value.trim();
      if (latex) {
        const mode = modal.querySelector('input[name="math-mode"]:checked').value;
        const wrapped = mode === 'inline' ? `$${latex}$` : `$$${latex}$$`;
        previewArea.innerHTML = wrapped;
        
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([previewArea]).catch(err => {
            previewArea.innerHTML = '<small style="color: red;">Invalid LaTeX</small>';
          });
        }
      } else {
        previewArea.innerHTML = '<small>Preview will appear here</small>';
      }
    }, 500);
  });
  
  const closeModal = () => modal.remove();
  
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  
  insertBtn.addEventListener("click", () => {
    const latex = latexInput.value.trim();
    if (!latex) {
      alert("Please enter LaTeX code");
      return;
    }
    
    const mode = modal.querySelector('input[name="math-mode"]:checked').value;
    const mathText = mode === 'inline' ? `$${latex}$` : `$$${latex}$$`;
    
    // Insert into editor
    document.execCommand('insertHTML', false, `<span class="math-formula">${mathText}</span>&nbsp;`);
    editor.focus();
    
    closeModal();
  });
}

// Get content from rich text editor
function getRichTextContent(editorDiv) {
  return editorDiv.innerHTML;
}

// Create block element for editing
function createBlockElement(block = { type: "text", content: "" }) {
  const wrapper = document.createElement("div");
  wrapper.className = "block-editor";
  
  if (block.type === "text") {
    wrapper.innerHTML = `
      <div class="block-header">
        <span>📝 Text Block</span>
        <div class="block-controls">
          <button type="button" class="btn-icon move-up" title="Move Up">↑</button>
          <button type="button" class="btn-icon move-down" title="Move Down">↓</button>
          <button type="button" class="btn-icon remove-block" title="Remove">✕</button>
        </div>
      </div>
    `;
    
    const editorContainer = document.createElement("div");
    editorContainer.className = "rte-container";
    wrapper.appendChild(editorContainer);
    
    // Initialize rich text editor
    initializeRichTextEditor(editorContainer, block.content || "");
    
  } else if (block.type === "image") {
    wrapper.innerHTML = `
      <div class="block-header">
        <span>🖼️ Image Block</span>
        <div class="block-controls">
          <button type="button" class="btn-icon move-up" title="Move Up">↑</button>
          <button type="button" class="btn-icon move-down" title="Move Down">↓</button>
          <button type="button" class="btn-icon remove-block" title="Remove">✕</button>
        </div>
      </div>
      <div class="image-upload-mode">
        <button type="button" class="mode-btn ${block.uploadMode === 'upload' ? '' : 'active'}" data-mode="url">🔗 URL</button>
        <button type="button" class="mode-btn ${block.uploadMode === 'upload' ? 'active' : ''}" data-mode="upload">📤 Upload</button>
      </div>
      <div class="image-input-container">
        <div class="url-mode" style="display: ${block.uploadMode === 'upload' ? 'none' : 'block'};">
          <input type="url" class="image-url-input" placeholder="Image URL (https://...)" value="${escapeHtml(block.url || "")}" />
        </div>
        <div class="upload-mode" style="display: ${block.uploadMode === 'upload' ? 'block' : 'none'};">
          <div class="image-upload-area">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <p>Click to upload image</p>
            <p class="upload-hint">JPG, PNG, or GIF (Max 5MB)</p>
          </div>
        </div>
        ${block.url ? `
          <div class="image-preview-container">
            <img src="${escapeHtml(block.url)}" alt="Preview" />
            <button type="button" class="remove-preview">Remove Image</button>
          </div>
        ` : ''}
      </div>
    `;
    
    // Mode toggle
    wrapper.querySelectorAll(".mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        wrapper.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        wrapper.querySelector(".url-mode").style.display = mode === "url" ? "block" : "none";
        wrapper.querySelector(".upload-mode").style.display = mode === "upload" ? "block" : "none";
        
        wrapper.dataset.uploadMode = mode;
      });
    });
    
    // Upload area click
    const uploadArea = wrapper.querySelector(".image-upload-area");
    if (uploadArea) {
      uploadArea.addEventListener("click", () => {
        handleImageUpload(wrapper);
      });
    }
    
    // Remove preview
    const removeBtn = wrapper.querySelector(".remove-preview");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        const previewContainer = wrapper.querySelector(".image-preview-container");
        if (previewContainer) previewContainer.remove();
        wrapper.querySelector(".image-url-input").value = "";
      });
    }
    
  } else if (block.type === "problem") {
    wrapper.innerHTML = `
      <div class="block-header">
        <span>🔗 Problem Reference</span>
        <div class="block-controls">
          <button type="button" class="btn-icon move-up" title="Move Up">↑</button>
          <button type="button" class="btn-icon move-down" title="Move Down">↓</button>
          <button type="button" class="btn-icon remove-block" title="Remove">✕</button>
        </div>
      </div>
      <input type="text" class="block-input" placeholder="Problem ID" value="${escapeHtml(block.problemId || "")}">
    `;
  } else if (block.type === "lesson") {
    wrapper.innerHTML = `
      <div class="block-header">
        <span>📚 Lesson Reference</span>
        <div class="block-controls">
          <button type="button" class="btn-icon move-up" title="Move Up">↑</button>
          <button type="button" class="btn-icon move-down" title="Move Down">↓</button>
          <button type="button" class="btn-icon remove-block" title="Remove">✕</button>
        </div>
      </div>
      <input type="text" class="block-input" placeholder="Lesson ID" value="${escapeHtml(block.lessonId || "")}">
    `;
  }
  
  // Attach event listeners
  wrapper.querySelector(".remove-block").addEventListener("click", () => wrapper.remove());
  wrapper.querySelector(".move-up").addEventListener("click", () => moveBlock(wrapper, -1));
  wrapper.querySelector(".move-down").addEventListener("click", () => moveBlock(wrapper, 1));
  
  return wrapper;
}

// Handle image upload with rectangular cropper
async function handleImageUpload(wrapper) {
  openPhotoUploadModal({
    currentPhotoURL: null,
    aspectRatio: 16 / 9,
    cropShape: 'rectangle',
    onSave: async (blob) => {
      try {
        const user = auth.currentUser;
        if (!user) {
          alert("You must be logged in to upload images");
          return;
        }
        
        const uploadArea = wrapper.querySelector(".image-upload-area");
        if (uploadArea) {
          uploadArea.innerHTML = `
            <p style="color: #667eea; font-weight: 600;">Uploading...</p>
            <div style="margin-top: 1rem; font-size: 2rem;">⏳</div>
          `;
        }
        
        const imageUrl = await uploadPhotoToStorage(blob, `problem_images/${user.uid}`);
        
        const urlInput = wrapper.querySelector(".image-url-input");
        if (urlInput) {
          urlInput.value = imageUrl;
        }
        
        const existingPreview = wrapper.querySelector(".image-preview-container");
        if (existingPreview) {
          existingPreview.remove();
        }
        
        const container = wrapper.querySelector(".image-input-container");
        const previewDiv = document.createElement("div");
        previewDiv.className = "image-preview-container";
        previewDiv.innerHTML = `
          <img src="${imageUrl}" alt="Preview" />
          <button type="button" class="remove-preview">Remove Image</button>
        `;
        container.appendChild(previewDiv);
        
        previewDiv.querySelector(".remove-preview").addEventListener("click", () => {
          previewDiv.remove();
          if (urlInput) urlInput.value = "";
        });
        
        if (uploadArea) {
          uploadArea.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <p>Click to upload image</p>
            <p class="upload-hint">JPG, PNG, or GIF (Max 5MB)</p>
          `;
        }
        
      } catch (err) {
        console.error("Error uploading image:", err);
        alert("Failed to upload image: " + err.message);
      }
    },
    onCancel: () => {}
  });
}

// Move block
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

// Gather blocks from container
function gatherBlocksFromContainer(container) {
  const blocks = [];
  
  container.querySelectorAll(".block-editor").forEach(blockEl => {
    const rteEditor = blockEl.querySelector(".rte-editor");
    const input = blockEl.querySelector(".block-input");
    const urlInput = blockEl.querySelector(".image-url-input");
    
    if (rteEditor) {
      blocks.push({ type: "text", content: getRichTextContent(rteEditor) });
    } else if (urlInput) {
      const uploadMode = blockEl.querySelector(".mode-btn.active")?.dataset.mode || "url";
      blocks.push({ 
        type: "image", 
        url: urlInput.value,
        uploadMode: uploadMode
      });
    } else if (input) {
      const header = blockEl.querySelector(".block-header span").textContent;
      if (header.includes("Problem")) {
        blocks.push({ type: "problem", problemId: input.value });
      } else if (header.includes("Lesson")) {
        blocks.push({ type: "lesson", lessonId: input.value });
      }
    }
  });
  
  return blocks;
}

// Render solution editor
function renderSolutionUI(solution) {
  const container = document.createElement("div");
  container.className = "solution-editor";
  container.dataset.solutionId = solution.id;
  
  container.innerHTML = `
    <div class="solution-header">
      <h3>Solution ${solution.id}</h3>
      <button type="button" class="btn btn-small btn-delete remove-solution">Remove Solution</button>
    </div>
  `;
  
  const blocksContainer = document.createElement("div");
  blocksContainer.className = "blocks-container";
  
  (solution.blocks || []).forEach(block => {
    blocksContainer.appendChild(createBlockElement(block));
  });
  
  const actions = document.createElement("div");
  actions.className = "block-actions";
  actions.innerHTML = `
    <button type="button" class="btn btn-small add-text">➕ Text</button>
    <button type="button" class="btn btn-small add-image">🖼️ Image</button>
    <button type="button" class="btn btn-small add-problem">🔗 Problem Ref</button>
    <button type="button" class="btn btn-small add-lesson">📚 Lesson Ref</button>
  `;
  
  container.appendChild(blocksContainer);
  container.appendChild(actions);
  
  actions.querySelector(".add-text").addEventListener("click", () => {
    blocksContainer.appendChild(createBlockElement({ type: "text", content: "" }));
  });
  actions.querySelector(".add-image").addEventListener("click", () => {
    blocksContainer.appendChild(createBlockElement({ type: "image", url: "" }));
  });
  actions.querySelector(".add-problem").addEventListener("click", () => {
    blocksContainer.appendChild(createBlockElement({ type: "problem", problemId: "" }));
  });
  actions.querySelector(".add-lesson").addEventListener("click", () => {
    blocksContainer.appendChild(createBlockElement({ type: "lesson", lessonId: "" }));
  });
  
  container.querySelector(".remove-solution").addEventListener("click", () => {
    if (confirm("Remove this solution?")) {
      container.remove();
    }
  });
  
  return container;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Render block preview
function renderBlockPreview(block) {
  if (!block) return "";
  
  switch (block.type) {
    case "text":
      return `<div class="block-text">${block.content || ""}</div>`;
    case "image":
      return `<div class="block-image"><img src="${escapeHtml(block.url || "")}" alt="Problem image" style="max-width:100%; border-radius: 8px; margin: 1rem 0;" /></div>`;
    case "problem":
      return `<div class="ref-block"><strong>📝 Related Problem:</strong> <a href="../problem.html?id=${escapeHtml(block.problemId || "")}" class="ref-link">Problem #${escapeHtml(block.problemId || "")}</a></div>`;
    case "lesson":
      return `<div class="ref-block"><strong>📚 Related Lesson:</strong> <a href="../lesson.html?id=${escapeHtml(block.lessonId || "")}" class="ref-link">Lesson #${escapeHtml(block.lessonId || "")}</a></div>`;
    default:
      return "";
  }
}

// Initialize editor
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const problemId = params.get("id");
  
  const problemIdInput = document.getElementById("problem-id");
  const titleInput = document.getElementById("problem-title");
  const categoryInput = document.getElementById("problem-category");
  const difficultyInput = document.getElementById("problem-difficulty");
  const tagsInput = document.getElementById("problem-tags");
  const statementBlocks = document.getElementById("statement-blocks");
  const solutionsContainer = document.getElementById("solutions-container");
  const lessonRefsInput = document.getElementById("lesson-refs");
  
  const addTextBtn = document.getElementById("add-text-statement");
  const addImageBtn = document.getElementById("add-image-statement");
  const addProblemRefBtn = document.getElementById("add-problem-ref-statement");
  const addLessonRefBtn = document.getElementById("add-lesson-ref-statement");
  const addSolutionBtn = document.getElementById("add-solution-btn");
  const saveDraftBtn = document.getElementById("save-draft-btn");
  const publishBtn = document.getElementById("publish-btn");
  const previewBtn = document.getElementById("preview-btn");
  
  let currentCategory = '';
  if (problemId) {
    try {
      const problemDoc = await getDoc(doc(db, "problems", String(problemId)));
      if (problemDoc.exists()) {
        currentCategory = problemDoc.data().category || '';
      }
    } catch (err) {
      console.error("Error loading problem for category:", err);
    }
  }
  
  await populateCategorySelect(categoryInput, currentCategory);
  
  addTextBtn.addEventListener("click", () => {
    statementBlocks.appendChild(createBlockElement({ type: "text", content: "" }));
  });
  addImageBtn.addEventListener("click", () => {
    statementBlocks.appendChild(createBlockElement({ type: "image", url: "" }));
  });
  addProblemRefBtn.addEventListener("click", () => {
    statementBlocks.appendChild(createBlockElement({ type: "problem", problemId: "" }));
  });
  addLessonRefBtn.addEventListener("click", () => {
    statementBlocks.appendChild(createBlockElement({ type: "lesson", lessonId: "" }));
  });
  
  addSolutionBtn.addEventListener("click", () => {
    solutionCounter++;
    solutionsContainer.appendChild(renderSolutionUI({ id: solutionCounter, blocks: [] }));
  });
  
  if (problemId) {
    problemIdInput.value = problemId;
    
    try {
      const problemDoc = await getDoc(doc(db, "problems", String(problemId)));
      
      if (problemDoc.exists()) {
        const data = problemDoc.data();
        
        titleInput.value = data.title || "";
        categoryInput.value = data.category || "";
        difficultyInput.value = data.difficulty || "Medium";
        tagsInput.value = (data.tags || []).join(", ");
        lessonRefsInput.value = (data.lessons || []).join(", ");
        
        statementBlocks.innerHTML = "";
        (data.statement || []).forEach(block => {
          statementBlocks.appendChild(createBlockElement(block));
        });
        
        solutionsContainer.innerHTML = "";
        (data.solutions || []).forEach(solution => {
          if (solution.id > solutionCounter) solutionCounter = solution.id;
          solutionsContainer.appendChild(renderSolutionUI(solution));
        });
      }
    } catch (err) {
      console.error("Error loading problem:", err);
      alert("Error loading problem: " + err.message);
    }
  }
  
  async function saveProblem(publish = false) {
    const pid = problemIdInput.value;
    if (!pid) {
      alert("Problem ID is required");
      return;
    }
    
    const solutions = [];
    solutionsContainer.querySelectorAll(".solution-editor").forEach((solEl, index) => {
      const solId = parseInt(solEl.dataset.solutionId) || (index + 1);
      const blocksContainer = solEl.querySelector(".blocks-container");
      solutions.push({
        id: solId,
        blocks: gatherBlocksFromContainer(blocksContainer)
      });
    });
    
    const payload = {
      id: parseInt(pid),
      title: titleInput.value.trim() || null,
      category: categoryInput.value,
      difficulty: difficultyInput.value,
      tags: tagsInput.value.split(",").map(t => t.trim()).filter(Boolean),
      statement: gatherBlocksFromContainer(statementBlocks),
      solutions: solutions,
      lessons: lessonRefsInput.value.split(",").map(x => x.trim()).filter(Boolean).map(x => parseInt(x)),
      draft: !publish,
      author: "admin",
      timestamp: serverTimestamp()
    };
    
    try {
      await setDoc(doc(db, "problems", String(pid)), payload, { merge: true });
      alert(publish ? "Problem published successfully!" : "Draft saved successfully!");
      
      if (publish) {
        window.location.href = "problems.html";
      }
    } catch (err) {
      console.error("Error saving problem:", err);
      alert("Failed to save: " + err.message);
    }
  }
  
  saveDraftBtn.addEventListener("click", () => saveProblem(false));
  publishBtn.addEventListener("click", () => saveProblem(true));
  
  previewBtn.addEventListener("click", () => {
    const editorForm = document.getElementById("editor-form");
    const previewMode = document.getElementById("preview-mode");
    
    if (previewMode.style.display === "block") {
      editorForm.style.display = "block";
      previewMode.style.display = "none";
      previewBtn.textContent = "👁️ Preview";
      return;
    }
    
    editorForm.style.display = "none";
    previewMode.style.display = "block";
    previewBtn.textContent = "✏️ Edit";
    
    const title = titleInput.value || `Problem #${problemIdInput.value}`;
    document.getElementById("preview-title").textContent = title;
    document.getElementById("preview-id").textContent = `#${problemIdInput.value}`;
    document.getElementById("preview-category").textContent = categoryInput.value || "General";
    document.getElementById("preview-difficulty").textContent = difficultyInput.value;
    
    const previewTags = document.getElementById("preview-tags");
    previewTags.innerHTML = "";
    tagsInput.value.split(",").map(t => t.trim()).filter(Boolean).forEach(tag => {
      previewTags.insertAdjacentHTML("beforeend", `<span class="tag">${escapeHtml(tag)}</span>`);
    });
    
    const previewStatement = document.getElementById("preview-statement");
    previewStatement.innerHTML = "";
    gatherBlocksFromContainer(statementBlocks).forEach(block => {
      previewStatement.insertAdjacentHTML("beforeend", renderBlockPreview(block));
    });
    
    const previewSolutions = document.getElementById("preview-solutions");
    previewSolutions.innerHTML = "";
    
    solutionsContainer.querySelectorAll(".solution-editor").forEach((solEl, index) => {
      const solDiv = document.createElement("div");
      solDiv.className = "solution-block";
      solDiv.innerHTML = `<h3>Solution ${index + 1}</h3>`;
      
      const blocksContainer = solEl.querySelector(".blocks-container");
      gatherBlocksFromContainer(blocksContainer).forEach(block => {
        solDiv.insertAdjacentHTML("beforeend", renderBlockPreview(block));
      });
      
      previewSolutions.appendChild(solDiv);
    });
    
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([previewMode]).catch(err => {
        console.error("MathJax error:", err);
      });
    }
  });
});
