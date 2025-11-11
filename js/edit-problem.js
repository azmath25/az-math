// js/edit-problem.js - UPDATED TO USE REUSABLE RTE
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
import { createRichTextEditor } from "../js/rte.js"; // ← ADD THIS IMPORT

let solutionCounter = 0;

// REMOVE OLD FUNCTIONS:
// - createRichTextToolbar()
// - initializeRichTextEditor()
// - handleCommand()
// - showMathModal()
// - getRichTextContent()

// CREATE BLOCK ELEMENT - UPDATED VERSION
function createBlockElement(block = { type: "text", content: "" }) {
  const wrapper = document.createElement("div");
  wrapper.className = "block-editor";
  
  if (block.type === "text") {
    // Create block header
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
    
    // Create container for RTE
    const editorContainer = document.createElement("div");
    editorContainer.className = "rte-container";
    wrapper.appendChild(editorContainer);
    
    // Create reusable rich text editor instance
    const rteInstance = createRichTextEditor(editorContainer, {
      initialContent: block.content || '',
      placeholder: 'Type your content here... Use $math$ for inline math or $$math$$ for display math',
      minHeight: '150px',
      maxHeight: '400px',
      toolbar: ['bold', 'italic', 'underline', 'headings', 'lists', 'align', 'link', 'math', 'clear']
    });
    
    // Store instance on wrapper for later retrieval
    wrapper._rteInstance = rteInstance;
    
  } else if (block.type === "image") {
    // ... your existing image block code ...
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
    
    // Your existing image block event listeners...
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
    
    const uploadArea = wrapper.querySelector(".image-upload-area");
    if (uploadArea) {
      uploadArea.addEventListener("click", () => {
        handleImageUpload(wrapper);
      });
    }
    
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
  
  // Attach common event listeners
  wrapper.querySelector(".remove-block").addEventListener("click", () => {
    // Cleanup RTE instance if exists
    if (wrapper._rteInstance) {
      wrapper._rteInstance.destroy();
    }
    wrapper.remove();
  });
  wrapper.querySelector(".move-up").addEventListener("click", () => moveBlock(wrapper, -1));
  wrapper.querySelector(".move-down").addEventListener("click", () => moveBlock(wrapper, 1));
  
  return wrapper;
}

// GATHER BLOCKS - UPDATED VERSION
function gatherBlocksFromContainer(container) {
  const blocks = [];
  
  container.querySelectorAll(".block-editor").forEach(blockEl => {
    // Check for RTE instance (text blocks)
    if (blockEl._rteInstance) {
      blocks.push({ 
        type: "text", 
        content: blockEl._rteInstance.getContent() 
      });
      return;
    }
    
    // Check for image blocks
    const urlInput = blockEl.querySelector(".image-url-input");
    if (urlInput) {
      const uploadMode = blockEl.querySelector(".mode-btn.active")?.dataset.mode || "url";
      blocks.push({ 
        type: "image", 
        url: urlInput.value,
        uploadMode: uploadMode
      });
      return;
    }
    
    // Check for problem/lesson refs
    const input = blockEl.querySelector(".block-input");
    if (input) {
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

// Your existing functions remain the same:
// - handleImageUpload()
// - moveBlock()
// - renderSolutionUI()
// - escapeHtml()
// - renderBlockPreview()

// The rest of your DOMContentLoaded code remains exactly the same
document.addEventListener("DOMContentLoaded", async () => {
  // ... all your existing initialization code ...
});
