// js/categories-utils.js
// Shared utilities for loading and populating categories

import { db, collection, getDocs } from "./firebase.js";

let cachedCategories = null;

/**
 * Load all categories from Firebase
 * @returns {Promise<Array>} Array of category objects
 */
export async function loadCategories() {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    const categories = [];
    snap.forEach(doc => {
      categories.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort alphabetically by English name
    categories.sort((a, b) => (a.nameEn || '').localeCompare(b.nameEn || ''));
    
    cachedCategories = categories;
    return categories;
  } catch (err) {
    console.error('Error loading categories:', err);
    return [];
  }
}

/**
 * Get cached categories (or load if not cached)
 * @returns {Promise<Array>} Array of category objects
 */
export async function getCategories() {
  if (cachedCategories) {
    return cachedCategories;
  }
  return await loadCategories();
}

/**
 * Populate a select element with categories
 * @param {HTMLSelectElement} selectElement - The select element to populate
 * @param {string} selectedValue - The value to pre-select (optional)
 * @param {boolean} includeEmpty - Whether to include an empty option (default: true)
 * @param {string} emptyText - Text for empty option (default: "Select Category")
 */
export async function populateCategorySelect(selectElement, selectedValue = '', includeEmpty = true, emptyText = 'Select Category') {
  if (!selectElement) {
    console.error('Select element not found');
    return;
  }

  const categories = await getCategories();
  
  // Clear existing options
  selectElement.innerHTML = '';
  
  // Add empty option if requested
  if (includeEmpty) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = emptyText;
    selectElement.appendChild(emptyOption);
  }
  
  // Add category options
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.nameEn;
    option.textContent = cat.nameEn;
    if (cat.nameEn === selectedValue) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });
}

/**
 * Refresh category cache
 */
export function clearCategoryCache() {
  cachedCategories = null;
}
