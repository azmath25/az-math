// js/edit-lesson.js
import { db, doc, getDoc, setDoc, serverTimestamp } from "../js/firebase.js";
import { getCurrentUser } from "./auth.js";

// Create block element for editing
function createBlockElement(block = { type: "text", content: "" }) {
  const wrapper = document.createElement("div");
  wrapper.className = "block-editor";
  
  if (block.type === "text") {
    wrapper.innerHTML = `
      <div class="block-header">
        <span>📝 Text Block</span>
        <div class="block-controls">
          <button class="btn-icon move-up" title="Move Up">↑</button>
          <button class="btn-icon move-down" title="Move Down">↓</button>
          <button class="btn-icon remove-block" title="Remove">✕</button>
        </div>
      </div>
      <textarea class="block-textarea" placeholder="Enter text (supports $math$ and $$display math$$)">${escapeHtml(block.content || "")}</textarea>
    `;
  } else if (block.type === "image") {
    wrapper.innerHTML = `
      <div class="block-header">
        <span>🖼️ Image Block</span>
        <div class="block-controls">
          <button class="btn-icon move-up" title="Move Up">↑</button>
          <button class="btn-icon move-down" title="Move Down">↓</button>
          <button class="btn-icon remove-block" title="Remove">✕</button>
        </div>
      </div>
      <input class="block-input" placeholder="Image URL (https://...)" value="${escapeHtml(block.url || "")}">
    `;
  } else if (block.type === "problem") {
    wrapper.innerHTML = `
      <div class="block-header">
        <span>🔗 Problem Reference</span>
        <div class="block-controls">
          <button class="btn-icon move-up" title="Move Up">↑</button>
          <button class="btn-icon move-down" title="Move Down">↓</button>
          <button class="btn-icon remove-block" title="Remove">✕</button>
        </div>
      </div>
      <input class="block-input" placeholder="Problem ID" value="${escapeHtml(block.problemId || "")}">
    `;
  }
  
  // Attach event listeners
  wrapper.querySelector(".remove-block").addEventListener("click", () => wrapper.remove());
  wrapper.querySelector(".move-up").addEventListener("click", () => moveBlock(wrapper, -1));
  wrapper.querySelector(".move-down").addEventListener("click", () => moveBlock(wrapper, 1));
  
  return wrapper;
}

// Move block up or down
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
function gatherBlocks(container) {
  const blocks = [];
  
  container.querySelectorAll(".block-editor").forEach(blockEl => {
    const textarea = blockEl.querySelector(".block-textarea");
    const input = blockEl.querySelector(".block-input");
    
    if (textarea) {
      blocks.push({ type: "text", content: textarea.value });
    } else if (input) {
      const header = blockEl.querySelector(".block-header span").textContent;
      if (header.includes("Image")) {
        blocks.push({ type: "image", url: input.value });
      } else if (header.includes("Problem")) {
        blocks.push({ type: "problem", problemId: input.value });
      }
    }
  });
  
  return blocks;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Render block for preview
function renderBlockPreview(block) {
  if (!block) return "";
  
  switch (block.type) {
    case "text":
      return `<div class="block-text">${escapeHtml(block.content || "")}</div>`;
    case "image":
      return `<div class="block-image"><img src="${escapeHtml(block.url || "")}" style="max-width:100%; border-radius: 8px; margin: 1rem 0;" /></div>`;
    case "problem":
      return `<div class="ref-block"><strong>📝 Related Problem:</strong> <a href="../problem.html?id=${escapeHtml(block.problemId || "")}" class="ref-link">Problem #${escapeHtml(block.problemId || "")}</a></div>`;
    default:
      return "";
  }
}

// Initialize editor
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const lessonId = params.get("id");
  
  const lessonIdInput = document.getElementById("lesson-id");
  const titleInput = document.getElementById("lesson-title");
  const categoryInput = document.getElementById("lesson-category");
  const tagsInput = document.getElementById("lesson-tags");
  const coverInput = document.getElementById("lesson-cover");
  const blocksContainer = document.getElementById("content-blocks");
  const problemRefsInput = document.getElementById("problem-refs");
  
  const addTextBtn = document.getElementById("add-text-block");
  const addImageBtn = document.getElementById("add-image-block");
  const addProblemRefBtn = document.getElementById("add-problem-ref");
  const saveDraftBtn = document.getElementById("save-draft-btn");
  const publishBtn = document.getElementById("publish-btn");
  const previewBtn = document.getElementById("preview-btn");
  
  // Add block handlers
  addTextBtn.addEventListener("click", () => {
    blocksContainer.appendChild(createBlockElement({ type: "text", content: "" }));
  });
  addImageBtn.addEventListener("click", () => {
    blocksContainer.appendChild(createBlockElement({ type: "image", url: "" }));
  });
  addProblemRefBtn.addEventListener("click", () => {
    blocksContainer.appendChild(createBlockElement({ type: "problem", problemId: "" }));
  });
  
  // Load existing lesson if ID provided
  if (lessonId) {
    lessonIdInput.value = lessonId;
    
    try {
      const lessonDoc = await getDoc(doc(db, "lessons", String(lessonId)));
      
      if (lessonDoc.exists()) {
        const data = lessonDoc.data();
        
        titleInput.value = data.title || "";
        categoryInput.value = data.category || "";
        tagsInput.value = (data.tags || []).join(", ");
        coverInput.value = data.cover || "";
        problemRefsInput.value = (data.problems || []).join(", ");
        
        // Load content blocks
        blocksContainer.innerHTML = "";
        (data.blocks || []).forEach(block => {
          blocksContainer.appendChild(createBlockElement(block));
        });
      }
    } catch (err) {
      console.error("Error loading lesson:", err);
      alert("Error loading lesson: " + err.message);
    }
  }
  
  // Save lesson
  async function saveLesson(publish = false) {
    const lid = lessonIdInput.value;
    if (!lid) {
      alert("Lesson ID is required");
      return;
    }
    
    if (!titleInput.value.trim()) {
      alert("Lesson title is required");
      titleInput.focus();
      return;
    }
    
    // Get current user info
    const currentUser = await getCurrentUser();
    const authorName = currentUser?.name || currentUser?.email || "Unknown";
    
    const payload = {
      id: parseInt(lid),
      title: titleInput.value.trim(),
      category: categoryInput.value,
      tags: tagsInput.value.split(",").map(t => t.trim()).filter(Boolean),
      cover: coverInput.value.trim(),
      blocks: gatherBlocks(blocksContainer),
      problems: problemRefsInput.value.split(",").map(x => x.trim()).filter(Boolean).map(x => parseInt(x)),
      draft: !publish,
      author: authorName,
      timestamp: serverTimestamp()
    };
    
    try {
      await setDoc(doc(db, "lessons", String(lid)), payload, { merge: true });
      alert(publish ? "Lesson published successfully!" : "Draft saved successfully!");
      
      if (publish) {
        window.location.href = "lessons.html";
      }
    } catch (err) {
      console.error("Error saving lesson:", err);
      alert("Failed to save: " + err.message);
    }
  }
  
  saveDraftBtn.addEventListener("click", () => saveLesson(false));
  publishBtn.addEventListener("click", () => saveLesson(true));
  
  // Preview
  previewBtn.addEventListener("click", () => {
    const editorForm = document.getElementById("editor-form");
    const previewMode = document.getElementById("preview-mode");
    
    // Toggle mode
    if (previewMode.style.display === "block") {
      editorForm.style.display = "block";
      previewMode.style.display = "none";
      previewBtn.textContent = "👁️ Preview";
      return;
    }
    
    // Switch to preview
    editorForm.style.display = "none";
    previewMode.style.display = "block";
    previewBtn.textContent = "✏️ Edit";
    
    // Render preview
    const title = titleInput.value || `Lesson #${lessonIdInput.value}`;
    document.getElementById("preview-title").textContent = title;
    document.getElementById("preview-id").textContent = `#${lessonIdInput.value}`;
    document.getElementById("preview-category").textContent = categoryInput.value || "General";
    
    // Tags
    const previewTags = document.getElementById("preview-tags");
    previewTags.innerHTML = "";
    tagsInput.value.split(",").map(t => t.trim()).filter(Boolean).forEach(tag => {
      previewTags.insertAdjacentHTML("beforeend", `<span class="tag">${escapeHtml(tag)}</span>`);
    });
    
    // Cover image
    const coverUrl = coverInput.value.trim();
    if (coverUrl) {
      document.getElementById("preview-cover-container").style.display = "block";
      document.getElementById("preview-cover").src = coverUrl;
      document.getElementById("preview-cover").alt = title;
    } else {
      document.getElementById("preview-cover-container").style.display = "none";
    }
    
    // Content
    const previewContent = document.getElementById("preview-content");
    previewContent.innerHTML = "";
    gatherBlocks(blocksContainer).forEach(block => {
      previewContent.insertAdjacentHTML("beforeend", renderBlockPreview(block));
    });
    
    // Typeset MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([previewMode]).catch(err => {
        console.error("MathJax error:", err);
      });
    }
  });
});
