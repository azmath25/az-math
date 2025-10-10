// Key fixes for edit-problem.js

// 1. Fix the insertBtn click handler in showMathModal function
// Replace the existing insertBtn.addEventListener("click", ...) with:

insertBtn.addEventListener("click", () => {
  const latex = latexInput.value.trim();
  if (!latex) {
    alert("Please enter LaTeX code");
    return;
  }
  
  const mode = modal.querySelector('input[name="math-mode"]:checked').value;
  const mathText = mode === 'inline' ? `$${latex}$` : `$$${latex}$$`;
  
  // Focus the editor first
  editor.focus();
  
  // Get current selection/range
  const selection = window.getSelection();
  let range;
  
  // Check if we have a valid selection within the editor
  if (selection.rangeCount > 0) {
    range = selection.getRangeAt(0);
    
    // Verify the range is within our editor
    let node = range.commonAncestorContainer;
    let isInEditor = false;
    
    while (node) {
      if (node === editor) {
        isInEditor = true;
        break;
      }
      node = node.parentNode;
    }
    
    if (!isInEditor) {
      // Selection is outside editor, create new range at end
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } else {
    // No selection, create range at end of editor
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  
  // Delete any selected content
  range.deleteContents();
  
  // Create the math span
  const mathSpan = document.createElement('span');
  mathSpan.className = 'math-formula';
  mathSpan.textContent = mathText;
  mathSpan.setAttribute('contenteditable', 'false'); // Make math non-editable
  
  // Insert the math span
  range.insertNode(mathSpan);
  
  // Add a space after the math
  const space = document.createTextNode('\u00A0');
  range.setStartAfter(mathSpan);
  range.collapse(true);
  range.insertNode(space);
  
  // Move cursor after the space
  range.setStartAfter(space);
  range.collapse(true);
  
  // Update selection
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Close modal and refocus editor
  closeModal();
  editor.focus();
});


// 2. Add CSS style for math-formula class (add to your CSS file)
/*
.math-formula {
  background-color: #f0f0f0;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Times New Roman', serif;
  margin: 0 2px;
  display: inline-block;
  user-select: none;
}
*/
