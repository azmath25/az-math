// js/render-utils.js - Shared rendering utilities for problems and lessons
// Single source of truth for all content block rendering

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clean HTML but preserve formatting and math delimiters
 */
export function cleanHtmlForMath(html) {
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
 * Typeset math with MathJax
 */
export function typesetMath(container) {
  if (!container) {
    console.warn("[Render] typesetMath called with no container");
    return Promise.resolve();
  }
  
  if (window.MathJax && window.MathJax.typesetPromise) {
    return window.MathJax.typesetPromise([container]).catch(err => {
      console.error("[Render] MathJax error:", err);
    });
  } else if (window.MathJax && window.MathJax.typeset) {
    window.MathJax.typeset([container]);
    return Promise.resolve();
  } else {
    console.warn("[Render] MathJax not available yet");
    return Promise.resolve();
  }
}

/**
 * Wait for MathJax to be ready
 */
export function waitForMathJax() {
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
        console.warn("[Render] MathJax not loaded after waiting");
        resolve();
      }
    }
    
    requestAnimationFrame(checkMathJax);
  });
}

/**
 * Render text block
 */
export function renderTextBlock(block) {
  const content = cleanHtmlForMath(block.content || "");
  return `<div class="block-text">${content}</div>`;
}

/**
 * Render image block with alignment, size, and caption
 * FIXED: No wrapper for floats - direct image rendering
 */
export function renderImageBlock(block) {
  const alignment = block.alignment || 'center';
  const size = block.size || 'medium';
  const caption = block.caption || '';
  const alt = block.alt || 'Problem image';
  const url = block.url || '';

  if (!url) return '';

  // For floating images, render directly without wrapper
  // This allows text to wrap around them naturally
  if (alignment === 'float-left' || alignment === 'float-right') {
    const floatClass = alignment === 'float-left' ? 'image-float-left' : 'image-float-right';
    return `
      <img src="${escapeHtml(url)}" 
           alt="${escapeHtml(alt)}" 
           class="problem-image ${floatClass} image-size-${size}" 
           loading="lazy"
           onerror="this.style.display='none'; console.error('Failed to load image:', '${escapeHtml(url)}');" />
      ${caption ? `<div class="image-caption ${floatClass}">${escapeHtml(caption)}</div>` : ''}
    `;
  }

  // For non-floating images, keep wrapper for proper spacing
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
 * Render problem reference block
 */
export function renderProblemRef(block) {
  return `<div class="ref-block">
    <strong>📝 Related Problem:</strong>
    <a href="problem.html?id=${escapeHtml(block.problemId || "")}" class="ref-link">Problem #${escapeHtml(block.problemId || "")}</a>
  </div>`;
}

/**
 * Render lesson reference block
 */
export function renderLessonRef(block) {
  return `<div class="ref-block">
    <strong>📚 Related Lesson:</strong>
    <a href="lesson.html?id=${escapeHtml(block.lessonId || "")}" class="ref-link">Lesson #${escapeHtml(block.lessonId || "")}</a>
  </div>`;
}

/**
 * Main block rendering router
 */
export function renderBlock(block) {
  if (!block) return "";
  
  switch (block.type) {
    case "text":
      return renderTextBlock(block);
    
    case "image":
      return renderImageBlock(block);
    
    case "problem":
      return renderProblemRef(block);
    
    case "lesson":
      return renderLessonRef(block);
    
    default:
      console.warn("[Render] Unknown block type:", block.type);
      return `<div class="block-unknown">Unknown block type: ${block.type}</div>`;
  }
}

/**
 * Render multiple blocks into a unified content flow
 * This allows floated images to interact with surrounding text
 */
export function renderBlocks(blocks) {
  if (!blocks || blocks.length === 0) {
    return '<p><em>No content available</em></p>';
  }
  
  return blocks.map(block => renderBlock(block)).join('\n');
}

/**
 * Enable lazy loading for images with proper opacity handling
 * FIXED: Check if image already loaded before applying opacity animation
 */
export function enableLazyLoading(container) {
  if (!container) return;
  
  if (!('IntersectionObserver' in window)) {
    // Fallback: all images load immediately
    return;
  }

  const images = container.querySelectorAll('img[loading="lazy"]');
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        
        // FIXED: Only apply opacity animation if image not already loaded
        if (!img.complete) {
          img.style.opacity = '0';
          img.style.transition = 'opacity 0.3s ease';
          
          img.addEventListener('load', () => {
            img.style.opacity = '1';
          }, { once: true });
        }
        // If already loaded (cached), it displays immediately at full opacity
        
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '50px'
  });

  images.forEach(img => imageObserver.observe(img));
}

/**
 * Render a solution with its blocks
 */
export function renderSolution(solution, index) {
  const solutionTitle = solution.title || `Solution ${index + 1}`;
  let html = `<div class="solution-block"><h3>${escapeHtml(solutionTitle)}</h3>`;
  
  if (solution.blocks && solution.blocks.length > 0) {
    html += renderBlocks(solution.blocks);
  } else {
    html += '<p><em>No content</em></p>';
  }
  
  html += '</div>';
  return html;
}

/**
 * Render multiple solutions
 */
export function renderSolutions(solutions) {
  if (!solutions || solutions.length === 0) {
    return '<p><em>No solutions available yet.</em></p>';
  }
  
  return solutions.map((solution, index) => renderSolution(solution, index)).join('\n');
}

console.log('[Render Utils] Module loaded successfully');
