// latex-parser.js - Parse LaTeX to Az-Math format

export class LaTeXParser {
  constructor() {
    this.metadata = {
      title: '',
      category: '',
      difficulty: 'Medium',
      tags: []
    };
    this.sections = {
      statement: '',
      solutions: []
    };
    this.images = [];
  }

  /**
   * Main parse function
   */
  parse(latexSource) {
    console.log('[Parser] Starting parse...');
    
    // 1. Extract metadata
    this.extractMetadata(latexSource);
    
    // 2. Extract sections
    this.extractSections(latexSource);
    
    // 3. Find images
    this.extractImages(latexSource);
    
    console.log('[Parser] Parsed:', {
      metadata: this.metadata,
      sections: this.sections,
      images: this.images
    });
    
    return {
      metadata: this.metadata,
      sections: this.sections,
      images: this.images,
      source: latexSource
    };
  }

  /**
   * Extract metadata from comments or custom commands
   */
  extractMetadata(latex) {
    // Method 1: JSON in comment
    // % metadata: {"difficulty": "Hard", "category": "Algebra"}
    const jsonMatch = latex.match(/% metadata:\s*(\{[^}]+\})/);
    if (jsonMatch) {
      try {
        const meta = JSON.parse(jsonMatch[1]);
        Object.assign(this.metadata, meta);
      } catch (e) {
        console.warn('Failed to parse JSON metadata');
      }
    }
    
    // Method 2: Key-value pairs in comment
    // % metadata: difficulty=Hard, category=Algebra, tags=quadratic,equations
    const kvMatch = latex.match(/% metadata:\s*(.+)/);
    if (kvMatch) {
      const pairs = kvMatch[1].split(',');
      pairs.forEach(pair => {
        const [key, value] = pair.split('=').map(s => s.trim());
        if (key && value) {
          if (key === 'tags') {
            this.metadata.tags = value.split(/[,;]/).map(t => t.trim());
          } else {
            this.metadata[key] = value;
          }
        }
      });
    }
    
    // Method 3: LaTeX commands
    // \title{Problem Title}
    const titleMatch = latex.match(/\\title\{([^}]+)\}/);
    if (titleMatch) {
      this.metadata.title = titleMatch[1];
    }
    
    // \difficulty{Hard}
    const diffMatch = latex.match(/\\difficulty\{([^}]+)\}/);
    if (diffMatch) {
      this.metadata.difficulty = diffMatch[1];
    }
    
    // \category{Algebra}
    const catMatch = latex.match(/\\category\{([^}]+)\}/);
    if (catMatch) {
      this.metadata.category = catMatch[1];
    }
    
    // Auto-detect category from content if not set
    if (!this.metadata.category) {
      this.metadata.category = this.guessCategory(latex);
    }
  }

  /**
   * Guess category from content
   */
  guessCategory(latex) {
    const lower = latex.toLowerCase();
    
    if (lower.match(/triangle|circle|angle|perpendicular|parallel/)) {
      return 'Geometry';
    }
    if (lower.match(/prime|divisor|gcd|modulo|congruence/)) {
      return 'Number Theory';
    }
    if (lower.match(/combination|permutation|graph|tree/)) {
      return 'Combinatorics';
    }
    if (lower.match(/equation|polynomial|inequality|root/)) {
      return 'Algebra';
    }
    
    return 'General';
  }

  /**
   * Extract sections (Problem Statement, Solutions)
   */
  extractSections(latex) {
    // Clean up: remove preamble and document wrapper
    let content = latex;
    
    // Extract body content between \begin{document} and \end{document}
    const bodyMatch = latex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    if (bodyMatch) {
      content = bodyMatch[1];
    }
    
    // Remove \title, \author, \date commands
    content = content.replace(/\\(title|author|date)\{[^}]*\}/g, '');
    content = content.replace(/\\maketitle/g, '');
    
    // Find sections
    const sectionPattern = /\\section\*?\{([^}]+)\}([\s\S]*?)(?=\\section|$)/g;
    let matches = [...content.matchAll(sectionPattern)];
    
    if (matches.length === 0) {
      // No sections - treat all as problem statement
      this.sections.statement = content.trim();
      return;
    }
    
    matches.forEach(match => {
      const title = match[1].trim();
      const sectionContent = match[2].trim();
      
      // Categorize section
      if (this.isProblemSection(title)) {
        this.sections.statement = sectionContent;
      } else if (this.isSolutionSection(title)) {
        // Check for subsections
        const subsections = this.extractSubsections(sectionContent);
        
        if (subsections.length > 0) {
          this.sections.solutions.push(...subsections);
        } else {
          this.sections.solutions.push({
            title: title,
            content: sectionContent
          });
        }
      } else {
        // Unknown section - add to statement
        if (this.sections.statement) {
          this.sections.statement += '\n\n' + sectionContent;
        } else {
          this.sections.statement = sectionContent;
        }
      }
    });
  }

  /**
   * Check if section is problem statement
   */
  isProblemSection(title) {
    const lower = title.toLowerCase();
    return lower.match(/problem|statement|question|task/);
  }

  /**
   * Check if section is solution
   */
  isSolutionSection(title) {
    const lower = title.toLowerCase();
    return lower.match(/solution|answer|proof|method/);
  }

  /**
   * Extract subsections (for multiple solution methods)
   */
  extractSubsections(content) {
    const subsectionPattern = /\\subsection\*?\{([^}]+)\}([\s\S]*?)(?=\\subsection|$)/g;
    const subsections = [];
    let match;
    
    while ((match = subsectionPattern.exec(content)) !== null) {
      subsections.push({
        title: match[1].trim(),
        content: match[2].trim()
      });
    }
    
    return subsections;
  }

  /**
   * Extract image references
   */
  extractImages(latex) {
    // Find \includegraphics commands
    const imgPattern = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
    let match;
    
    while ((match = imgPattern.exec(latex)) !== null) {
      this.images.push({
        filename: match[1],
        path: null
      });
    }
  }

  /**
   * Convert to Az-Math format
   */
  toAzMathFormat() {
    return {
      title: this.metadata.title,
      category: this.metadata.category,
      difficulty: this.metadata.difficulty,
      tags: this.metadata.tags,
      statement: this.latexToBlocks(this.sections.statement),
      solutions: this.sections.solutions.map(sol => ({
        title: sol.title,
        blocks: this.latexToBlocks(sol.content)
      })),
      contentType: 'latex',
      latex: {
        source: '',  // Will be filled by uploader
        statement: this.sections.statement,
        solutions: this.sections.solutions.map(s => s.content)
      }
    };
  }

  /**
   * Convert LaTeX content to block format
   */
  latexToBlocks(latex) {
    if (!latex) return [];
    
    const blocks = [];
    
    // Split by images
    const parts = latex.split(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
    
    for (let i = 0; i < parts.length; i += 2) {
      // Text part
      const text = parts[i].trim();
      if (text) {
        blocks.push({
          type: 'text',
          content: this.cleanLatexText(text)
        });
      }
      
      // Image part (if exists)
      if (i + 1 < parts.length) {
        const imgFilename = parts[i + 1];
        blocks.push({
          type: 'image',
          url: '',  // Will be filled after upload
          filename: imgFilename,
          alignment: 'center',
          size: 'medium'
        });
      }
    }
    
    return blocks;
  }

  /**
   * Clean LaTeX text for HTML display
   */
  cleanLatexText(latex) {
    let text = latex;
    
    // Convert display math \[ \] to $$ $$
    text = text.replace(/\\\[/g, '$$');
    text = text.replace(/\\\]/g, '$$');
    
    // Convert inline math \( \) to $ $
    text = text.replace(/\\\(/g, '$');
    text = text.replace(/\\\)/g, '$');
    
    // Remove excessive whitespace
    text = text.replace(/\n\n+/g, '</p><p>');
    text = text.replace(/^\s+|\s+$/g, '');
    
    // Wrap in paragraphs if not already
    if (!text.startsWith('<p>')) {
      text = '<p>' + text + '</p>';
    }
    
    return text;
  }
}

// Export for use in other modules
window.LaTeXParser = LaTeXParser;
