// js/problem.js
import { db, doc, getDoc } from "./firebase.js";

let problemData = null;

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

// Typeset MathJax when DOM is ready
function typesetMath(container) {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([container]).catch(err => {
      console.error("MathJax error:", err);
    });
  }
}

// Render problem statement
function renderStatement() {
  const statementContainer = document.getElementById("problem-statement");
  statementContainer.innerHTML = "";
  
  if (problemData.statement && problemData.statement.length > 0) {
    problemData.statement.forEach(block => {
      statementContainer.insertAdjacentHTML("beforeend", renderBlock(block));
    });
    
    // Typeset MathJax after rendering
    typesetMath(statementContainer);
  } else {
    statementContainer.innerHTML = "<p><em>No statement available</em></p>";
  }
}

// Load and display problem
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
    
    // Render statement after a brief delay to ensure MathJax is ready
    setTimeout(() => {
      renderStatement();
    }, 0);
    
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
    console.error("Error loading problem:", err);
    document.getElementById("problem-title").textContent = "Error loading problem";
    document.getElementById("problem-statement").innerHTML = "<p>An error occurred. Please try again.</p>";
  }
}

// Show solutions
function showSolutions() {
  const solutionsContainer = document.getElementById("solutions-container");
  const showButton = document.getElementById("show-solutions");
  
  if (!problemData.solutions || problemData.solutions.length === 0) {
    solutionsContainer.innerHTML = "<p><em>No solutions available yet.</em></p>";
    solutionsContainer.style.display = "block";
    showButton.style.display = "none";
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
  showButton.style.display = "none";
  
  // Typeset MathJax for solutions
  typesetMath(solutionsContainer);
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadProblem();
  
  const showSolutionsBtn = document.getElementById("show-solutions");
  if (showSolutionsBtn) {
    showSolutionsBtn.addEventListener("click", showSolutions);
  }
});
