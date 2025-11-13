// js/photo-utils.js - FIXED photo upload path handling
import { storage, ref, uploadBytes, getDownloadURL } from "./firebase.js";

/**
 * Optimize image before upload (resize if too large, compress)
 */
export async function optimizeImage(blob, options = {}) {
  const config = {
    maxWidth: options.maxWidth || 1920,
    maxHeight: options.maxHeight || 1920,
    quality: options.quality || 0.85,
    format: options.format || 'image/jpeg'
  };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let width = img.width;
      let height = img.height;
      const needsResize = width > config.maxWidth || height > config.maxHeight;

      if (needsResize) {
        if (width > height) {
          if (width > config.maxWidth) {
            height = Math.round((height * config.maxWidth) / width);
            width = config.maxWidth;
          }
        } else {
          if (height > config.maxHeight) {
            width = Math.round((width * config.maxHeight) / height);
            height = config.maxHeight;
          }
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (optimizedBlob) => {
          if (optimizedBlob) {
            console.log(`[Optimize] Original: ${(blob.size / 1024).toFixed(0)}KB → Optimized: ${(optimizedBlob.size / 1024).toFixed(0)}KB`);
            resolve(optimizedBlob);
          } else {
            reject(new Error('Failed to optimize image'));
          }
        },
        config.format,
        config.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for optimization'));
    };

    img.src = url;
  });
}

/**
 * Archive old photo before uploading new one
 */
export async function archiveOldPhoto(currentPhotoURL, userId, options = {}) {
  if (!currentPhotoURL || !currentPhotoURL.includes('firebasestorage.googleapis.com')) {
    console.log('[Archive] No valid photo to archive');
    return null;
  }

  try {
    const urlObj = new URL(currentPhotoURL);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)\?/);
    if (!pathMatch) {
      console.warn('[Archive] Could not extract path from URL');
      return null;
    }

    const oldPath = decodeURIComponent(pathMatch[1]);
    const timestamp = Date.now();
    const archivePath = `profile_photos/${userId}/archive/${timestamp}_archived.jpg`;

    const oldRef = ref(storage, oldPath);
    const oldURL = await getDownloadURL(oldRef);
    const response = await fetch(oldURL);
    const blob = await response.blob();

    const archiveRef = ref(storage, archivePath);
    await uploadBytes(archiveRef, blob);

    console.log('[Archive] Successfully archived old photo:', archivePath);
    return archivePath;

  } catch (err) {
    console.error('[Archive] Failed to archive photo:', err);
    return null;
  }
}

/**
 * Validate image URL
 */
export async function validateImageUrl(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') {
      resolve({ valid: false, error: 'Invalid URL' });
      return;
    }

    try {
      new URL(url);
    } catch {
      resolve({ valid: false, error: 'Malformed URL' });
      return;
    }

    const img = new Image();
    
    img.onload = () => {
      resolve({
        valid: true,
        width: img.width,
        height: img.height,
        aspectRatio: img.width / img.height
      });
    };

    img.onerror = () => {
      resolve({ valid: false, error: 'Failed to load image' });
    };

    setTimeout(() => {
      if (!img.complete) {
        img.src = '';
        resolve({ valid: false, error: 'Load timeout' });
      }
    }, 10000);

    img.src = url;
  });
}

/**
 * Upload multiple photos
 */
export async function uploadMultiplePhotos(files, basePath) {
  const urls = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      const optimized = await optimizeImage(file);
      const filename = `${basePath}/${Date.now()}_${i}.jpg`;
      const url = await uploadPhotoToStorage(optimized, filename);
      
      urls.push(url);
      console.log(`[Batch Upload] ${i + 1}/${files.length} uploaded`);
      
    } catch (err) {
      console.error(`[Batch Upload] Failed to upload file ${i}:`, err);
      errors.push({ index: i, filename: file.name, error: err.message });
    }
  }

  if (errors.length > 0) {
    console.warn('[Batch Upload] Some uploads failed:', errors);
  }

  return { urls, errors };
}

/**
 * FIXED: Upload photo blob to Firebase Storage
 * @param {Blob} blob - Image blob to upload
 * @param {string} path - Storage path (folder path like "profile_photos/userId")
 * @param {Object} options - Upload options
 * @returns {Promise<string>} Download URL
 */
export async function uploadPhotoToStorage(blob, path, options = {}) {
  try {
    const { currentPhotoURL, userId } = options;

    console.log('[Upload] Input path:', path);
    console.log('[Upload] Options:', options);

    // Archive old photo if updating
    if (currentPhotoURL && userId && path.includes('profile_photos')) {
      await archiveOldPhoto(currentPhotoURL, userId);
    }

    // FIXED: Determine the correct full path with filename
    let fullPath;
    
    // Normalize path by removing trailing slashes
    const cleanPath = path.replace(/\/+$/, '');
    
    console.log('[Upload] Clean path:', cleanPath);
    console.log('[Upload] Path includes profile_photos:', cleanPath.includes('profile_photos'));
    
    // Check if path is for profile photos
    if (cleanPath.includes('profile_photos')) {
      // Profile photo: always use "profile.jpg" as filename
      fullPath = `${cleanPath}/profile.jpg`;
      console.log('[Upload] Profile photo detected, using:', fullPath);
    } else if (cleanPath.includes('problem_images')) {
      // Problem images: add timestamp for uniqueness
      fullPath = `${cleanPath}_${Date.now()}.jpg`;
      console.log('[Upload] Problem image detected, using:', fullPath);
    } else {
      // Default: add timestamp
      fullPath = `${cleanPath}_${Date.now()}.jpg`;
      console.log('[Upload] Default path, using:', fullPath);
    }
    
    console.log('[Upload] Final full path for upload:', fullPath);
    
    const storageRef = ref(storage, fullPath);
    
    await uploadBytes(storageRef, blob, {
      contentType: "image/jpeg",
      cacheControl: 'public, max-age=31536000'
    });
    
    const downloadURL = await getDownloadURL(storageRef);
    console.log('[Upload] ✅ Successfully uploaded photo to:', fullPath);
    console.log('[Upload] Download URL:', downloadURL);
    return downloadURL;

  } catch (err) {
    console.error('[Upload] ❌ Error uploading photo:', err);
    console.error('[Upload] Attempted path:', path);
    throw new Error("Failed to upload photo: " + err.message);
  }
}

/**
 * Create and show photo upload modal with cropping and effects
 */
export function openPhotoUploadModal(options = {}) {
  const {
    currentPhotoURL = null,
    aspectRatio = 1,
    cropShape = 'circle',
    onSave = () => {},
    onCancel = () => {},
    showEffects = true,
    allowRotation = true
  } = options;

  // Create modal
  const modal = document.createElement("div");
  modal.className = "photo-modal-overlay";
  modal.innerHTML = `
    <div class="photo-modal">
      <div class="photo-modal-header">
        <h3>📷 Upload Image</h3>
        <button class="photo-modal-close" aria-label="Close">&times;</button>
      </div>
      
      <div class="photo-modal-body">
        <div class="photo-upload-area" id="photo-upload-area">
          <div class="photo-upload-placeholder" id="photo-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <p style="font-size: 1.125rem; font-weight: 500; margin: 1rem 0 0.5rem;">Click to upload or drag & drop</p>
            <p class="photo-upload-hint">JPG, PNG or GIF (Max 5MB)</p>
            <p class="photo-upload-hint" style="margin-top: 0.5rem;">💡 Tip: You can also paste from clipboard (Ctrl+V)</p>
          </div>
          ${currentPhotoURL ? `
            <img src="${currentPhotoURL}" alt="Current photo" id="photo-preview" 
                 style="max-width: 200px; max-height: 200px; ${cropShape === 'circle' ? 'border-radius: 50%;' : 'border-radius: 10px;'} 
                 object-fit: cover; margin-top: 1rem;" />
          ` : ''}
          <input type="file" id="photo-file-input" accept="image/*" style="display: none;" />
        </div>
        
        <div class="photo-crop-container" id="photo-crop-container" style="display: none;">
          <div class="crop-canvas-wrapper">
            <canvas id="photo-crop-canvas"></canvas>
          </div>
          <div class="photo-crop-controls">
            <button type="button" class="btn btn-small" id="zoom-in-btn">🔍+ Zoom In</button>
            <button type="button" class="btn btn-small" id="zoom-out-btn">🔍- Zoom Out</button>
            <button type="button" class="btn btn-small btn-secondary" id="reset-crop-btn">🔄 Reset</button>
            ${allowRotation ? '<button type="button" class="btn btn-small btn-secondary" id="rotate-btn">↻ Rotate 90°</button>' : ''}
            ${showEffects ? '<button type="button" class="btn btn-small btn-secondary" id="effects-btn">✨ Effects</button>' : ''}
          </div>
          <p class="crop-hint">💡 Drag to reposition • Scroll to zoom • Use buttons for fine control</p>
        </div>
      </div>
      
      <div class="photo-modal-footer">
        <button type="button" class="btn btn-secondary" id="photo-cancel-btn">Cancel</button>
        <button type="button" class="btn" id="photo-save-btn" style="display: none;">Save Image</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  addPhotoModalStyles();

  // Get elements
  const uploadArea = modal.querySelector("#photo-upload-area");
  const fileInput = modal.querySelector("#photo-file-input");
  const cropContainer = modal.querySelector("#photo-crop-container");
  const canvas = modal.querySelector("#photo-crop-canvas");
  const ctx = canvas.getContext("2d");
  const closeBtn = modal.querySelector(".photo-modal-close");
  const cancelBtn = modal.querySelector("#photo-cancel-btn");
  const saveBtn = modal.querySelector("#photo-save-btn");
  const zoomInBtn = modal.querySelector("#zoom-in-btn");
  const zoomOutBtn = modal.querySelector("#zoom-out-btn");
  const resetBtn = modal.querySelector("#reset-crop-btn");
  const rotateBtn = modal.querySelector("#rotate-btn");
  const effectsBtn = modal.querySelector("#effects-btn");

  let currentImage = null;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let brightness = 0;
  let contrast = 0;
  let saturation = 0;

  // Close modal
  const closeModal = () => {
    modal.remove();
    onCancel();
  };

  // Upload area click
  uploadArea.addEventListener("click", (e) => {
    if (e.target.id !== "photo-preview" && !e.target.closest('img')) {
      fileInput.click();
    }
  });

  // Drag and drop
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "#3b82f6";
    uploadArea.style.background = "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)";
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.style.borderColor = "#e2e8f0";
    uploadArea.style.background = "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)";
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "#e2e8f0";
    uploadArea.style.background = "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)";
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });

  // Clipboard paste
  const pasteHandler = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        handleFileSelect(file);
        return;
      }
    }
  };
  
  document.addEventListener('paste', pasteHandler);

  // File input change
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  // Handle file selection
  function handleFileSelect(file) {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        currentImage = img;
        rotation = 0;
        brightness = 0;
        contrast = 0;
        saturation = 0;
        initializeCropper();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Initialize cropper
  function initializeCropper() {
    uploadArea.style.display = "none";
    cropContainer.style.display = "block";
    saveBtn.style.display = "inline-block";

    const maxSize = 500;
    let canvasWidth, canvasHeight;
    
    if (cropShape === 'circle') {
      canvasWidth = canvasHeight = maxSize;
    } else {
      if (aspectRatio >= 1) {
        canvasWidth = maxSize;
        canvasHeight = maxSize / aspectRatio;
      } else {
        canvasHeight = maxSize;
        canvasWidth = maxSize * aspectRatio;
      }
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const scaleX = canvasWidth / currentImage.width;
    const scaleY = canvasHeight / currentImage.height;
    scale = Math.max(scaleX, scaleY);
    
    offsetX = (canvasWidth - currentImage.width * scale) / 2;
    offsetY = (canvasHeight - currentImage.height * scale) / 2;

    drawImage();
  }

  // Draw image with effects
  function drawImage() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCheckerboard();
    
    ctx.save();
    ctx.filter = `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100})`;
    
    if (rotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }
    
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(currentImage, 0, 0);
    ctx.restore();

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const cropMargin = 10;
    
    if (cropShape === 'circle') {
      const radius = (canvas.width / 2) - cropMargin;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      
    } else {
      const cropWidth = canvas.width - (cropMargin * 2);
      const cropHeight = canvas.height - (cropMargin * 2);
      
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(cropMargin, cropMargin, cropWidth, cropHeight);
      
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 8;
      ctx.strokeRect(cropMargin, cropMargin, cropWidth, cropHeight);
    }
    
    ctx.shadowBlur = 0;
  }

  // Draw checkerboard background
  function drawCheckerboard() {
    const squareSize = 20;
    const lightColor = "#ffffff";
    const darkColor = "#e5e7eb";
    
    for (let y = 0; y < canvas.height; y += squareSize) {
      for (let x = 0; x < canvas.width; x += squareSize) {
        const isEven = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
        ctx.fillStyle = isEven ? lightColor : darkColor;
        ctx.fillRect(x, y, squareSize, squareSize);
      }
    }
  }

  // Mouse/touch events
  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.offsetX;
    startY = e.offsetY;
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const dx = e.offsetX - startX;
      const dy = e.offsetY - startY;
      offsetX += dx;
      offsetY += dy;
      startX = e.offsetX;
      startY = e.offsetY;
      drawImage();
    }
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;
    canvas.style.cursor = "grab";
  });

  canvas.addEventListener("mouseleave", () => {
    isDragging = false;
    canvas.style.cursor = "grab";
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale *= delta;
    drawImage();
  });

  // Control buttons
  zoomInBtn.addEventListener("click", () => {
    scale *= 1.2;
    drawImage();
  });

  zoomOutBtn.addEventListener("click", () => {
    scale *= 0.8;
    drawImage();
  });

  resetBtn.addEventListener("click", () => {
    if (currentImage) {
      rotation = 0;
      brightness = 0;
      contrast = 0;
      saturation = 0;
      const scaleX = canvas.width / currentImage.width;
      const scaleY = canvas.height / currentImage.height;
      scale = Math.max(scaleX, scaleY);
      offsetX = (canvas.width - currentImage.width * scale) / 2;
      offsetY = (canvas.height - currentImage.height * scale) / 2;
      drawImage();
    }
  });

  if (rotateBtn) {
    rotateBtn.addEventListener("click", () => {
      rotation = (rotation + 90) % 360;
      drawImage();
    });
  }

  if (effectsBtn) {
    effectsBtn.addEventListener("click", () => {
      showEffectsPanel();
    });
  }

  // Effects panel
  function showEffectsPanel() {
    const existingPanel = modal.querySelector('.effects-panel');
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'effects-panel';
    panel.innerHTML = `
      <h4 style="margin: 0 0 1rem; font-size: 1rem;">Adjust Effects</h4>
      <div class="effect-control">
        <label>Brightness</label>
        <input type="range" min="-50" max="50" value="${brightness}" id="brightness-slider" />
        <span id="brightness-value">${brightness}</span>
      </div>
      <div class="effect-control">
        <label>Contrast</label>
        <input type="range" min="-50" max="50" value="${contrast}" id="contrast-slider" />
        <span id="contrast-value">${contrast}</span>
      </div>
      <div class="effect-control">
        <label>Saturation</label>
        <input type="range" min="-100" max="100" value="${saturation}" id="saturation-slider" />
        <span id="saturation-value">${saturation}</span>
      </div>
    `;

    cropContainer.appendChild(panel);

    const brightnessSlider = panel.querySelector('#brightness-slider');
    const contrastSlider = panel.querySelector('#contrast-slider');
    const saturationSlider = panel.querySelector('#saturation-slider');
    const brightnessValue = panel.querySelector('#brightness-value');
    const contrastValue = panel.querySelector('#contrast-value');
    const saturationValue = panel.querySelector('#saturation-value');

    brightnessSlider.addEventListener('input', (e) => {
      brightness = parseInt(e.target.value);
      brightnessValue.textContent = brightness;
      drawImage();
    });

    contrastSlider.addEventListener('input', (e) => {
      contrast = parseInt(e.target.value);
      contrastValue.textContent = contrast;
      drawImage();
    });

    saturationSlider.addEventListener('input', (e) => {
      saturation = parseInt(e.target.value);
      saturationValue.textContent = saturation;
      drawImage();
    });
  }

  // Save button
  saveBtn.addEventListener("click", () => {
    if (!currentImage) return;

    const finalCanvas = document.createElement("canvas");
    const finalSize = 800;
    const cropMargin = 10;
    
    let finalWidth, finalHeight, cropWidth, cropHeight;
    
    if (cropShape === 'circle') {
      finalWidth = finalHeight = finalSize;
      cropWidth = cropHeight = canvas.width - (cropMargin * 2);
    } else {
      if (aspectRatio >= 1) {
        finalWidth = finalSize;
        finalHeight = finalSize / aspectRatio;
      } else {
        finalHeight = finalSize;
        finalWidth = finalSize * aspectRatio;
      }
      cropWidth = canvas.width - (cropMargin * 2);
      cropHeight = canvas.height - (cropMargin * 2);
    }
    
    finalCanvas.width = finalWidth;
    finalCanvas.height = finalHeight;
    const finalCtx = finalCanvas.getContext("2d");

    finalCtx.fillStyle = "#ffffff";
    finalCtx.fillRect(0, 0, finalWidth, finalHeight);

    const sourceWidth = cropWidth / scale;
    const sourceHeight = cropHeight / scale;
    const sourceX = (canvas.width / 2 - offsetX) / scale - sourceWidth / 2;
    const sourceY = (canvas.height / 2 - offsetY) / scale - sourceHeight / 2;

    if (cropShape === 'circle') {
      finalCtx.beginPath();
      finalCtx.arc(finalWidth / 2, finalHeight / 2, finalWidth / 2, 0, Math.PI * 2);
      finalCtx.closePath();
      finalCtx.clip();
    }

    finalCtx.filter = `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100})`;

    if (rotation !== 0) {
      finalCtx.translate(finalWidth / 2, finalHeight / 2);
      finalCtx.rotate((rotation * Math.PI) / 180);
      finalCtx.translate(-finalWidth / 2, -finalHeight / 2);
    }

    finalCtx.drawImage(
      currentImage,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, finalWidth, finalHeight
    );

    finalCanvas.toBlob(async (blob) => {
      try {
        const optimized = await optimizeImage(blob, { quality: 0.92 });
        closeModal();
        document.removeEventListener('paste', pasteHandler);
        onSave(optimized);
      } catch (err) {
        console.error('Optimization failed:', err);
        closeModal();
        document.removeEventListener('paste', pasteHandler);
        onSave(blob);
      }
    }, "image/jpeg", 0.92);
  });

  // Close handlers
  closeBtn.addEventListener("click", () => {
    document.removeEventListener('paste', pasteHandler);
    closeModal();
  });
  
  cancelBtn.addEventListener("click", () => {
    document.removeEventListener('paste', pasteHandler);
    closeModal();
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      document.removeEventListener('paste', pasteHandler);
      closeModal();
    }
  });

  document.addEventListener("keydown", function escapeHandler(e) {
    if (e.key === "Escape") {
      document.removeEventListener('paste', pasteHandler);
      closeModal();
      document.removeEventListener("keydown", escapeHandler);
    }
  });
}

/**
 * Add required CSS styles for photo modal
 */
function addPhotoModalStyles() {
  if (document.getElementById("photo-modal-styles")) return;

  const style = document.createElement("style");
  style.id = "photo-modal-styles";
  style.textContent = `
    .photo-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .photo-modal {
      background: white;
      border-radius: 16px;
      max-width: 650px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .photo-modal-header {
      padding: 1.5rem 2rem;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }

    .photo-modal-header h3 {
      margin: 0;
      font-size: 1.5rem;
      color: #1e293b;
      font-weight: 700;
    }

    .photo-modal-close {
      background: none;
      border: none;
      font-size: 2rem;
      color: #64748b;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .photo-modal-close:hover {
      background: #f1f5f9;
      color: #1e293b;
      transform: rotate(90deg);
    }

    .photo-modal-body {
      padding: 2rem;
    }

    .photo-upload-area {
      border: 3px dashed #cbd5e1;
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      min-height: 250px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }

    .photo-upload-area:hover {
      border-color: #3b82f6;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      transform: translateY(-2px);
    }

    .photo-upload-placeholder {
      color: #64748b;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .photo-upload-placeholder svg {
      color: #94a3b8;
      margin-bottom: 1rem;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }

    .photo-upload-placeholder p {
      margin: 0.5rem 0;
    }

    .photo-upload-hint {
      font-size: 0.875rem;
      color: #94a3b8;
    }

    .photo-crop-container {
      text-align: center;
    }

    .crop-canvas-wrapper {
      display: inline-block;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      margin-bottom: 1.5rem;
    }

    #photo-crop-canvas {
      max-width: 100%;
      cursor: grab;
      display: block;
    }

    #photo-crop-canvas:active {
      cursor: grabbing;
    }

    .photo-crop-controls {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .crop-hint {
      font-size: 0.875rem;
      color: #64748b;
      margin: 0;
      padding: 0.75rem;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .photo-modal-footer {
      padding: 1.5rem 2rem;
      border-top: 2px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }

    .effects-panel {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 2px solid #bae6fd;
      border-radius: 12px;
      padding: 1.5rem;
      margin-top: 1.5rem;
      animation: slideDown 0.3s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .effect-control {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .effect-control:last-child {
      margin-bottom: 0;
    }

    .effect-control label {
      min-width: 100px;
      font-weight: 600;
      color: #0c4a6e;
      font-size: 0.875rem;
    }

    .effect-control input[type="range"] {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: #e0f2fe;
      outline: none;
      -webkit-appearance: none;
    }

    .effect-control input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #0284c7;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .effect-control input[type="range"]::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #0284c7;
      cursor: pointer;
      border: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .effect-control span {
      min-width: 40px;
      text-align: right;
      font-weight: 600;
      color: #0c4a6e;
      font-size: 0.875rem;
    }

    @media (max-width: 768px) {
      .photo-modal {
        max-width: 100%;
        margin: 0;
        border-radius: 0;
        max-height: 100vh;
      }

      .photo-modal-header,
      .photo-modal-body,
      .photo-modal-footer {
        padding: 1rem;
      }

      .photo-crop-controls {
        flex-direction: column;
      }

      .photo-crop-controls button {
        width: 100%;
      }

      .photo-modal-footer {
        flex-direction: column;
      }

      .photo-modal-footer button {
        width: 100%;
      }

      .effect-control {
        flex-direction: column;
        align-items: stretch;
      }

      .effect-control label {
        min-width: auto;
      }
    }
  `;
  document.head.appendChild(style);
}
