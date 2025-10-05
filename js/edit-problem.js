// js/edit-problem.js
import {
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "../js/firebase.js";
import { getCurrentUser } from "./auth.js";

let solutionCounter = 0;

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
  } else if (block.type === "lesson") {
    wrapper.innerHTML = `
      <div class="block-header">
        <span>📚 Lesson Reference</span>
        <div class="block-controls">
          <button class="btn-icon move-up" title="Move Up">↑</button>
          <button class="btn-icon move-down" title="Move Down">↓</button>
          <button class="btn-icon remove-block" title="Remove">✕</button>
        </div>
      </div>
      <input class="block-input" placeholder="Lesson ID" value="${escapeHtml(block.lessonId || "")}">
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
function gatherBlocksFromContainer(container) {
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
      <button class="btn btn-small btn-delete remove-solution">Remove Solution</button>
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
    <button class="btn btn-small add-text">➕ Text</button>
    <button class="btn btn-small add-image">🖼️ Image</button>
    <button class="btn btn-small add-problem">🔗 Problem Ref</button>
    <button class="btn btn-small add-lesson">📚 Lesson Ref</button>
  `;
  
  container.appendChild(blocksContainer);
  container.appendChild(actions);
  
  // Attach event listeners
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

// Render block for preview (with MathJax)
function renderBlockPreview(block) {
  if (!block) return "";
  
  switch (block.type) {
    case "text":
      return `<div class="block-text">${escapeHtml(block.content || "")}</div>`;
    case "image":
      return `<div class="block-image"><img src="${escapeHtml(block.url || "")}" style="max-width:100%; border-radius: 8px; margin: 1rem 0;" /></div>`;
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
  
  // Add block handlers for statement
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
  
  // Add solution handler
  addSolutionBtn.addEventListener("click", () => {
    solutionCounter++;
    solutionsContainer.appendChild(renderSolutionUI({ id: solutionCounter, blocks: [] }));
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
        statementBlocks.innerHTML = "";
        (data.statement || []).forEach(block => {
          statementBlocks.appendChild(createBlockElement(block));
        });
        
        // Load solutions
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
  
  // Save problem
  async function saveProblem(publish = false) {
    const pid = problemIdInput.value;
    if (!pid) {
      alert("Problem ID is required");
      return;
    }
    
    // Gather solutions
    const solutions = [];
    solutionsContainer.querySelectorAll(".solution-editor").forEach((solEl, index) => {
      const solId = parseInt(solEl.dataset.solutionId) || (index + 1);
      const blocksContainer = solEl.querySelector(".blocks-container");
      solutions.push({
        id: solId,
        blocks: gatherBlocksFromContainer(blocksContainer)
      });
    });
    
    // Get current user info
    const currentUser = await getCurrentUser();
    const authorName = currentUser?.name || currentUser?.email || "Unknown";
    
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
      author: authorName,
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
    
    // Toggle visibility
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
    const title = titleInput.value || `Problem #${problemIdInput.value}`;
    document.getElementById("preview-title").textContent = title;
    document.getElementById("preview-id").textContent = `#${problemIdInput.value}`;
    document.getElementById("preview-category").textContent = categoryInput.value || "General";
    document.getElementById("preview-difficulty").textContent = difficultyInput.value;
    
    // Tags
    const previewTags = document.getElementById("preview-tags");
    previewTags.innerHTML = "";
    tagsInput.value.split(",").map(t => t.trim()).filter(Boolean).forEach(tag => {
      previewTags.insertAdjacentHTML("beforeend", `<span class="tag">${escapeHtml(tag)}</span>`);
    });
    
    // Statement
    const previewStatement = document.getElementById("preview-statement");
    previewStatement.innerHTML = "";
    gatherBlocksFromContainer(statementBlocks).forEach(block => {
      previewStatement.insertAdjacentHTML("beforeend", renderBlockPreview(block));
    });
    
    // Solutions
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
    
    // Typeset MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([previewMode]).catch(err => {
        console.error("MathJax error:", err);
      });
    }
  });
});
