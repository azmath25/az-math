// js/photo-utils.js
// Reusable photo upload, crop, and storage utilities

import { storage, ref, uploadBytes, getDownloadURL } from "./firebase.js";

/**
 * Create and show a photo upload modal with cropping functionality
 * @param {Object} options - Configuration options
 * @param {string} options.currentPhotoURL - Current photo URL (optional)
 * @param {number} options.aspectRatio - Aspect ratio for cropping (default: 1 for square)
 * @param {string} options.cropShape - 'circle' or 'rectangle' (default: 'circle')
 * @param {Function} options.onSave - Callback function when photo is saved (receives blob)
 * @param {Function} options.onCancel - Callback function when cancelled (optional)
 */
export function openPhotoUploadModal(options = {}) {
  const {
    currentPhotoURL = null,
    aspectRatio = 1,
    cropShape = 'circle',
    onSave = () => {},
    onCancel = () => {}
  } = options;

  // Create modal overlay
  const modal = document.createElement("div");
  modal.className = "photo-modal-overlay";
  modal.innerHTML = `
    <div class="photo-modal">
      <div class="photo-modal-header">
        <h3>Upload Image</h3>
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
          </div>
          ${currentPhotoURL ? `
            <img src="${currentPhotoURL}" alt="Current photo" id="photo-preview" style="max-width: 200px; max-height: 200px; ${cropShape === 'circle' ? 'border-radius: 50%;' : 'border-radius: 10px;'} object-fit: cover; margin-top: 1rem;" />
          ` : ''}
          <input type="file" id="photo-file-input" accept="image/*" style="display: none;" />
        </div>
        
        <div class="photo-crop-container" id="photo-crop-container" style="display: none;">
          <canvas id="photo-crop-canvas"></canvas>
          <div class="photo-crop-controls">
            <button type="button" class="btn btn-small" id="zoom-in-btn">🔍+ Zoom In</button>
            <button type="button" class="btn btn-small" id="zoom-out-btn">🔍- Zoom Out</button>
            <button type="button" class="btn btn-small btn-secondary" id="reset-crop-btn">🔄 Reset</button>
          </div>
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

  let currentImage = null;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  // Close modal function
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
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.style.borderColor = "#e2e8f0";
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "#e2e8f0";
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });

  // File input change
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  // Handle file selection
  function handleFileSelect(file) {
    // Validate file
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    // Load image
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        currentImage = img;
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

    // Set canvas size based on aspect ratio and shape
    const maxSize = 500;
    let canvasWidth, canvasHeight;
    
    if (cropShape === 'circle') {
      canvasWidth = canvasHeight = maxSize;
    } else {
      // Rectangle with aspect ratio
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

    // Reset transformation
    const scaleX = canvasWidth / currentImage.width;
    const scaleY = canvasHeight / currentImage.height;
    scale = Math.max(scaleX, scaleY); // Cover the canvas
    
    offsetX = (canvasWidth - currentImage.width * scale) / 2;
    offsetY = (canvasHeight - currentImage.height * scale) / 2;

    drawImage();
  }

  // Draw image on canvas
  function drawImage() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(currentImage, 0, 0);
    ctx.restore();

    // Draw crop overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const cropMargin = 10;
    
    if (cropShape === 'circle') {
      // Circle crop
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, (canvas.width / 2) - cropMargin, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, (canvas.width / 2) - cropMargin, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Rectangle crop
      const cropWidth = canvas.width - (cropMargin * 2);
      const cropHeight = canvas.height - (cropMargin * 2);
      
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(cropMargin, cropMargin, cropWidth, cropHeight);
      
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.strokeRect(cropMargin, cropMargin, cropWidth, cropHeight);
    }
  }

  // Canvas mouse events for panning
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

  // Touch events for mobile
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    isDragging = true;
    startX = touch.clientX - rect.left;
    startY = touch.clientY - rect.top;
  });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (isDragging) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;
      const dx = currentX - startX;
      const dy = currentY - startY;
      offsetX += dx;
      offsetY += dy;
      startX = currentX;
      startY = currentY;
      drawImage();
    }
  });

  canvas.addEventListener("touchend", () => {
    isDragging = false;
  });

  // Zoom controls
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
      const scaleX = canvas.width / currentImage.width;
      const scaleY = canvas.height / currentImage.height;
      scale = Math.max(scaleX, scaleY);
      offsetX = (canvas.width - currentImage.width * scale) / 2;
      offsetY = (canvas.height - currentImage.height * scale) / 2;
      drawImage();
    }
  });

  // Save button
  saveBtn.addEventListener("click", () => {
    if (!currentImage) return;

    // Create final cropped canvas
    const finalCanvas = document.createElement("canvas");
    const finalSize = 800; // Output size
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

    // Calculate source dimensions
    const sourceWidth = cropWidth / scale;
    const sourceHeight = cropHeight / scale;
    const sourceX = (canvas.width / 2 - offsetX) / scale - sourceWidth / 2;
    const sourceY = (canvas.height / 2 - offsetY) / scale - sourceHeight / 2;

    if (cropShape === 'circle') {
      // Circular clip
      finalCtx.beginPath();
      finalCtx.arc(finalWidth / 2, finalHeight / 2, finalWidth / 2, 0, Math.PI * 2);
      finalCtx.closePath();
      finalCtx.clip();
    }

    finalCtx.drawImage(
      currentImage,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, finalWidth, finalHeight
    );

    // Convert to blob and callback
    finalCanvas.toBlob((blob) => {
      closeModal();
      onSave(blob);
    }, "image/jpeg", 0.92);
  });

  // Close buttons
  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

/**
 * Upload photo blob to Firebase Storage
 * @param {Blob} blob - Image blob to upload
 * @param {string} path - Storage path (e.g., 'profile_photos/user123' or 'problem_images/img456')
 * @returns {Promise<string>} Download URL of uploaded photo
 */
export async function uploadPhotoToStorage(blob, path) {
  try {
    const filename = `${path}_${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);
    
    await uploadBytes(storageRef, blob, {
      contentType: "image/jpeg"
    });
    
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (err) {
    console.error("Error uploading photo:", err);
    throw new Error("Failed to upload photo: " + err.message);
  }
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
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
    }

    .photo-modal {
      background: white;
      border-radius: 16px;
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .photo-modal-header {
      padding: 1.5rem;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .photo-modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      color: #1e293b;
    }

    .photo-modal-close {
      background: none;
      border: none;
      font-size: 2rem;
      color: #64748b;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .photo-modal-close:hover {
      background: #f1f5f9;
      color: #1e293b;
    }

    .photo-modal-body {
      padding: 1.5rem;
    }

    .photo-upload-area {
      border: 3px dashed #e2e8f0;
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
    }

    .photo-upload-area:hover {
      border-color: #3b82f6;
      background: #f8fafc;
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

    #photo-crop-canvas {
      max-width: 100%;
      border-radius: 12px;
      cursor: grab;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .photo-crop-controls {
      margin-top: 1rem;
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .photo-modal-footer {
      padding: 1.5rem;
      border-top: 2px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    @media (max-width: 640px) {
      .photo-modal {
        margin: 0;
        border-radius: 0;
        max-height: 100vh;
      }
    }
  `;
  document.head.appendChild(style);
}
