// js/photo-utils.js
// Reusable photo upload, crop, and storage utilities

import { storage, ref, uploadBytes, getDownloadURL } from "./firebase.js";

/**
 * Create and show a photo upload modal with cropping functionality
 * @param {Object} options - Configuration options
 * @param {string} options.currentPhotoURL - Current photo URL (optional)
 * @param {string} options.aspectRatio - Aspect ratio for cropping (default: 1 for square)
 * @param {Function} options.onSave - Callback function when photo is saved (receives blob)
 * @param {Function} options.onCancel - Callback function when cancelled (optional)
 */
export function openPhotoUploadModal(options = {}) {
  const {
    currentPhotoURL = null,
    aspectRatio = 1,
    onSave = () => {},
    onCancel = () => {}
  } = options;

  // Create modal overlay
  const modal = document.createElement("div");
  modal.className = "photo-modal-overlay";
  modal.innerHTML = `
    <div class="photo-modal">
      <div class="photo-modal-header">
        <h3>Upload Profile Photo</h3>
        <button class="photo-modal-close" aria-label="Close">&times;</button>
      </div>
      
      <div class="photo-modal-body">
        <div class="photo-upload-area" id="photo-upload-area">
          ${currentPhotoURL ? `
            <img src="${currentPhotoURL}" alt="Current photo" id="photo-preview" />
          ` : `
            <div class="photo-upload-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <p>Click to upload or drag & drop</p>
              <p class="photo-upload-hint">JPG, PNG or GIF (Max 5MB)</p>
            </div>
          `}
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
        <button type="button" class="btn" id="photo-save-btn" style="display: none;">Save Photo</button>
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
    if (e.target.id !== "photo-preview") {
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

    // Set canvas size (square)
    const maxSize = 400;
    canvas.width = maxSize;
    canvas.height = maxSize;

    // Reset transformation
    scale = Math.min(maxSize / currentImage.width, maxSize / currentImage.height);
    offsetX = (maxSize - currentImage.width * scale) / 2;
    offsetY = (maxSize - currentImage.height * scale) / 2;

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

    // Draw crop circle overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 10, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 10, 0, Math.PI * 2);
    ctx.stroke();
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
      scale = Math.min(canvas.width / currentImage.width, canvas.height / currentImage.height);
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
    const finalSize = 500; // Output size
    finalCanvas.width = finalSize;
    finalCanvas.height = finalSize;
    const finalCtx = finalCanvas.getContext("2d");

    // Draw cropped image
    const cropSize = canvas.width - 20; // Circle radius * 2
    const sourceSize = cropSize / scale;
    const sourceX = (canvas.width / 2 - offsetX) / scale - sourceSize / 2;
    const sourceY = (canvas.height / 2 - offsetY) / scale - sourceSize / 2;

    finalCtx.beginPath();
    finalCtx.arc(finalSize / 2, finalSize / 2, finalSize / 2, 0, Math.PI * 2);
    finalCtx.closePath();
    finalCtx.clip();

    finalCtx.drawImage(
      currentImage,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, finalSize, finalSize
    );

    // Convert to blob and callback
    finalCanvas.toBlob((blob) => {
      closeModal();
      onSave(blob);
    }, "image/jpeg", 0.9);
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
 * @param {string} userId - User ID for storage path
 * @returns {Promise<string>} Download URL of uploaded photo
 */
export async function uploadPhotoToStorage(blob, userId) {
  try {
    const filename = `profile_photos/${userId}_${Date.now()}.jpg`;
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
      max-width: 500px;
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
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .photo-upload-area:hover {
      border-color: #3b82f6;
      background: #f8fafc;
    }

    .photo-upload-placeholder {
      color: #64748b;
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

    .photo-upload-area img {
      max-width: 100%;
      max-height: 200px;
      border-radius: 50%;
      object-fit: cover;
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
