// js/edit-problem.js - Fixed with RTE Integration
import { db, doc, getDoc, setDoc, serverTimestamp } from "./firebase.js";
import { populateCategorySelect } from "./categories-utils.js";
import { createRichTextEditor } from "./rte.js";

// Store RTE instances for cleanup
const rteInstances = new Map();

// Create block element with RTE for text blocks
function createBlockElement(block = { type: "text", content: "" }, blockId = Date.now()) {
  const wrapper = document.createElement("div");
  wrapper.className = "block-editor";
  wrapper.dataset.blockId = blockId;
  
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
      <div class="rte-container"></div>
    `;
    
    // Create RTE instance
    const container = wrapper.querySelector('.rte-container');
    const rte = createRichTextEditor(container, {
      initialContent: block.content || '',
      placeholder: 'Enter problem text (supports math with $...$ and $$...$$)',
      minHeight: '150px'
    });
    
    // Store instance for later retrieval
    rteInstances.set(blockId, rte);
    
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
      <input type="text" class="block-input" placeholder="Image URL (https://...)" value="${escapeHtml(block.url || "")}">
    `;
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
  wrapper.querySelector(".remove-block").addEventListener("click", () => {
    // Clean up RTE instance if it exists
    if (rteInstances.has(blockId)) {
      rteInstances.get(blockId).destroy();
      rteInstances.delete(blockId);
    }
    wrapper.remove();
  });
  
  wrapper.querySelector(".move-up").addEventListener("click", () => moveBlock(wrapper, -1));
  wrapper.querySelector(".move-down").addEventListener("click", () => moveBlock(wrapper, 1));
  
  return wrapper;
}

// Create solution editor with RTE
function createSolutionEditor(solution = { title: "", blocks: [] }, solutionIndex) {
  const wrapper = document.createElement("div");
  wrapper.className = "solution-editor";
  wrapper.dataset.solutionIndex = solutionIndex;
  
  wrapper.innerHTML = `
    <div class="solution-header">
      <h3>Solution ${solutionIndex + 1}</h3>
      <button type="button" class="btn-icon remove-solution" title="Remove Solution">✕</button>
    </div>
    <label>Solution Title (optional)</label>
    <input type="text" class="solution-title" placeholder="e.g., Solution 1, Algebraic Method" value="${escapeHtml(solution.title || "")}">
    <div class="solution-blocks"></div>
    <div class="block-actions">
      <button type="button" class="add-text-solution btn btn-small">➕ Text</button>
      <button type="button" class="add-image-solution btn btn-small">🖼️ Image</button>
    </div>
  `;
  
  const blocksContainer = wrapper.querySelector(".solution-blocks");
  
  // Load existing blocks
  (solution.blocks || []).forEach(block => {
    const blockId = Date.now() + Math.random();
    blocksContainer.appendChild(createBlockElement(block, blockId));
  });
  
  // Add block buttons
  wrapper.querySelector(".add-text-solution").addEventListener("click", () => {
    const blockId = Date.now() + Math.random();
    blocksContainer.appendChild(createBlockElement({ type: "text" }, blockId));
  });
  
  wrapper.querySelector(".add-image-solution").addEventListener("click", () => {
    const blockId = Date.now() + Math.random();
    blocksContainer.appendChild(createBlockElement({ type: "image" }, blockId));
  });
  
  // Remove solution
  wrapper.querySelector(".remove-solution").addEventListener("click", () => {
    // Clean up all RTE instances in this solution
    wrapper.querySelectorAll('.block-editor').forEach(blockEl => {
      const blockId = blockEl.dataset.blockId;
      if (blockId && rteInstances.has(parseInt(blockId))) {
        rteInstances.get(parseInt(blockId)).destroy();
        rteInstances.delete(parseInt(blockId));
      }
    });
    wrapper.remove();
  });
  
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
    const blockId = blockEl.dataset.blockId;
    const input = blockEl.querySelector(".block-input");
    
    // Check if this is a text block with RTE
    if (blockId && rteInstances.has(parseInt(blockId))) {
      const rte = rteInstances.get(parseInt(blockId));
      blocks.push({ type: "text", content: rte.getContent() });
    } else if (input) {
      const header = blockEl.querySelector(".block-header span").textContent;
      if (header.includes("Image")) {
        blocks.push({ type: "image", url: input.value });
      } else if (header.includes("Problem")) {
        blocks.push({ type: "problem", problemId: input.value });
      } else if (header.includes("Lesson")) {
        blocks.push({ type: "lesson", lessonId: input.value });
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
      return `<div class="block-text">${block.content || ""}</div>`;
    case "image":
      return `<div class="block-image"><img src="${escapeHtml(block.url || "")}" style="max-width:100%; border-radius: 8px; margin: 1rem 0;" alt="Problem image" /></div>`;
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
  const statementContainer = document.getElementById("statement-blocks");
  const solutionsContainer = document.getElementById("solutions-container");
  const lessonRefsInput = document.getElementById("lesson-refs");
  
  const addTextStatementBtn = document.getElementById("add-text-statement");
  const addImageStatementBtn = document.getElementById("add-image-statement");
  const addProblemRefStatementBtn = document.getElementById("add-problem-ref-statement");
  const addLessonRefStatementBtn = document.getElementById("add-lesson-ref-statement");
  const addSolutionBtn = document.getElementById("add-solution-btn");
  const saveDraftBtn = document.getElementById("save-draft-btn");
  const publishBtn = document.getElementById("publish-btn");
  const previewBtn = document.getElementById("preview-btn");
  
  // Load categories
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
  
  // Add statement block handlers
  addTextStatementBtn.addEventListener("click", () => {
    const blockId = Date.now() + Math.random();
    statementContainer.appendChild(createBlockElement({ type: "text" }, blockId));
  });
  
  addImageStatementBtn.addEventListener("click", () => {
    const blockId = Date.now() + Math.random();
    statementContainer.appendChild(createBlockElement({ type: "image" }, blockId));
  });
  
  addProblemRefStatementBtn.addEventListener("click", () => {
    const blockId = Date.now() + Math.random();
    statementContainer.appendChild(createBlockElement({ type: "problem" }, blockId));
  });
  
  addLessonRefStatementBtn.addEventListener("click", () => {
    const blockId = Date.now() + Math.random();
    statementContainer.appendChild(createBlockElement({ type: "lesson" }, blockId));
  });
  
  // Add solution handler
  addSolutionBtn.addEventListener("click", () => {
    const index = solutionsContainer.children.length;
    solutionsContainer.appendChild(createSolutionEditor({}, index));
  });
  
  // Load existing problem if ID provided
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
        
        // Load statement blocks
        statementContainer.innerHTML = "";
        (data.statement || []).forEach(block => {
          const blockId = Date.now() + Math.random();
          statementContainer.appendChild(createBlockElement(block, blockId));
        });
        
        // Load solutions
        solutionsContainer.innerHTML = "";
        (data.solutions || []).forEach((solution, index) => {
          solutionsContainer.appendChild(createSolutionEditor(solution, index));
        });
      }
    } catch (err) {
      console.error("Error loading problem:", err);
      alert("Error loading problem: " + err.message);
    }
  }
  
  // Save problem
  async function saveProblem(publish = false) {
    const pid = problemIdInput.value;
    if (!pid) {
      alert("Problem ID is required");
      return;
    }
    
    // Gather solutions
    const solutions = [];
    solutionsContainer.querySelectorAll(".solution-editor").forEach(solEl => {
      const title = solEl.querySelector(".solution-title").value.trim();
      const blocks = gatherBlocks(solEl.querySelector(".solution-blocks"));
      solutions.push({ title, blocks });
    });
    
    const payload = {
      id: parseInt(pid),
      title: titleInput.value.trim() || `Problem #${pid}`,
      category: categoryInput.value,
      difficulty: difficultyInput.value,
      tags: tagsInput.value.split(",").map(t => t.trim()).filter(Boolean),
      statement: gatherBlocks(statementContainer),
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
  
  // Preview
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
    
    // Render preview
    const title = titleInput.value || `Problem #${problemIdInput.value}`;
    document.getElementById("preview-title").textContent = title;
    document.getElementById("preview-id").textContent = `#${problemIdInput.value}`;
    document.getElementById("preview-category").textContent = categoryInput.value || "General";
    document.getElementById("preview-difficulty").textContent = difficultyInput.value;
    document.getElementById("preview-difficulty").className = `meta-item difficulty-${difficultyInput.value.toLowerCase()}`;
    
    // Tags
    const previewTags = document.getElementById("preview-tags");
    previewTags.innerHTML = "";
    tagsInput.value.split(",").map(t => t.trim()).filter(Boolean).forEach(tag => {
      previewTags.insertAdjacentHTML("beforeend", `<span class="tag">${escapeHtml(tag)}</span>`);
    });
    
    // Statement
    const previewStatement = document.getElementById("preview-statement");
    previewStatement.innerHTML = "";
    gatherBlocks(statementContainer).forEach(block => {
      previewStatement.insertAdjacentHTML("beforeend", renderBlockPreview(block));
    });
    
    // Solutions
    const previewSolutions = document.getElementById("preview-solutions");
    previewSolutions.innerHTML = "";
    
    solutionsContainer.querySelectorAll(".solution-editor").forEach((solEl, index) => {
      const title = solEl.querySelector(".solution-title").value.trim() || `Solution ${index + 1}`;
      const blocks = gatherBlocks(solEl.querySelector(".solution-blocks"));
      
      let solutionHtml = `<div class="solution-block"><h3>${escapeHtml(title)}</h3>`;
      blocks.forEach(block => {
        solutionHtml += renderBlockPreview(block);
      });
      solutionHtml += `</div>`;
      
      previewSolutions.insertAdjacentHTML("beforeend", solutionHtml);
    });
    
    // Typeset MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([previewMode]).catch(err => {
        console.error("MathJax error:", err);
      });
    }
  });
});
