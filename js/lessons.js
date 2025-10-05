// js/lessons.js
import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "./firebase.js";

import { populateCategorySelect } from "./categories-utils.js";

let allLessons = [];
let filteredLessons = [];

const lessonsList = document.getElementById("lessons-list");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");

// Load all published lessons
async function loadLessons() {
  try {
    lessonsList.innerHTML = "<p>Loading lessons...</p>";
    
    const q = query(
      collection(db, "lessons"),
      where("draft", "==", false),
      orderBy("id")
    );
    
    const snapshot = await getDocs(q);
    allLessons = [];
    
    snapshot.forEach(doc => {
      allLessons.push({ docId: doc.id, ...doc.data() });
    });
    
    filteredLessons = [...allLessons];
    renderLessons();
  } catch (err) {
    console.error("Error loading lessons:", err);
    lessonsList.innerHTML = "<p>Error loading lessons. Please try again.</p>";
  }
}

// Render lessons
function renderLessons() {
  if (filteredLessons.length === 0) {
    lessonsList.innerHTML = "<p>No lessons found matching your criteria.</p>";
    return;
  }

  lessonsList.innerHTML = "";
  
  filteredLessons.forEach(lesson => {
    const card = createLessonCard(lesson);
    lessonsList.appendChild(card);
  });
  
  // Typeset MathJax after rendering
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([lessonsList]).catch(err => {
      console.error("MathJax error:", err);
    });
  }
}

// Create lesson card
function createLessonCard(lesson) {
  const card = document.createElement("div");
  card.className = "card lesson-card";
  
  const title = lesson.title || `Lesson #${lesson.id}`;
  const preview = getContentPreview(lesson.blocks);
  
  card.innerHTML = `
    ${lesson.cover ? `<img src="${escapeHtml(lesson.cover)}" alt="${escapeHtml(title)}" class="lesson-cover" />` : ""}
    
    <div class="card-content">
      <h3>${escapeHtml(title)}</h3>
      
      <div class="lesson-category">${escapeHtml(lesson.category || "General")}</div>
      
      ${lesson.tags && lesson.tags.length > 0 ? `
        <div class="lesson-tags">
          ${lesson.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      ` : ""}
      
      <div class="lesson-description">
        ${preview}
      </div>
      
      <div class="card-actions">
        <a href="lesson.html?id=${lesson.id}" class="btn">View Lesson →</a>
      </div>
    </div>
  `;
  
  return card;
}

// Get content preview from blocks
function getContentPreview(blocks = []) {
  if (!blocks || blocks.length === 0) {
    return "<em>No content available</em>";
  }
  
  const firstTextBlock = blocks.find(block => block.type === "text");
  
  if (firstTextBlock) {
    const content = firstTextBlock.content || "";
    const truncated = content.length > 150 ? content.substring(0, 150) + "..." : content;
    return truncated;
  }
  
  return "<em>View lesson for details</em>";
}

// Apply filters
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const categoryValue = categoryFilter.value;
  
  filteredLessons = allLessons.filter(lesson => {
    // Search filter
    if (searchTerm) {
      const titleMatch = (lesson.title || "").toLowerCase().includes(searchTerm);
      const tagsMatch = (lesson.tags || []).some(tag => 
        tag.toLowerCase().includes(searchTerm)
      );
      const categoryMatch = (lesson.category || "").toLowerCase().includes(searchTerm);
      
      if (!titleMatch && !tagsMatch && !categoryMatch) {
        return false;
      }
    }
    
    // Category filter
    if (categoryValue && lesson.category !== categoryValue) {
      return false;
    }
    
    return true;
  });
  
  renderLessons();
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
  
  loadLessons();
  
  searchInput.addEventListener("input", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
});
