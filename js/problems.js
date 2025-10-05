// js/problems.js
import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "./firebase.js";

import { populateCategorySelect } from "./categories-utils.js";

let allProblems = [];
let filteredProblems = [];
const ITEMS_PER_PAGE = 10;
let currentPage = 1;

const problemsList = document.getElementById("problems-list");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const difficultyFilter = document.getElementById("difficulty-filter");
const prevBtn = document.getElementById("prev-page");
const nextBtn = document.getElementById("next-page");
const pageInfo = document.getElementById("page-info");

// Load all published problems
async function loadProblems() {
  try {
    problemsList.innerHTML = "<p>Loading problems...</p>";
    
    const q = query(
      collection(db, "problems"),
      where("draft", "==", false),
      orderBy("id")
    );
    
    const snapshot = await getDocs(q);
    allProblems = [];
    
    snapshot.forEach(doc => {
      allProblems.push({ docId: doc.id, ...doc.data() });
    });
    
    filteredProblems = [...allProblems];
    currentPage = 1;
    renderProblems();
  } catch (err) {
    console.error("Error loading problems:", err);
    problemsList.innerHTML = "<p>Error loading problems. Please try again.</p>";
  }
}

// Render problems for current page
function renderProblems() {
  if (filteredProblems.length === 0) {
    problemsList.innerHTML = "<p>No problems found matching your criteria.</p>";
    updatePagination();
    return;
  }

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageProblems = filteredProblems.slice(start, end);

  problemsList.innerHTML = "";
  
  pageProblems.forEach(problem => {
    const card = createProblemCard(problem);
    problemsList.appendChild(card);
  });

  updatePagination();
  
  // Typeset MathJax after rendering
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([problemsList]).catch(err => {
      console.error("MathJax error:", err);
    });
  }
}

// Create problem card with preview
function createProblemCard(problem) {
  const card = document.createElement("div");
  card.className = "problem-card-wide";
  
  const title = problem.title || `Problem #${problem.id}`;
  const statementPreview = getStatementPreview(problem.statement);
  
  card.innerHTML = `
    <div class="problem-header">
      <span class="problem-id">#${problem.id}</span>
      <span class="problem-category">${problem.category || "General"}</span>
      <span class="problem-difficulty difficulty-${(problem.difficulty || "medium").toLowerCase()}">${problem.difficulty || "Medium"}</span>
    </div>
    
    ${title !== `Problem #${problem.id}` ? `<h3 style="margin: 0.5rem 0;">${escapeHtml(title)}</h3>` : ""}
    
    ${problem.tags && problem.tags.length > 0 ? `
      <div class="problem-tags">
        ${problem.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
    ` : ""}
    
    <div class="problem-body">
      ${statementPreview}
    </div>
    
    <div class="problem-footer">
      <a href="problem.html?id=${problem.id}" class="btn">View Full Problem →</a>
    </div>
  `;
  
  return card;
}

// Get statement preview (first text block, truncated)
function getStatementPreview(statement = []) {
  if (!statement || statement.length === 0) {
    return "<p><em>No statement available</em></p>";
  }
  
  // Find first text block
  const firstTextBlock = statement.find(block => block.type === "text");
  
  if (firstTextBlock) {
    const content = firstTextBlock.content || "";
    const truncated = content.length > 250 ? content.substring(0, 250) + "..." : content;
    return `<p>${truncated}</p>`;
  }
  
  // If no text block, show placeholder
  return "<p><em>View problem for details</em></p>";
}

// Update pagination controls
function updatePagination() {
  const totalPages = Math.ceil(filteredProblems.length / ITEMS_PER_PAGE);
  
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages;
  
  pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

// Apply filters
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const categoryValue = categoryFilter.value;
  const difficultyValue = difficultyFilter.value;
  
  filteredProblems = allProblems.filter(problem => {
    // Search filter
    if (searchTerm) {
      const titleMatch = (problem.title || "").toLowerCase().includes(searchTerm);
      const tagsMatch = (problem.tags || []).some(tag => 
        tag.toLowerCase().includes(searchTerm)
      );
      const statementMatch = (problem.statement || []).some(block => 
        block.type === "text" && (block.content || "").toLowerCase().includes(searchTerm)
      );
      
      if (!titleMatch && !tagsMatch && !statementMatch) {
        return false;
      }
    }
    
    // Category filter
    if (categoryValue && problem.category !== categoryValue) {
      return false;
    }
    
    // Difficulty filter
    if (difficultyValue && problem.difficulty !== difficultyValue) {
      return false;
    }
    
    return true;
  });
  
  currentPage = 1;
  renderProblems();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
document.addEventListener("DOMContentLoaded", async () => {
  // Load categories into filter dropdown
  await populateCategorySelect(categoryFilter, '', true, 'All Categories');
  
  loadProblems();
  
  searchInput.addEventListener("input", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
  difficultyFilter.addEventListener("change", applyFilters);
  
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderProblems();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  
  nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(filteredProblems.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      renderProblems();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
});
