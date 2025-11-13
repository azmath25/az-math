// js/problem.js - Enhanced with proper image alignment, sizing, and captions
import { db, doc, getDoc } from "./firebase.js";

let problemData = null;
let solutionsVisible = false;

/**
 * Clean HTML but preserve formatting and fix math delimiters
 */
function cleanHtmlForMath(html) {
  if (!html) return "";
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  const allowedTags = ['strong', 'b', 'em', 'i', 'u', 'br', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  
  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      let childrenHtml = '';
      for (let child of node.childNodes) {
        childrenHtml += cleanNode(child);
      }
      
      if (allowedTags.includes(tagName)) {
        return `<${tagName}>${childrenHtml}</${tagName}>`;
      }
      
      return childrenHtml;
    }
    
    return '';
  }
  
  const cleaned = cleanNode(temp);
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Render a content block with enhanced image support
 */
function renderBlock(block) {
  if (!block) return "";
  
  switch (block.type) {
    case "text":
      const content = cleanHtmlForMath(block.content || "");
      return `<div class="block-text">${content}</div>`;
    
    case "image":
      return renderImageBlock(block);
    
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

/**
 * Render image block with alignment, size, and caption
 */
function renderImageBlock(block) {
  const alignment = block.alignment || 'center';
  const size = block.size || 'medium';
  const caption = block.caption || '';
  const alt = block.alt || 'Problem image';
  const url = block.url || '';

  if (!url) return '';

  return `
    <div class="image-block-wrapper image-alignment-${alignment} image-size-${size}">
      <img src="${escapeHtml(url)}" 
           alt="${escapeHtml(alt)}" 
           class="problem-image" 
           loading="lazy"
           onerror="this.parentElement.style.display='none'; console.error('Failed to load image:', '${escapeHtml(url)}');" />
      ${caption ? `<div class="image-caption">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Typeset MathJax - CSP compliant version
 */
function typesetMath(container) {
  if (!container) {
    console.warn("typesetMath called with no container");
    return;
  }
  
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([container]).catch(err => {
      console.error("MathJax error:", err);
    });
  } else if (window.MathJax && window.MathJax.typeset) {
    window.MathJax.typeset([container]);
  } else {
    console.warn("MathJax not available yet");
  }
}

/**
 * Render problem statement with MathJax
 */
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
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        typesetMath(statementContainer);
        // Enable lazy loading for images
        enableLazyLoading(statementContainer);
      });
    });
  } else {
    statementContainer.innerHTML = "<p><em>No statement available</em></p>";
  }
}

/**
 * Enable lazy loading for images using Intersection Observer
 */
function enableLazyLoading(container) {
  if (!('IntersectionObserver' in window)) {
    // Fallback: load all images immediately
    return;
  }

  const images = container.querySelectorAll('img[loading="lazy"]');
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        
        // Add fade-in animation
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease';
        
        img.addEventListener('load', () => {
          img.style.opacity = '1';
        });
        
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '50px' // Start loading 50px before image enters viewport
  });

  images.forEach(img => imageObserver.observe(img));
}

/**
 * Wait for MathJax using Promises (CSP compliant)
 */
function waitForMathJax() {
  return new Promise((resolve) => {
    if (window.MathJax && (window.MathJax.typesetPromise || window.MathJax.typeset)) {
      resolve();
      return;
    }
    
    let attempts = 0;
    const maxAttempts = 100;
    
    function checkMathJax() {
      attempts++;
      
      if (window.MathJax && (window.MathJax.typesetPromise || window.MathJax.typeset)) {
        resolve();
      } else if (attempts < maxAttempts) {
        requestAnimationFrame(checkMathJax);
      } else {
        console.warn("MathJax not loaded after waiting");
        resolve();
      }
    }
    
    requestAnimationFrame(checkMathJax);
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
    console.error("Error loading problem:", err);
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
      
      const header = `<h3>${solution.title || `Solution ${index + 1}`}</h3>`;
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
