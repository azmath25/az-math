// js/problem.js
import { db, doc, getDoc } from "./firebase.js";

let problemData = null;
let solutionsVisible = false;

// Render a content block
function renderBlock(block) {
  if (!block) return "";
  
  switch (block.type) {
    case "text":
      // Don't escape HTML for rich text content - render as HTML
      return `<div class="block-text">${block.content || ""}</div>`;
    
    case "image":
      return `<div class="block-image">
        <img src="${escapeHtml(block.url || "")}" alt="Problem image" style="max-width:100%; border-radius: 8px; margin: 1rem 0;" />
      </div>`;
    
    case "problem":
      return `<div class="ref-block">
        <strong>📝 Related Problem:</strong>
        <a href="problem.html?id=${escapeHtml(block.problemId || "")}" class="ref-link">Problem #${escapeHtml(block.problemId || "")}</a>
      </div>`;
    
    case "lesson":
      return `<div class="ref-block">
        <strong>📚 Related Lesson:</strong>
        <a href="lesson.html?id=${escapeHtml(block.lessonId || "")}" class="ref-link">Lesson #${escapeHtml(block.lessonId || "")}</a>
      </div>`;
    
    default:
      return `<div class="block-unknown">Unknown block type: ${block.type}</div>`;
  }
}

// Escape HTML (only for user-generated content that should be escaped)
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Enhanced typeset function with debugging
function typesetMath(container, label = "unknown") {
  console.log(`[MathJax Debug] Attempting to typeset: ${label}`);
  console.log(`[MathJax Debug] Container exists:`, !!container);
  console.log(`[MathJax Debug] Container innerHTML length:`, container?.innerHTML?.length);
  console.log(`[MathJax Debug] MathJax available:`, !!window.MathJax);
  console.log(`[MathJax Debug] typesetPromise available:`, !!window.MathJax?.typesetPromise);
  
  if (!window.MathJax) {
    console.error(`[MathJax Debug] MathJax not loaded yet for ${label}`);
    // Retry after MathJax loads
    setTimeout(() => typesetMath(container, label), 500);
    return;
  }
  
  if (window.MathJax.typesetPromise) {
    console.log(`[MathJax Debug] Calling typesetPromise for ${label}...`);
    window.MathJax.typesetPromise([container])
      .then(() => {
        console.log(`[MathJax Debug] ✓ Successfully typeset ${label}`);
      })
      .catch(err => {
        console.error(`[MathJax Debug] ✗ Error typesetting ${label}:`, err);
      });
  }
}

// Render problem statement
function renderStatement() {
  console.log("[Debug] renderStatement called");
  const statementContainer = document.getElementById("problem-statement");
  
  if (!statementContainer) {
    console.error("[Debug] Statement container not found!");
    return;
  }
  
  statementContainer.innerHTML = "";
  
  if (problemData.statement && problemData.statement.length > 0) {
    console.log(`[Debug] Rendering ${problemData.statement.length} statement blocks`);
    
    problemData.statement.forEach((block, idx) => {
      console.log(`[Debug] Block ${idx}:`, block.type, block.content?.substring(0, 50));
      const html = renderBlock(block);
      statementContainer.insertAdjacentHTML("beforeend", html);
    });
    
    console.log("[Debug] Statement HTML inserted, length:", statementContainer.innerHTML.length);
    console.log("[Debug] First 200 chars:", statementContainer.innerHTML.substring(0, 200));
    
    // Wait for next tick, then typeset
    setTimeout(() => {
      console.log("[Debug] setTimeout fired, calling typesetMath");
      typesetMath(statementContainer, "problem-statement");
    }, 100);
  } else {
    statementContainer.innerHTML = "<p><em>No statement available</em></p>";
  }
}

// Load and display problem
async function loadProblem() {
  console.log("[Debug] loadProblem called");
  const params = new URLSearchParams(window.location.search);
  const problemId = params.get("id");
  
  if (!problemId) {
    document.getElementById("problem-title").textContent = "Problem not found";
    document.getElementById("problem-statement").innerHTML = "<p>No problem ID provided.</p>";
    return;
  }
  
  console.log("[Debug] Loading problem ID:", problemId);
  
  try {
    const problemDoc = await getDoc(doc(db, "problems", String(problemId)));
    
    if (!problemDoc.exists()) {
      document.getElementById("problem-title").textContent = "Problem not found";
      document.getElementById("problem-statement").innerHTML = "<p>This problem does not exist.</p>";
      return;
    }
    
    problemData = problemDoc.data();
    console.log("[Debug] Problem data loaded:", problemData);
    
    // Render header
    const title = problemData.title || `Problem #${problemData.id}`;
    document.getElementById("problem-title").textContent = title;
    document.getElementById("problem-id").textContent = `#${problemData.id}`;
    document.getElementById("problem-category").textContent = problemData.category || "General";
    document.getElementById("problem-difficulty").textContent = problemData.difficulty || "Medium";
    
    // Render tags
    const tagsContainer = document.getElementById("problem-tags");
    tagsContainer.innerHTML = "";
    if (problemData.tags && problemData.tags.length > 0) {
      problemData.tags.forEach(tag => {
        const tagSpan = document.createElement("span");
        tagSpan.className = "tag";
        tagSpan.textContent = tag;
        tagsContainer.appendChild(tagSpan);
      });
    }
    
    // Wait for MathJax to be fully loaded before rendering statement
    console.log("[Debug] Waiting for MathJax to be ready...");
    waitForMathJax(() => {
      console.log("[Debug] MathJax ready, rendering statement");
      renderStatement();
    });
    
    // Render related lessons
    if (problemData.lessons && problemData.lessons.length > 0) {
      document.getElementById("lessons-section").style.display = "block";
      const lessonList = document.getElementById("lesson-list");
      lessonList.innerHTML = "";
      
      problemData.lessons.forEach(lessonId => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="lesson.html?id=${lessonId}" class="ref-link">Lesson #${lessonId}</a>`;
        lessonList.appendChild(li);
      });
    }
    
    // Metadata
    document.getElementById("problem-author").textContent = problemData.author || "Unknown";
    
    if (problemData.timestamp) {
      const date = problemData.timestamp.toDate ? problemData.timestamp.toDate() : new Date(problemData.timestamp);
      document.getElementById("problem-timestamp").textContent = date.toLocaleDateString();
    }
    
  } catch (err) {
    console.error("[Debug] Error loading problem:", err);
    document.getElementById("problem-title").textContent = "Error loading problem";
    document.getElementById("problem-statement").innerHTML = "<p>An error occurred. Please try again.</p>";
  }
}

// Wait for MathJax to be fully loaded
function waitForMathJax(callback, maxAttempts = 20) {
  let attempts = 0;
  
  const checkMathJax = () => {
    attempts++;
    console.log(`[Debug] Checking for MathJax (attempt ${attempts})...`);
    
    if (window.MathJax && window.MathJax.typesetPromise) {
      console.log("[Debug] MathJax is ready!");
      callback();
    } else if (attempts < maxAttempts) {
      setTimeout(checkMathJax, 100);
    } else {
      console.error("[Debug] MathJax failed to load after", maxAttempts, "attempts");
      callback(); // Call anyway to show content
    }
  };
  
  checkMathJax();
}

// Toggle solutions visibility
function toggleSolutions() {
  const solutionsContainer = document.getElementById("solutions-container");
  const toggleButton = document.getElementById("toggle-solutions");
  
  if (!solutionsVisible) {
    // Show solutions
    if (!problemData.solutions || problemData.solutions.length === 0) {
      solutionsContainer.innerHTML = "<p><em>No solutions available yet.</em></p>";
      solutionsContainer.style.display = "block";
      return;
    }
    
    solutionsContainer.innerHTML = "";
    
    problemData.solutions.forEach((solution, index) => {
      const solutionDiv = document.createElement("div");
      solutionDiv.className = "solution-block";
      
      const header = `<h3>Solution ${solution.id || index + 1}</h3>`;
      solutionDiv.innerHTML = header;
      
      if (solution.blocks && solution.blocks.length > 0) {
        solution.blocks.forEach(block => {
          solutionDiv.insertAdjacentHTML("beforeend", renderBlock(block));
        });
      } else {
        solutionDiv.insertAdjacentHTML("beforeend", "<p><em>No content</em></p>");
      }
      
      solutionsContainer.appendChild(solutionDiv);
    });
    
    solutionsContainer.style.display = "block";
    toggleButton.textContent = "🙈 Hide Solutions";
    solutionsVisible = true;
    
    // Typeset MathJax for solutions
    typesetMath(solutionsContainer, "solutions");
  } else {
    // Hide solutions
    solutionsContainer.style.display = "none";
    toggleButton.textContent = "👁️ Show Solutions";
    solutionsVisible = false;
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Debug] DOM Content Loaded");
  console.log("[Debug] MathJax status:", window.MathJax ? "loaded" : "not loaded");
  
  loadProblem();
  
  // Use either "show-solutions" (old ID) or "toggle-solutions" (new ID)
  const toggleSolutionsBtn = document.getElementById("toggle-solutions") || document.getElementById("show-solutions");
  if (toggleSolutionsBtn) {
    toggleSolutionsBtn.addEventListener("click", toggleSolutions);
  }
});
