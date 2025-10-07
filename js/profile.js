// js/profile.js
import { onAuthState } from "./auth.js";
import { db, doc, updateDoc } from "./firebase.js";
import { openPhotoUploadModal, uploadPhotoToStorage } from "./photo-utils.js";

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
        onSave: async (blob) => {
          try {
            // Show uploading state
            const originalSrc = userPhoto.src;
            userPhoto.style.opacity = "0.5";
            userPhoto.style.pointerEvents = "none";

            // Upload to Firebase Storage
            const photoURL = await uploadPhotoToStorage(blob, `profile_photos/${currentUser.uid}`);

            // Update Firestore user document
            const userDocRef = doc(db, "Users", currentUser.uid);
            await updateDoc(userDocRef, {
              photoURL: photoURL
            });

            // Update the image on the page
            userPhoto.src = photoURL;
            userPhoto.style.opacity = "1";
            userPhoto.style.pointerEvents = "auto";

            // Also update the navbar profile icon if it exists
            const navbarPhoto = document.getElementById("profile-photo");
            if (navbarPhoto) {
              navbarPhoto.src = photoURL;
            }

            alert("Profile photo updated successfully!");

          } catch (err) {
            console.error("Error updating photo:", err);
            alert("Failed to update photo: " + err.message);
            
            // Reset on error
            userPhoto.style.opacity = "1";
            userPhoto.style.pointerEvents = "auto";
          }
        },
        onCancel: () => {
          // User cancelled, do nothing
        }
      });
    });

    // Add hover effect styling
    const style = document.createElement("style");
    style.textContent = `
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
    
    if (!document.getElementById("profile-photo-hover-styles")) {
      style.id = "profile-photo-hover-styles";
      document.head.appendChild(style);
    }
  }
});
