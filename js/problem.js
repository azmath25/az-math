// js/problem.js - Problem display page (FIXED with shared rendering)
import { db, doc, getDoc } from "./firebase.js";
import {
  renderBlock,
  renderBlocks,
  renderSolutions,
  typesetMath,
  waitForMathJax,
  enableLazyLoading,
  escapeHtml
} from "./render-utils.js";

let problemData = null;
let solutionsVisible = false;

/**
 * Render problem statement with unified content flow
 * FIXED: All blocks render in single container for proper float wrapping
 */
function renderStatement() {
  const statementContainer = document.getElementById("problem-statement");
  
  if (!statementContainer) {
    console.error("[Problem] Statement container not found!");
    return;
  }
  
  // Render all blocks in unified flow
  statementContainer.innerHTML = renderBlocks(problemData.statement);
  
  // Typeset math and enable lazy loading
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      typesetMath(statementContainer);
      enableLazyLoading(statementContainer);
    });
  });
}

/**
 * Load and display problem
 */
async function loadProblem() {
  const params = new URLSearchParams(window.location.search);
  const problemId = params.get("id");
  
  if (!problemId) {
    document.getElementById("problem-title").textContent = "Problem not found";
    document.getElementById("problem-statement").innerHTML = "<p>No problem ID provided.</p>";
    return;
  }
  
  try {
    const problemDoc = await getDoc(doc(db, "problems", String(problemId)));
    
    if (!problemDoc.exists()) {
      document.getElementById("problem-title").textContent = "Problem not found";
      document.getElementById("problem-statement").innerHTML = "<p>This problem does not exist.</p>";
      return;
    }
    
    problemData = problemDoc.data();
    
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
    
    // Wait for MathJax, then render statement
    await waitForMathJax();
    renderStatement();
    
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
    console.error("[Problem] Error loading problem:", err);
    document.getElementById("problem-title").textContent = "Error loading problem";
    document.getElementById("problem-statement").innerHTML = "<p>An error occurred. Please try again.</p>";
  }
}

/**
 * Toggle solutions visibility
 */
function toggleSolutions() {
  const solutionsContainer = document.getElementById("solutions-container");
  const toggleButton = document.getElementById("toggle-solutions") || document.getElementById("show-solutions");
  
  if (!solutionsVisible) {
    // Show solutions - use shared rendering
    solutionsContainer.innerHTML = renderSolutions(problemData.solutions);
    solutionsContainer.style.display = "block";
    
    if (toggleButton) {
      toggleButton.textContent = "▲ Hide Solutions";
    }
    solutionsVisible = true;
    
    // Typeset MathJax for solutions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        typesetMath(solutionsContainer);
        enableLazyLoading(solutionsContainer);
      });
    });
  } else {
    // Hide solutions
    solutionsContainer.style.display = "none";
    if (toggleButton) {
      toggleButton.textContent = "Həllərə bax";
    }
    solutionsVisible = false;
  }
}

/**
 * Initialize
 */
document.addEventListener("DOMContentLoaded", () => {
  loadProblem();
  
  const toggleSolutionsBtn = document.getElementById("toggle-solutions") || document.getElementById("show-solutions");
  if (toggleSolutionsBtn) {
    toggleSolutionsBtn.addEventListener("click", toggleSolutions);
  }
});

console.log('[Problem] Module loaded with shared rendering');
