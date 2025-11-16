```
latexify/
├── uploader.html           # Main upload interface
├── test-display.html       # View uploaded problems
├── css/
│   └── latexify.css       # Minimal styles
└── js/
    ├── latex-parser.js    # Parse LaTeX → JSON
    └── latex-uploader.js  # Upload & save to Firebase
```

---

## 🚀 How to Use

### **Method 1: Paste LaTeX Code (Easiest)**

1. Open `latexify/uploader.html`
2. Click **"📋 Paste"** tab
3. Paste this test LaTeX:

```latex
% metadata: difficulty=Medium, category=Algebra, tags=equations,quadratic

\section{Problem}
Solve for $x$:
$$x^2 - 5x + 6 = 0$$

\section{Solution}
\subsection{Method 1: Factoring}
We factor the equation:
$$(x-2)(x-3) = 0$$

Therefore, $x = 2$ or $x = 3$.

\subsection{Method 2: Quadratic Formula}
Using $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$:
$$x = \frac{5 \pm \sqrt{25-24}}{2} = \frac{5 \pm 1}{2}$$

So $x = 3$ or $x = 2$.
```

4. Click **"Parse & Preview"**
5. Review the preview
6. Click **"💾 Save to Database"**
7. Done! Problem saved.

---

### **Method 2: Upload Overleaf ZIP**

1. In Overleaf, create a project with this structure:
```
project/
├── main.tex
└── figures/
    └── diagram.png
```

2. `main.tex` content:
```latex
\documentclass{article}
\usepackage{amsmath}
\usepackage{graphicx}

% metadata: difficulty=Hard, category=Geometry, tags=triangles,proofs

\begin{document}

\section{Problem}
Prove that in a right triangle...

\begin{center}
\includegraphics{figures/diagram.png}
\end{center}

\section{Solution}
Using the Pythagorean theorem...

\end{document}
```

3. Download ZIP from Overleaf
4. Open `latexify/uploader.html`
5. Click **"📦 ZIP"** tab
6. Drop ZIP file
7. Click **"💾 Save to Database"**

---

## 🧪 Testing

### View Your Uploaded Problems:

1. Open `latexify/test-display.html`
2. See all problems with:
   - Problem ID
   - Title & metadata
   - LaTeX/Rich-text indicator
   - Preview text
   - Tags
3. Click any problem → Opens in `../problem.html`

### Filters:
- **All Problems** / **LaTeX Only** / **Rich Text Only**
- **Category filter**

---

## 📊 What Gets Stored in Firebase

```javascript
problems/{id}
{
  id: 42,
  title: "Solve for x",
  category: "Algebra",
  difficulty: "Medium",
  tags: ["equations", "quadratic"],
  
  // Az-Math format (backward compatible)
  statement: [
    { type: "text", content: "<p>Solve for $x$...</p>" },
    { type: "image", url: "...", alignment: "center" }
  ],
  solutions: [
    {
      title: "Method 1: Factoring",
      blocks: [
        { type: "text", content: "..." }
      ]
    }
  ],
  
  // NEW: LaTeX source
  contentType: "latex",
  latex: {
    source: "\\section{Problem}...",  // Full LaTeX
    statement: "Solve for $x$: ...", // Extracted
    solutions: ["We factor..."]       // Extracted
  },
  
  images: {
    "diagram.png": "https://storage.googleapis.com/..."
  },
  
  draft: false,
  timestamp: ...
}
```

---

## 🎯 Metadata Options

### **Method 1: Comment-based**
```latex
% metadata: difficulty=Hard, category=Geometry, tags=triangles,angles
```

### **Method 2: JSON**
```latex
% metadata: {"difficulty": "Hard", "category": "Geometry", "tags": "triangles,angles"}
```

### **Method 3: LaTeX Commands**
```latex
\title{Triangle Inequality}
\difficulty{Hard}
\category{Geometry}
```

If no metadata provided, defaults to:
- Difficulty: Medium
- Category: Auto-detected or "General"
- Tags: Empty

---

## 🔍 How It Works

### **Parse Flow:**
```
LaTeX Input
    ↓
[Parser]
    ↓ Extracts:
    - Metadata (from comments/commands)
    - Sections (\section{Problem}, \section{Solution})
    - Subsections (\subsection for multiple methods)
    - Images (\includegraphics)
    ↓
Convert to Az-Math format
    ↓
Upload images to Storage
    ↓
Save to Firestore
```

### **Section Detection:**
- **Problem:** `\section{Problem}`, `\section{Statement}`, `\section{Question}`
- **Solution:** `\section{Solution}`, `\section{Answer}`, `\section{Proof}`
- **Multiple methods:** `\subsection{Method 1}`, `\subsection{Alternative}`

---

## 📱 Mobile Support

The uploader is fully responsive:
- Touch-friendly dropzone
- Mobile-optimized forms
- Responsive preview

Problems render mobile-optimized on `problem.html`:
- Math equations scale to screen
- Images resize automatically
- Touch-optimized buttons

---

## ⚠️ Limitations (Current Version)

1. **Images in ZIP only** - Paste mode doesn't support images yet
2. **Basic LaTeX** - Advanced packages (TikZ, PGFPlots) not fully supported
3. **Math only** - Uses MathJax (not full LaTeX compiler)
4. **Manual ID** - Auto-ID works but you can override

---

## 🐛 Troubleshooting

### "No .tex file found"
- ZIP must contain at least one `.tex` file
- Filename should be `main.tex` or `problem.tex`

### "Error parsing LaTeX"
- Check syntax (missing `\end{document}`)
- Use standard LaTeX commands
- Avoid custom packages

### "Images not showing"
- Ensure images are in ZIP
- Use `\includegraphics{filename.png}` (no path)
- Supported: .png, .jpg, .pdf, .svg

### "Math not rendering"
- Wait for MathJax to load (blue spinner)
- Use `$...$` for inline, `$$...$$` for display
- Or `\[...\]` for display math

---

## 🎓 Example Problems

### **Simple (Text Only)**
```latex
% metadata: difficulty=Easy, category=Algebra

\section{Problem}
Solve: $2x + 5 = 13$

\section{Solution}
$2x = 8$, therefore $x = 4$.
```

### **Multiple Solutions**
```latex
% metadata: difficulty=Medium, category=Algebra

\section{Problem Statement}
Factor: $x^2 - 9$

\section{Solution}
\subsection{Difference of Squares}
$(x+3)(x-3)$

\subsection{By Inspection}
We look for factors of $-9$ that sum to $0$...
```

### **With Image**
```latex
% metadata: difficulty=Hard, category=Geometry

\section{Problem}
In triangle ABC:
\begin{center}
\includegraphics{triangle.png}
\end{center}
Find angle $\theta$.

\section{Solution}
By the law of cosines...
```

---

## 🚀 Next Steps

1. **Try it!** Upload your first problem
2. **Test display** View it on test-display.html
3. **Check mobile** Open on phone
4. **Iterate** Upload more complex problems

---

## 💡 Pro Tips

1. **Write in Overleaf first** - Better editor, live preview
2. **Use templates** - Create reusable problem structures
3. **Test locally** - Preview before saving
4. **Organize images** - Use descriptive filenames
5. **Add metadata** - Makes filtering easier

---

## ✅ Success Checklist

- [ ] Created `latexify/` folder
- [ ] Uploaded 4 files (uploader, display, CSS, 2 JS)
- [ ] Opened `uploader.html` in browser
- [ ] Pasted test LaTeX
- [ ] Clicked "Parse & Preview"
- [ ] Clicked "Save to Database"
- [ ] Opened `test-display.html`
- [ ] Saw your problem listed
- [ ] Clicked to view in `../problem.html`
- [ ] Problem renders correctly with math

---

**Ready to test? Open `uploader.html` and try it!** 🎉
