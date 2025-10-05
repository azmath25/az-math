// js/admin-lessons.js
import {
  db,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "../js/firebase.js";

let allLessons = [];
let filteredLessons = [];

const lessonsList = document.getElementById("lessons-list");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const draftFilter = document.getElementById("draft-filter");
const addLessonBtn = document.getElementById("add-lesson-btn");

// Load all lessons (including drafts)
async function loadLessons() {
  try {
    lessonsList.innerHTML = "<p>Loading lessons...</p>";
    
    const q = query(collection(db, "lessons"), orderBy("id", "desc"));
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
}

// Create lesson card
function createLessonCard(lesson) {
  const card = document.createElement("div");
  card.className = `card lesson-card ${lesson.draft ? 'draft-card' : ''}`;
  
  const title = lesson.title || `Lesson #${lesson.id}`;
  const preview = getContentPreview(lesson.blocks);
  
  card.innerHTML = `
    ${lesson.cover ? `<img src="${escapeHtml(lesson.cover)}" alt="${escapeHtml(title)}" class="lesson-cover" />` : ""}
    
    <div class="card-content">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <h3 style="margin: 0;">${escapeHtml(title)}</h3>
        ${lesson.draft ? '<span class="draft-badge">DRAFT</span>' : ''}
      </div>
      
      <div class="lesson-category" style="margin-top: 0.5rem;">
        <strong>#${lesson.id}</strong> · ${escapeHtml(lesson.category || "General")}
      </div>
      
      ${lesson.tags && lesson.tags.length > 0 ? `
        <div class="lesson-tags" style="margin-top: 0.5rem;">
          ${lesson.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      ` : ""}
      
      <div class="lesson-description" style="margin-top: 0.5rem;">
        ${preview}
      </div>
      
      <div class="card-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
        <a href="../lesson.html?id=${lesson.id}" class="btn btn-small btn-secondary" target="_blank">👁️ View</a>
        <a href="edit-lesson.html?id=${lesson.id}" class="btn btn-small btn-edit">✏️ Edit</a>
        <button class="btn btn-small btn-delete" data-id="${lesson.id}">🗑️ Delete</button>
      </div>
    </div>
  `;
  
  // Attach delete handler
  const deleteBtn = card.querySelector('.btn-delete');
  deleteBtn.addEventListener('click', () => deleteLesson(lesson.id));
  
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
    const truncated = content.length > 120 ? content.substring(0, 120) + "..." : content;
    return escapeHtml(truncated);
  }
  
  return "<em>View lesson for details</em>";
}

// Delete lesson
async function deleteLesson(lessonId) {
  if (!confirm(`Are you sure you want to delete Lesson #${lessonId}? This action cannot be undone.`)) {
    return;
  }
  
  try {
    await deleteDoc(doc(db, "lessons", String(lessonId)));
    alert(`Lesson #${lessonId} deleted successfully.`);
    loadLessons();
  } catch (err) {
    console.error("Error deleting lesson:", err);
    alert("Failed to delete lesson: " + err.message);
  }
}

// Apply filters
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const categoryValue = categoryFilter.value;
  const draftValue = draftFilter.value;
  
  filteredLessons = allLessons.filter(lesson => {
    // Search filter
    if (searchTerm) {
      const titleMatch = (lesson.title || "").toLowerCase().includes(searchTerm);
      const idMatch = String(lesson.id).includes(searchTerm);
      const tagsMatch = (lesson.tags || []).some(tag => 
        tag.toLowerCase().includes(searchTerm)
      );
      const categoryMatch = (lesson.category || "").toLowerCase().includes(searchTerm);
      
      if (!titleMatch && !idMatch && !tagsMatch && !categoryMatch) {
        return false;
      }
    }
    
    // Category filter
    if (categoryValue && lesson.category !== categoryValue) {
      return false;
    }
    
    // Draft filter
    if (draftValue === "published" && lesson.draft) {
      return false;
    }
    if (draftValue === "draft" && !lesson.draft) {
      return false;
    }
    
    return true;
  });
  
  renderLessons();
}

// Create new lesson - FIXED VERSION
async function createNewLesson() {
  try {
    // Show loading state
    addLessonBtn.disabled = true;
    addLessonBtn.textContent = "Creating...";
    
    // Get latest ID from meta/lessons
    const metaDocRef = doc(db, "meta", "lessons");
    const metaDoc = await getDoc(metaDocRef);
    
    let nextId = 1;
    if (metaDoc.exists() && metaDoc.data().latestId) {
      nextId = metaDoc.data().latestId + 1;
    } else {
      // If meta doc doesn't exist, check existing lessons to find max ID
      const lessonsSnap = await getDocs(collection(db, "lessons"));
      let maxId = 0;
      lessonsSnap.forEach(doc => {
        const id = doc.data().id;
        if (id > maxId) maxId = id;
      });
      nextId = maxId + 1;
    }
    
    console.log("Creating lesson with ID:", nextId);
    
    // Create draft lesson
    await setDoc(doc(db, "lessons", String(nextId)), {
      id: nextId,
      title: "",
      category: "",
      tags: [],
      cover: "",
      blocks: [],
      problems: [],
      draft: true,
      author: "admin",
      timestamp: serverTimestamp()
    });
    
    // Update meta
    await setDoc(metaDocRef, { latestId: nextId }, { merge: true });
    
    console.log("Lesson created successfully, redirecting...");
    
    // Redirect to edit page
    window.location.href = `edit-lesson.html?id=${nextId}`;
  } catch (err) {
    console.error("Error creating lesson:", err);
    alert("Failed to create lesson: " + err.message);
    
    // Reset button state
    addLessonBtn.disabled = false;
    addLessonBtn.textContent = "➕ Add New Lesson";
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("Admin Lessons page loaded");
  
  // Check if elements exist
  if (!lessonsList) console.error("lessons-list element not found");
  if (!searchInput) console.error("search-input element not found");
  if (!categoryFilter) console.error("category-filter element not found");
  if (!draftFilter) console.error("draft-filter element not found");
  if (!addLessonBtn) console.error("add-lesson-btn element not found");
  
  loadLessons();
  
  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (categoryFilter) categoryFilter.addEventListener("change", applyFilters);
  if (draftFilter) draftFilter.addEventListener("change", applyFilters);
  
  if (addLessonBtn) {
    addLessonBtn.addEventListener("click", createNewLesson);
    console.log("Add lesson button event listener attached");
  }
});
