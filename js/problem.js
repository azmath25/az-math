// js/problem.js
import { db, doc, getDoc } from "./firebase.js";

let problemData = null;
let solutionsVisible = false;

// Clean HTML but preserve formatting and fix math delimiters
function cleanHtmlForMath(html) {
  if (!html) return "";
  
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // List of allowed formatting tags to preserve
  const allowedTags = ['strong', 'b', 'em', 'i', 'u', 'br', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  
  // Recursively clean the HTML
  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // Process child nodes
      let childrenHtml = '';
      for (let child of node.childNodes) {
        childrenHtml += cleanNode(child);
      }
      
      // Keep allowed formatting tags
      if (allowedTags.includes(tagName)) {
        return `<${tagName}>${childrenHtml}</${tagName}>`;
      }
      
      // For other tags (like span), just return the content without the tag
      return childrenHtml;
    }
    
    return '';
  }
  
  const cleaned = cleanNode(temp);
  
  // Fix any double spaces or excessive whitespace
  return cleaned.replace(/\s+/g, ' ').trim();
}

// Render a content block
function renderBlock(block) {
  if (!block) return "";
  
  switch (block.type) {
    case "text":
      // Clean HTML and preserve math notation
      const content = cleanHtmlForMath(block.content || "");
      return `<div class="block-text">${content}</div>`;
    
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

// Typeset MathJax - CSP compliant version
function typesetMath(container) {
  if (!container) {
    console.warn("typesetMath called with no container");
    return;
  }
  
  // Use Promise-based approach that's CSP compliant
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([container]).catch(err => {
      console.error("MathJax error:", err);
    });
  } else if (window.MathJax && window.MathJax.typeset) {
    // Fallback to synchronous typeset
    window.MathJax.typeset([container]);
  } else {
    console.warn("MathJax not available yet");
  }
}

// Render problem statement with MathJax
function renderStatement() {
  const statementContainer = document.getElementById("problem-statement");
  
  if (!statementContainer) {
    console.error("Statement container not found!");
    return;
  }
  
  statementContainer.innerHTML = "";
  
  if (problemData.statement && problemData.statement.length > 0) {
    problemData.statement.forEach(block => {
      statementContainer.insertAdjacentHTML("beforeend", renderBlock(block));
    });
    
    // Use requestAnimationFrame instead of setTimeout (CSP compliant)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        typesetMath(statementContainer);
      });
    });
  } else {
    statementContainer.innerHTML = "<p><em>No statement available</em></p>";
  }
}

// Wait for MathJax using Promises (CSP compliant)
function waitForMathJax() {
  return new Promise((resolve) => {
    if (window.MathJax && (window.MathJax.typesetPromise || window.MathJax.typeset)) {
      resolve();
      return;
    }
    
    // Poll for MathJax using requestAnimationFrame (CSP compliant)
    let attempts = 0;
    const maxAttempts = 100; // 100 frames ~ 1.7 seconds at 60fps
    
    function checkMathJax() {
      attempts++;
      
      if (window.MathJax && (window.MathJax.typesetPromise || window.MathJax.typeset)) {
        resolve();
      } else if (attempts < maxAttempts) {
        requestAnimationFrame(checkMathJax);
      } else {
        console.warn("MathJax not loaded after waiting");
        resolve(); // Resolve anyway to show content
      }
    }
    
    requestAnimationFrame(checkMathJax);
  });
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
    console.error("Error loading problem:", err);
    document.getElementById("problem-title").textContent = "Error loading problem";
    document.getElementById("problem-statement").innerHTML = "<p>An error occurred. Please try again.</p>";
  }
}

// Toggle solutions visibility
function toggleSolutions() {
  const solutionsContainer = document.getElementById("solutions-container");
  const toggleButton = document.getElementById("toggle-solutions") || document.getElementById("show-solutions");
  
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
    if (toggleButton) {
      toggleButton.textContent = "▲";
    }
    solutionsVisible = true;
    
    // Typeset MathJax for solutions using requestAnimationFrame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        typesetMath(solutionsContainer);
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

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadProblem();
  
  const toggleSolutionsBtn = document.getElementById("toggle-solutions") || document.getElementById("show-solutions");
  if (toggleSolutionsBtn) {
    toggleSolutionsBtn.addEventListener("click", toggleSolutions);
  }
});
