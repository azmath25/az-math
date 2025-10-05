// js/main.js
import { onAuthState } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Sidebar toggle
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });

    // Close sidebar when clicking outside
    document.addEventListener("click", (e) => {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove("open");
      }
    });
  }

  // Profile photo handling
  const profilePhoto = document.getElementById("profile-photo");
  if (profilePhoto) {
    // Determine base path
    const isAdminPage = window.location.pathname.includes("/admin/");
    const basePath = isAdminPage ? "../" : "";

    // Set default photo initially
    profilePhoto.src = `${basePath}assets/img/defaultprofile.png`;
    profilePhoto.style.cursor = "pointer";

    // Listen to auth state ONCE and handle everything in one callback
    onAuthState((user) => {
      // Update photo
      if (user && user.photoURL) {
        profilePhoto.src = user.photoURL;
      } else {
        profilePhoto.src = `${basePath}assets/img/defaultprofile.png`;
      }

      // Set up click handler (overwrite any previous)
      profilePhoto.onclick = () => {
        if (user) {
          window.location.href = `${basePath}profile.html`;
        } else {
          window.location.href = `${basePath}login.html`;
        }
      };
    });
  }
});
