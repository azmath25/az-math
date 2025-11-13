// js/profile.js - Enhanced with better photo upload UX and progress indicators
import { onAuthState } from "./auth.js";
import { db, doc, updateDoc } from "./firebase.js";
import { openPhotoUploadModal, uploadPhotoToStorage, archiveOldPhoto } from "./photo-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  const userEmail = document.getElementById("user-email");
  const userRole = document.getElementById("user-role");
  const userPhoto = document.getElementById("user-photo");
  const adminSection = document.getElementById("admin-section");
  const guestSection = document.getElementById("guest-section");
  const pendingMessage = document.getElementById("pending-message");
  const profileCard = document.querySelector(".profile-card");
  
  let currentUser = null;

  onAuthState((user) => {
    if (!user) {
      // Not logged in - show guest section
      profileCard.style.display = "none";
      adminSection.style.display = "none";
      guestSection.style.display = "block";
      return;
    }

    // Store current user
    currentUser = user;

    // Logged in - show profile
    profileCard.style.display = "flex";
    guestSection.style.display = "none";

    userEmail.textContent = user.email || "Unknown";
    
    // Display role with badge styling
    const roleText = user.role || "pending";
    userRole.textContent = roleText.charAt(0).toUpperCase() + roleText.slice(1);
    
    // Add role badge styling
    if (user.role === "admin") {
      userRole.className = "role-badge role-admin";
      adminSection.style.display = "block";
    } else if (user.role === "user") {
      userRole.className = "role-badge role-user";
    } else {
      userRole.className = "role-badge role-pending";
      pendingMessage.style.display = "block";
    }

    // Load user photo if available
    if (user.photoURL) {
      userPhoto.src = user.photoURL;
    }

    // Make photo clickable for upload
    setupPhotoUpload();
  });

  /**
   * Enhanced photo upload with progress indicator and better UX
   */
  function setupPhotoUpload() {
    if (!userPhoto) return;

    // Add click handler to photo
    userPhoto.style.cursor = "pointer";
    userPhoto.title = "Click to change profile photo";

    userPhoto.addEventListener("click", async () => {
      if (!currentUser) {
        alert("You must be logged in to change your photo");
        return;
      }

      openPhotoUploadModal({
        currentPhotoURL: currentUser.photoURL || null,
        aspectRatio: 1, // Square for profile photos
        cropShape: 'circle', // Circular crop for profile
        showEffects: true, // Enable brightness/contrast/saturation adjustments
        onSave: async (blob) => {
          try {
            // Show loading state on photo
            const originalSrc = userPhoto.src;
            showPhotoUploadProgress(0);

            // Step 1: Archive old photo if exists (10%)
            if (currentUser.photoURL) {
              showPhotoUploadProgress(10, 'Archiving old photo...');
              await archiveOldPhoto(currentUser.photoURL, currentUser.uid);
            }

            // Step 2: Upload new photo (70%)
            showPhotoUploadProgress(40, 'Uploading new photo...');
            
            // IMPORTANT: Path should be just the folder, not include filename
            // uploadPhotoToStorage will add the filename
            const photoURL = await uploadPhotoToStorage(
              blob, 
              `profile_photos/${currentUser.uid}`, // Just the folder path
              {
                currentPhotoURL: currentUser.photoURL,
                userId: currentUser.uid
              }
            );

            showPhotoUploadProgress(70, 'Updating profile...');

            // Step 3: Update Firestore user document (20%)
            const userDocRef = doc(db, "Users", currentUser.uid);
            await updateDoc(userDocRef, {
              photoURL: photoURL
            });

            showPhotoUploadProgress(90, 'Finalizing...');

            // Step 4: Update the image on the page
            userPhoto.src = photoURL;

            // Also update the navbar profile icon if it exists
            const navbarPhoto = document.getElementById("profile-photo");
            if (navbarPhoto) {
              navbarPhoto.src = photoURL;
            }

            showPhotoUploadProgress(100, 'Complete!');

            // Show success message
            setTimeout(() => {
              hidePhotoUploadProgress();
              showSuccessMessage("✅ Profile photo updated successfully!");
            }, 500);

          } catch (err) {
            console.error("Error updating photo:", err);
            hidePhotoUploadProgress();
            showErrorMessage("❌ Failed to update photo: " + err.message);
            
            // Restore original photo on error
            userPhoto.src = originalSrc;
          }
        },
        onCancel: () => {
          console.log('Photo upload cancelled');
        }
      });
    });

    // Add hover effect styling
    addPhotoHoverStyles();
  }

  /**
   * Show photo upload progress indicator
   */
  function showPhotoUploadProgress(percent, message = 'Uploading...') {
    let progressOverlay = document.getElementById('photo-progress-overlay');
    
    if (!progressOverlay) {
      progressOverlay = document.createElement('div');
      progressOverlay.id = 'photo-progress-overlay';
      progressOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
      `;
      
      progressOverlay.innerHTML = `
        <div style="
          background: white;
          padding: 2rem;
          border-radius: 16px;
          text-align: center;
          min-width: 300px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📸</div>
          <div id="progress-message" style="font-weight: 600; color: #1f2937; margin-bottom: 1rem;">Uploading...</div>
          <div style="
            width: 100%;
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 0.5rem;
          ">
            <div id="progress-bar" style="
              height: 100%;
              background: linear-gradient(90deg, #3b82f6, #8b5cf6);
              width: 0%;
              transition: width 0.3s ease;
            "></div>
          </div>
          <div id="progress-percent" style="font-size: 0.875rem; color: #6b7280;">0%</div>
        </div>
      `;
      
      document.body.appendChild(progressOverlay);
    }

    const progressBar = document.getElementById('progress-bar');
    const progressPercent = document.getElementById('progress-percent');
    const progressMessage = document.getElementById('progress-message');

    if (progressBar) progressBar.style.width = percent + '%';
    if (progressPercent) progressPercent.textContent = Math.round(percent) + '%';
    if (progressMessage) progressMessage.textContent = message;
  }

  /**
   * Hide photo upload progress
   */
  function hidePhotoUploadProgress() {
    const progressOverlay = document.getElementById('photo-progress-overlay');
    if (progressOverlay) {
      progressOverlay.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => progressOverlay.remove(), 300);
    }
  }

  /**
   * Show success message
   */
  function showSuccessMessage(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      z-index: 10001;
      font-weight: 600;
      animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Show error message
   */
  function showErrorMessage(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      z-index: 10001;
      font-weight: 600;
      animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  /**
   * Add hover styles for photo
   */
  function addPhotoHoverStyles() {
    if (document.getElementById("profile-photo-hover-styles")) return;

    const style = document.createElement("style");
    style.id = "profile-photo-hover-styles";
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
      
      .profile-photo-large {
        position: relative;
        transition: all 0.3s ease;
      }
      
      .profile-photo-large:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }
      
      .profile-photo-large::after {
        content: '📷';
        position: absolute;
        bottom: 0;
        right: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .profile-photo-large:hover::after {
        opacity: 1;
      }
    `;
    
    document.head.appendChild(style);
  }
});
