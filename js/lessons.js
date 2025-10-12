// js/lesson.js - Enhanced version compatible with existing data structure
import {
  db,
  doc,
  getDoc
} from "./firebase.js";

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

// Escape HTML (only for URLs and safe content)
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Render a single block
function renderBlock(block) {
  if (!block) return "";
  
  switch (block.type) {
    case "text":
      const content = cleanHtmlForMath(block.content || "");
      return `<div class="block-text">${content}</div>`;
    
    case "image":
      return `<div class="block-image">
        <img src="${escapeHtml(block.url || "")}" alt="Lesson image" style="max-width:100%; border-radius: 12px; margin: 1.5rem 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
      </div>`;
    
    case "problem":
      // Return a placeholder - we'll replace this with actual card
      return `<div class="problem-ref-placeholder" data-problem-id="${escapeHtml(block.problemId || "")}"></div>`;
    
    case "lesson":
      return `<div class="ref-block">
        <strong>📚 Related Lesson:</strong> 
        <a href="lesson.html?id=${escapeHtml(block.lessonId || "")}" class="ref-link">
          Lesson #${escapeHtml(block.lessonId || "")}
        </a>
      </div>`;
    
    default:
      return `<div class="block-unknown">Unknown block type: ${block.type}</div>`;
  }
}

// Create interactive problem card
async function createProblemCard(problemId) {
  try {
    const problemDoc = await getDoc(doc(db, "problems", String(problemId)));
    
    if (!problemDoc.exists()) {
      return `<div class="problem-preview-card">
        <p style="color: #ef4444;">Problem #${problemId} not found</p>
      </div>`;
    }
    
    const problem = problemDoc.data();
    const hasMultipleSolutions = problem.solutions && problem.solutions.length > 1;
    
    // Create card HTML
    const cardHtml = `
      <div class="problem-preview-card interactive-card" data-problem-id="${problemId}">
        <div class="problem-card-header">
          <div class="problem-card-meta">
            <span class="problem-id-badge">#${problem.id}</span>
            <span class="problem-category-badge">${problem.category || "General"}</span>
            <span class="problem-difficulty difficulty-${(problem.difficulty || "medium").toLowerCase()}">${problem.difficulty || "Medium"}</span>
          </div>
          <button class="toggle-solution-btn" data-problem-id="${problemId}">
            👁️ Show Solution${hasMultipleSolutions ? 's' : ''}
          </button>
        </div>
        
        <h4>
          📝 ${problem.title ? escapeHtml(problem.title) : `Problem #${problem.id}`}
        </h4>
        
        ${problem.tags && problem.tags.length > 0 ? `
          <div class="problem-tags">
            ${problem.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        ` : ""}
        
        <div class="problem-statement-preview">
          ${renderProblemStatement(problem.statement)}
        </div>
        
        <div class="problem-solutions-container" id="solutions-${problemId}" style="display: none;">
          ${renderProblemSolutions(problem.solutions || [])}
        </div>
        
        <div class="problem-card-footer">
          <a href="problem.html?id=${problemId}" class="view-full-link" target="_blank">
            View Full Problem →
          </a>
        </div>
      </div>
    `;
    
    return cardHtml;
  } catch (err) {
    console.error(`Error loading problem #${problemId}:`, err);
    return `<div class="problem-preview-card">
      <p style="color: #ef4444;">Error loading problem #${problemId}</p>
    </div>`;
  }
}

// Render problem statement blocks
function renderProblemStatement(statement = []) {
  if (!statement || statement.length === 0) {
    return "<p><em>No statement available</em></p>";
  }
  
  let html = "";
  for (const block of statement) {
    if (block.type === "text") {
      const content = cleanHtmlForMath(block.content || "");
      html += `<p>${content}</p>`;
    } else if (block.type === "image") {
      html += `<img src="${escapeHtml(block.url || "")}" style="max-width:100%; border-radius: 8px; margin: 1rem 0;" />`;
    }
  }
  
  return html || "<p><em>No statement available</em></p>";
}

// Render problem solutions
function renderProblemSolutions(solutions = []) {
  if (!solutions || solutions.length === 0) {
    return "<p><em>No solutions available</em></p>";
  }
  
  let html = "";
  
  solutions.forEach((solution, index) => {
    html += `
      <div class="solution-block">
        <h3>Solution ${solutions.length > 1 ? (index + 1) : ''}</h3>
        ${renderSolutionBlocks(solution.blocks || [])}
      </div>
    `;
  });
  
  return html;
}

// Render solution blocks
function renderSolutionBlocks(blocks = []) {
  let html = "";
  
  blocks.forEach(block => {
    if (block.type === "text") {
      const content = cleanHtmlForMath(block.content || "");
      html += `<p>${content}</p>`;
    } else if (block.type === "image") {
      html += `<img src="${escapeHtml(block.url || "")}" style="max-width:100%; border-radius: 8px; margin: 1rem 0;" />`;
    }
  });
  
  return html || "<p><em>No solution content</em></p>";
}

// Typeset MathJax - CSP compliant
function typesetMath(container) {
  if (!container) return;
  
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([container]).catch(err => {
      console.error("MathJax error:", err);
    });
  }
}

// Load and display lesson
async function loadLesson() {
  const params = new URLSearchParams(window.location.search);
  const lessonId = params.get("id");
  
  if (!lessonId) {
    document.getElementById("lesson-title").textContent = "Lesson not found";
    document.getElementById("lesson-content").innerHTML = "<p>No lesson ID provided.</p>";
    return;
  }
  
  try {
    const lessonDoc = await getDoc(doc(db, "lessons", String(lessonId)));
    
    if (!lessonDoc.exists()) {
      document.getElementById("lesson-title").textContent = "Lesson not found";
      document.getElementById("lesson-content").innerHTML = "<p>This lesson does not exist.</p>";
      return;
    }
    
    const lessonData = lessonDoc.data();
    
    // Render header
    const title = lessonData.title || `Lesson #${lessonData.id}`;
    document.getElementById("lesson-title").textContent = title;
    document.getElementById("lesson-id").textContent = `#${lessonData.id}`;
    document.getElementById("lesson-category").textContent = lessonData.category || "General";
    document.title = `${title} - Az-Math`;
    
    // Render tags
    const tagsContainer = document.getElementById("lesson-tags");
    tagsContainer.innerHTML = "";
    if (lessonData.tags && lessonData.tags.length > 0) {
      lessonData.tags.forEach(tag => {
        const tagSpan = document.createElement("span");
        tagSpan.className = "tag";
        tagSpan.textContent = tag;
        tagsContainer.appendChild(tagSpan);
      });
    }
    
    // Render cover image (checking both 'cover' and 'coverImage' fields)
    if (lessonData.cover || lessonData.coverImage) {
      document.getElementById("lesson-cover-container").style.display = "block";
      document.getElementById("lesson-cover").src = lessonData.cover || lessonData.coverImage;
      document.getElementById("lesson-cover").alt = title;
    }
    
    // Render content blocks (checking both 'blocks' and 'content' fields)
    const contentContainer = document.getElementById("lesson-content");
    contentContainer.innerHTML = "";
    
    const contentBlocks = lessonData.blocks || lessonData.content || [];
    
    if (contentBlocks.length > 0) {
      // First pass: render all blocks with placeholders for problems
      for (const block of contentBlocks) {
        const blockHtml = renderBlock(block);
        contentContainer.insertAdjacentHTML("beforeend", blockHtml);
      }
      
      // Second pass: replace problem placeholders with actual cards
      const placeholders = contentContainer.querySelectorAll(".problem-ref-placeholder");
      for (const placeholder of placeholders) {
        const problemId = placeholder.dataset.problemId;
        const cardHtml = await createProblemCard(problemId);
        placeholder.outerHTML = cardHtml;
      }
      
      // Attach event listeners to toggle buttons
      attachSolutionToggleListeners();
      
      // Typeset MathJax after all content is loaded
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          typesetMath(contentContainer);
        });
      });
    } else {
      contentContainer.innerHTML = "<p><em>No content available</em></p>";
    }
    
    // Render related problems
    if (lessonData.problems && lessonData.problems.length > 0) {
      document.getElementById("problems-section").style.display = "block";
      const problemList = document.getElementById("problem-list");
      problemList.innerHTML = "";
      
      lessonData.problems.forEach(problemId => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="problem.html?id=${problemId}" class="ref-link">Problem #${problemId}</a>`;
        problemList.appendChild(li);
      });
    }
    
    // Metadata
    document.getElementById("lesson-author").textContent = lessonData.author || "Unknown";
    
    if (lessonData.timestamp) {
      const date = lessonData.timestamp.toDate ? lessonData.timestamp.toDate() : new Date(lessonData.timestamp);
      document.getElementById("lesson-timestamp").textContent = date.toLocaleDateString();
    }
    
  } catch (err) {
    console.error("Error loading lesson:", err);
    document.getElementById("lesson-title").textContent = "Error loading lesson";
    document.getElementById("lesson-content").innerHTML = "<p>An error occurred. Please try again.</p>";
  }
}

// Attach toggle solution listeners
function attachSolutionToggleListeners() {
  const toggleBtns = document.querySelectorAll(".toggle-solution-btn");
  
  toggleBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const problemId = btn.dataset.problemId;
      const solutionsContainer = document.getElementById(`solutions-${problemId}`);
      
      if (solutionsContainer.style.display === "none") {
        solutionsContainer.style.display = "block";
        btn.textContent = "🙈 Hide Solution" + (btn.textContent.includes('s') ? 's' : '');
        
        // Typeset MathJax for solutions using requestAnimationFrame (CSP compliant)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            typesetMath(solutionsContainer);
          });
        });
      } else {
        solutionsContainer.style.display = "none";
        btn.textContent = "👁️ Show Solution" + (btn.textContent.includes('s') ? 's' : '');
      }
    });
  });
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadLesson();
});
