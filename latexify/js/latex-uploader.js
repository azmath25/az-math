// enhanced-latex-uploader.js - Upload handler with full LaTeX support

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Global state
let parsedData = null;
let uploadedImages = {};

/**
 * Parse LaTeX text from textarea
 */
window.parseLatexText = async function() {
  const latexInput = document.getElementById('latex-input').value.trim();
  
  if (!latexInput) {
    showStatus('Please paste LaTeX code', 'error');
    return;
  }
  
  try {
    showProgress('Parsing LaTeX with full command support...', 30);
    
    // Use enhanced parser
    const parser = new window.EnhancedLaTeXParser();
    parsedData = parser.parse(latexInput);
    
    // Convert to Az-Math format
    const azMathFormat = parser.toAzMathFormat();
    azMathFormat.latex.source = latexInput;
    parsedData.azMathFormat = azMathFormat;
    
    showProgress('Rendering preview with MathJax...', 60);
    
    // Fill metadata inputs
    fillMetadataInputs(parsedData.metadata);
    
    // Render preview
    await renderPreview(azMathFormat);
    
    showProgress('Complete!', 100);
    setTimeout(() => hideProgress(), 500);
    
    // Show preview area
    document.getElementById('preview-area').style.display = 'block';
    document.getElementById('preview-area').scrollIntoView({ behavior: 'smooth' });
    
    showStatus('✓ LaTeX parsed successfully with full command support!', 'success');
    
  } catch (error) {
    console.error('Parse error:', error);
    showStatus('Error parsing LaTeX: ' + error.message, 'error');
    hideProgress();
  }
}

/**
 * Handle ZIP file upload
 */
window.handleZipUpload = async function(file) {
  if (!file || !file.name.endsWith('.zip')) {
    showStatus('Please upload a ZIP file', 'error');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    showStatus('File too large (max 10MB)', 'error');
    return;
  }
  
  try {
    showProgress('Reading ZIP file...', 10);
    document.getElementById('zip-status').textContent = '📦 Processing: ' + file.name;
    
    // Load ZIP
    const zip = await JSZip.loadAsync(file);
    
    showProgress('Extracting files...', 30);
    
    // Find main .tex file
    let mainTex = null;
    const texFiles = [];
    
    zip.forEach((path, zipEntry) => {
      if (path.endsWith('.tex') && !zipEntry.dir) {
        texFiles.push({ path, zipEntry });
      }
    });
    
    if (texFiles.length === 0) {
      throw new Error('No .tex file found in ZIP');
    }
    
    // Priority: main.tex > problem.tex > first .tex
    let mainFile = texFiles.find(f => f.path.includes('main.tex'));
    if (!mainFile) mainFile = texFiles.find(f => f.path.includes('problem.tex'));
    if (!mainFile) mainFile = texFiles[0];
    
    mainTex = await mainFile.zipEntry.async('text');
    
    showProgress('Parsing LaTeX with full command support...', 50);
    
    // Parse LaTeX with enhanced parser
    const parser = new window.EnhancedLaTeXParser();
    parsedData = parser.parse(mainTex);
    
    // Extract images
    showProgress('Extracting images...', 70);
    const images = [];
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.pdf', '.svg'];
    
    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;
      
      const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
      if (imageExtensions.includes(ext)) {
        const blob = await zipEntry.async('blob');
        const filename = path.split('/').pop();
        images.push({ filename, blob, path });
      }
    }
    
    parsedData.extractedImages = images;
    
    // Convert to Az-Math format
    const azMathFormat = parser.toAzMathFormat();
    azMathFormat.latex.source = mainTex;
    parsedData.azMathFormat = azMathFormat;
    
    showProgress('Rendering preview...', 90);
    
    // Fill metadata
    fillMetadataInputs(parsedData.metadata);
    
    // Render preview
    await renderPreview(azMathFormat);
    
    showProgress('Complete!', 100);
    setTimeout(() => hideProgress(), 500);
    
    // Show preview
    document.getElementById('preview-area').style.display = 'block';
    document.getElementById('preview-area').scrollIntoView({ behavior: 'smooth' });
    
    const imgCount = images.length;
    document.getElementById('zip-status').textContent = 
      `✓ Extracted: ${texFiles.length} .tex file(s), ${imgCount} image(s)`;
    
    showStatus('✓ ZIP processed with full LaTeX support!', 'success');
    
  } catch (error) {
    console.error('ZIP processing error:', error);
    showStatus('Error processing ZIP: ' + error.message, 'error');
    document.getElementById('zip-status').textContent = '✗ Failed: ' + error.message;
    hideProgress();
  }
}

/**
 * Fill metadata input fields
 */
function fillMetadataInputs(metadata) {
  if (metadata.title) {
    document.getElementById('problem-title').value = metadata.title;
  }
  if (metadata.category) {
    document.getElementById('problem-category').value = metadata.category;
  }
  if (metadata.difficulty) {
    document.getElementById('problem-difficulty').value = metadata.difficulty;
  }
  if (metadata.tags && metadata.tags.length > 0) {
    document.getElementById('problem-tags').value = metadata.tags.join(', ');
  }
}

/**
 * Render preview of parsed content
 */
async function renderPreview(azMathFormat) {
  const previewDiv = document.getElementById('rendered-preview');
  
  let html = '<div class="preview-problem">';
  
  // Problem Statement
  html += '<h3>Problem Statement</h3>';
  html += '<div class="preview-section">';
  
  if (azMathFormat.statement && azMathFormat.statement.length > 0) {
    azMathFormat.statement.forEach(block => {
      if (block.type === 'text') {
        html += block.content;
      } else if (block.type === 'image') {
        html += `<p><em>[Image: ${block.filename || 'unnamed'}]</em></p>`;
      }
    });
  } else {
    html += '<p><em>No statement content</em></p>';
  }
  
  html += '</div>';
  
  // Solutions
  if (azMathFormat.solutions && azMathFormat.solutions.length > 0) {
    html += '<h3>Solutions</h3>';
    
    azMathFormat.solutions.forEach((solution, idx) => {
      html += `<div class="preview-solution">`;
      html += `<h4>${solution.title || 'Solution ' + (idx + 1)}</h4>`;
      
      if (solution.blocks && solution.blocks.length > 0) {
        solution.blocks.forEach(block => {
          if (block.type === 'text') {
            html += block.content;
          } else if (block.type === 'image') {
            html += `<p><em>[Image: ${block.filename || 'unnamed'}]</em></p>`;
          }
        });
      }
      
      html += '</div>';
    });
  }
  
  html += '</div>';
  
  previewDiv.innerHTML = html;
  
  // Typeset math with MathJax
  if (window.MathJax && window.MathJax.typesetPromise) {
    await window.MathJax.typesetPromise([previewDiv]);
  }
}

/**
 * Save problem to Firebase
 */
window.saveProblem = async function() {
  if (!parsedData) {
    showStatus('No data to save', 'error');
    return;
  }
  
  try {
    showProgress('Preparing data...', 10);
    
    // Get problem ID
    let problemId = parseInt(document.getElementById('problem-id').value);
    
    if (!problemId || problemId <= 0) {
      // Auto-generate ID
      problemId = await getNextProblemId();
      document.getElementById('problem-id').value = problemId;
    }
    
    // Get metadata from inputs
    const metadata = {
      title: document.getElementById('problem-title').value.trim() || `Problem #${problemId}`,
      category: document.getElementById('problem-category').value || parsedData.metadata.category,
      difficulty: document.getElementById('problem-difficulty').value,
      tags: document.getElementById('problem-tags').value
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    };
    
    showProgress('Uploading images...', 30);
    
    // Upload images if any
    if (parsedData.extractedImages && parsedData.extractedImages.length > 0) {
      uploadedImages = await uploadImages(parsedData.extractedImages, problemId);
      
      // Update image URLs in blocks
      updateImageUrls(parsedData.azMathFormat, uploadedImages);
    }
    
    showProgress('Saving to database...', 70);
    
    // Create problem document
    const problemData = {
      id: problemId,
      ...metadata,
      statement: parsedData.azMathFormat.statement,
      solutions: parsedData.azMathFormat.solutions,
      lessons: [],
      contentType: 'latex',
      latex: parsedData.azMathFormat.latex,
      images: uploadedImages,
      draft: false,
      author: 'admin',
      timestamp: serverTimestamp()
    };
    
    // Save to Firestore
    await setDoc(doc(window.db, 'problems', String(problemId)), problemData);
    
    console.log('[Save] Successfully saved problem #' + problemId);
    
    showProgress('Complete!', 100);
    setTimeout(() => hideProgress(), 500);
    
    showStatus(`✓ Problem #${problemId} saved successfully with full LaTeX support!`, 'success');
    
    // Show link to view
    setTimeout(() => {
      if (confirm('Problem saved! View it now?')) {
        window.open(`../problem.html?id=${problemId}`, '_blank');
      }
    }, 1000);
    
  } catch (error) {
    console.error('Save error:', error);
    showStatus('Error saving: ' + error.message, 'error');
    hideProgress();
  }
}

/**
 * Get next available problem ID
 */
async function getNextProblemId() {
  try {
    const q = query(
      collection(window.db, 'problems'),
      orderBy('id', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const highestId = snapshot.docs[0].data().id;
      console.log('[ID] Found highest ID:', highestId);
      return highestId + 1;
    }
    
    console.log('[ID] No problems found, starting from 1');
    return 1;
    
  } catch (error) {
    console.error('[ID] Error getting next ID:', error);
    const fallbackId = 1000 + (Date.now() % 9000);
    console.log('[ID] Using fallback ID:', fallbackId);
    return fallbackId;
  }
}

/**
 * Upload images to Firebase Storage
 */
async function uploadImages(images, problemId) {
  const urls = {};
  
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    
    showProgress(`Uploading image ${i + 1}/${images.length}...`, 30 + (i / images.length) * 40);
    
    try {
      const storageRef = ref(
        window.storage, 
        `problem_images/${problemId}/${img.filename}`
      );
      
      await uploadBytes(storageRef, img.blob);
      const url = await getDownloadURL(storageRef);
      
      urls[img.filename] = url;
      
    } catch (error) {
      console.error('Image upload failed:', img.filename, error);
    }
  }
  
  return urls;
}

/**
 * Update image URLs in parsed data
 */
function updateImageUrls(azMathFormat, uploadedImages) {
  // Update statement blocks
  if (azMathFormat.statement) {
    azMathFormat.statement.forEach(block => {
      if (block.type === 'image' && block.filename) {
        block.url = uploadedImages[block.filename] || '';
      }
    });
  }
  
  // Update solution blocks
  if (azMathFormat.solutions) {
    azMathFormat.solutions.forEach(solution => {
      if (solution.blocks) {
        solution.blocks.forEach(block => {
          if (block.type === 'image' && block.filename) {
            block.url = uploadedImages[block.filename] || '';
          }
        });
      }
    });
  }
}

/**
 * Show progress bar
 */
function showProgress(message, percent) {
  const progressBar = document.getElementById('progress-bar');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  
  progressBar.style.display = 'block';
  progressFill.style.width = percent + '%';
  progressText.textContent = message;
}

/**
 * Hide progress bar
 */
function hideProgress() {
  document.getElementById('progress-bar').style.display = 'none';
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status-message show ${type}`;
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 5000);
}
