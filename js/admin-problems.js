// js/admin-problems.js - Fixed version with math rendering
import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "../js/firebase.js";

import { populateCategorySelect } from "../js/categories-utils.js";

let allProblems = [];
let filteredProblems = [];

const problemsList = document.getElementById("problems-list");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const difficultyFilter = document.getElementById("difficulty-filter");
const draftFilter = document.getElementById("draft-filter");
const addProblemBtn = document.getElementById("add-problem-btn");

// Load all problems (including drafts)
async function loadProblems() {
  try {
    problemsList.innerHTML = "<p>Loading problems...</p>";
    
    const q = query(collection(db, "problems"), orderBy("id", "desc"));
    const snapshot = await getDocs(q);
    
    allProblems = [];
    snapshot.forEach(doc => {
      allProblems.push({ docId: doc.id, ...doc.data() });
    });
    
    filteredProblems = [...allProblems];
    renderProblems();
  } catch (err) {
    console.error("Error loading problems:", err);
    problemsList.innerHTML = "<p>Error loading problems. Please try again.</p>";
  }
}

// Render problems
function renderProblems() {
  if (filteredProblems.length === 0) {
    problemsList.innerHTML = "<p>No problems found matching your criteria.</p>";
    return;
  }

  problemsList.innerHTML = "";
  
  filteredProblems.forEach(problem => {
    const card = createProblemCard(problem);
    problemsList.appendChild(card);
  });
  
  // Process MathJax after rendering all cards
  processMath([problemsList]);
}

// Process MathJax on elements
function processMath(elements) {
  if (window.MathJax && window.MathJax.typesetPromise) {
    setTimeout(() => {
      window.MathJax.typesetPromise(elements).catch(err => {
        console.error("MathJax error:", err);
      });
    }, 100);
  }
}

// Create problem card
function createProblemCard(problem) {
  const card = document.createElement("div");
  card.className = `problem-card-wide ${problem.draft ? 'draft-card' : ''}`;
  
  const title = problem.title || `Problem #${problem.id}`;
  const statementPreview = getStatementPreview(problem.statement);
  
  card.innerHTML = `
    <div class="problem-header">
      <span class="problem-id">#${problem.id}</span>
      <span class="problem-category">${problem.category || "General"}</span>
      <span class="problem-difficulty difficulty-${(problem.difficulty || "medium").toLowerCase()}">${problem.difficulty || "Medium"}</span>
      ${problem.draft ? '<span class="draft-badge">DRAFT</span>' : ''}
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
      <a href="../problem.html?id=${problem.id}" class="btn btn-small btn-secondary" target="_blank">👁️ View</a>
      <a href="edit-problem.html?id=${problem.id}" class="btn btn-small btn-edit">✏️ Edit</a>
      <button class="btn btn-small btn-delete" data-id="${problem.id}">🗑️ Delete</button>
    </div>
  `;
  
  // Attach delete handler
  const deleteBtn = card.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', () => deleteProblem(problem.id));
  
  return card;
}

// Get statement preview with math support
function getStatementPreview(statement = []) {
  if (!statement || statement.length === 0) {
    return "<p><em>No statement available</em></p>";
  }
  
  const firstTextBlock = statement.find(block => block.type === "text");
  
  if (firstTextBlock) {
    const content = firstTextBlock.content || "";
    
    // For preview, we want to show some content but not full HTML rendering
    // Extract text but preserve basic math markers for display
    const temp = document.createElement('div');
    temp.innerHTML = content;
    
    // Get text content but preserve some structure
    let textOnly = temp.textContent || temp.innerText || "";
    
    // Truncate to 200 chars
    const truncated = textOnly.length > 200 ? textOnly.substring(0, 200) + "..." : textOnly;
    
    // Return as text that can still show math formulas
    // We keep it simple for admin preview
    return `<p>${escapeHtml(truncated)}</p>`;
  }
  
  return "<p><em>View problem for details</em></p>";
}

// Delete problem
async function deleteProblem(problemId) {
  if (!confirm(`Are you sure you want to delete Problem #${problemId}? This action cannot be undone.`)) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, "problems", String(problemId)));
    alert(`Problem #${problemId} deleted successfully.`);
    loadProblems();
  } catch (err) {
    console.error("Error deleting problem:", err);
    alert("Failed to delete problem: " + err.message);
  }
}

// Apply filters
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const categoryValue = categoryFilter.value;
  const difficultyValue = difficultyFilter.value;
  const draftValue = draftFilter.value;
  
  filteredProblems = allProblems.filter(problem => {
    // Search filter
    if (searchTerm) {
      const titleMatch = (problem.title || "").toLowerCase().includes(searchTerm);
      const idMatch = String(problem.id).includes(searchTerm);
      const tagsMatch = (problem.tags || []).some(tag => 
        tag.toLowerCase().includes(searchTerm)
      );
      
      if (!titleMatch && !idMatch && !tagsMatch) {
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
    
    // Draft filter
    if (draftValue === "published" && problem.draft) {
      return false;
    }
    if (draftValue === "draft" && !problem.draft) {
      return false;
    }
    
    return true;
  });
  
  renderProblems();
}

// Create new problem
async function createNewProblem() {
  try {
    // Get latest ID from meta/problems
    const metaDocRef = doc(db, "meta", "problems");
    const metaDoc = await getDoc(metaDocRef);
    
    let nextId = 1;
    if (metaDoc.exists() && metaDoc.data().latestId) {
      nextId = metaDoc.data().latestId + 1;
    }
    
    // Create draft problem
    await setDoc(doc(db, "problems", String(nextId)), {
      id: nextId,
      title: "",
      category: "",
      difficulty: "Medium",
      tags: [],
      statement: [],
      solutions: [],
      lessons: [],
      draft: true,
      author: "admin",
      timestamp: serverTimestamp()
    });
    
    // Update meta
    await setDoc(metaDocRef, { latestId: nextId }, { merge: true });
    
    // Redirect to edit page
    window.location.href = `edit-problem.html?id=${nextId}`;
  } catch (err) {
    console.error("Error creating problem:", err);
    alert("Failed to create problem: " + err.message);
  }
}

// Escape HTML
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
  draftFilter.addEventListener("change", applyFilters);
  
  addProblemBtn.addEventListener("click", createNewProblem);
});
