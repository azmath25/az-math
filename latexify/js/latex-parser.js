// latex-parser.js - Full LaTeX command support
// Uses hybrid approach: Custom parsing + regex transformations

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
    this.mathPlaceholders = [];
  }

  /**
   * Main parse function
   */
  parse(latexSource) {
    console.log('[Enhanced Parser] Starting full LaTeX parse...');
    
    // 1. Extract metadata
    this.extractMetadata(latexSource);
    
    // 2. Extract sections
    this.extractSections(latexSource);
    
    // 3. Find images
    this.extractImages(latexSource);
    
    console.log('[Enhanced Parser] Parsed:', {
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
   * Extract metadata (keep from original)
   */
  extractMetadata(latex) {
    // Method 1: JSON in comment
    const jsonMatch = latex.match(/% metadata:\s*(\{[^}]+\})/);
    if (jsonMatch) {
      try {
        const meta = JSON.parse(jsonMatch[1]);
        Object.assign(this.metadata, meta);
      } catch (e) {
        console.warn('Failed to parse JSON metadata');
      }
    }
    
    // Method 2: Key-value pairs
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
    
    // LaTeX commands
    const titleMatch = latex.match(/\\title\{([^}]+)\}/);
    if (titleMatch) this.metadata.title = titleMatch[1];
    
    const diffMatch = latex.match(/\\difficulty\{([^}]+)\}/);
    if (diffMatch) this.metadata.difficulty = diffMatch[1];
    
    const catMatch = latex.match(/\\category\{([^}]+)\}/);
    if (catMatch) this.metadata.category = catMatch[1];
    
    // Auto-detect category
    if (!this.metadata.category) {
      this.metadata.category = this.guessCategory(latex);
    }
  }

  /**
   * Guess category from content
   */
  guessCategory(latex) {
    const lower = latex.toLowerCase();
    
    if (lower.match(/triangle|circle|angle|perpendicular|parallel|geometry/)) {
      return 'Geometry';
    }
    if (lower.match(/prime|divisor|gcd|modulo|congruence|number theory/)) {
      return 'Number Theory';
    }
    if (lower.match(/combination|permutation|graph|tree|combinatorics/)) {
      return 'Combinatorics';
    }
    if (lower.match(/equation|polynomial|inequality|root|algebra/)) {
      return 'Algebra';
    }
    
    return 'General';
  }

  /**
   * Extract sections
   */
  extractSections(latex) {
    let content = latex;
    
    // Extract body
    const bodyMatch = latex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    if (bodyMatch) {
      content = bodyMatch[1];
    }
    
    // Remove preamble commands
    content = content.replace(/\\(title|author|date)\{[^}]*\}/g, '');
    content = content.replace(/\\maketitle/g, '');
    
    // Find sections
    const sectionPattern = /\\section\*?\{([^}]+)\}([\s\S]*?)(?=\\section|$)/g;
    let matches = [...content.matchAll(sectionPattern)];
    
    if (matches.length === 0) {
      // No sections - treat all as problem statement
      this.sections.statement = this.convertLaTeXToHTML(content.trim());
      return;
    }
    
    matches.forEach(match => {
      const title = match[1].trim();
      const sectionContent = match[2].trim();
      
      if (this.isProblemSection(title)) {
        this.sections.statement = this.convertLaTeXToHTML(sectionContent);
      } else if (this.isSolutionSection(title)) {
        // Check for subsections
        const subsections = this.extractSubsections(sectionContent);
        
        if (subsections.length > 0) {
          subsections.forEach(sub => {
            this.sections.solutions.push({
              title: sub.title,
              content: this.convertLaTeXToHTML(sub.content)
            });
          });
        } else {
          this.sections.solutions.push({
            title: title,
            content: this.convertLaTeXToHTML(sectionContent)
          });
        }
      } else {
        // Unknown section - add to statement
        if (this.sections.statement) {
          this.sections.statement += '\n\n' + this.convertLaTeXToHTML(sectionContent);
        } else {
          this.sections.statement = this.convertLaTeXToHTML(sectionContent);
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
   * Extract subsections
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
   * Extract images
   */
  extractImages(latex) {
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
   * CORE: Convert LaTeX to HTML with full command support
   */
  convertLaTeXToHTML(latex) {
    if (!latex) return '';
    
    let html = latex;
    
    // Step 1: Protect math expressions
    html = this.protectMath(html);
    
    // Step 2: Convert text formatting commands
    html = this.convertTextFormatting(html);
    
    // Step 3: Convert environments (itemize, enumerate, etc.)
    html = this.convertEnvironments(html);
    
    // Step 4: Convert subsections
    html = this.convertSubsections(html);
    
    // Step 5: Clean up whitespace
    html = this.cleanWhitespace(html);
    
    // Step 6: Restore math
    html = this.restoreMath(html);
    
    // Step 7: Wrap in paragraphs
    html = this.wrapInParagraphs(html);
    
    return html;
  }

  /**
   * Protect math expressions with placeholders
   */
  protectMath(text) {
    this.mathPlaceholders = [];
    let counter = 0;
    
    // Protect display math $$...$$
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
      const placeholder = `___MATH_DISPLAY_${counter}___`;
      this.mathPlaceholders.push({ placeholder, content: '$$' + content + '$$', type: 'display' });
      counter++;
      return placeholder;
    });
    
    // Protect display math \[...\]
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
      const placeholder = `___MATH_DISPLAY_${counter}___`;
      this.mathPlaceholders.push({ placeholder, content: '$$' + content + '$$', type: 'display' });
      counter++;
      return placeholder;
    });
    
    // Protect inline math $...$
    text = text.replace(/\$([^\$]+?)\$/g, (match, content) => {
      const placeholder = `___MATH_INLINE_${counter}___`;
      this.mathPlaceholders.push({ placeholder, content: '$' + content + '$', type: 'inline' });
      counter++;
      return placeholder;
    });
    
    // Protect inline math \(...\)
    text = text.replace(/\\\(([^)]+?)\\\)/g, (match, content) => {
      const placeholder = `___MATH_INLINE_${counter}___`;
      this.mathPlaceholders.push({ placeholder, content: '$' + content + '$', type: 'inline' });
      counter++;
      return placeholder;
    });
    
    // Protect math environments
    const mathEnvs = ['align', 'equation', 'gather', 'multline', 'array'];
    mathEnvs.forEach(env => {
      const pattern = new RegExp(`\\\\begin\\{${env}\\*?\\}([\\s\\S]*?)\\\\end\\{${env}\\*?\\}`, 'g');
      text = text.replace(pattern, (match, content) => {
        const placeholder = `___MATH_DISPLAY_${counter}___`;
        this.mathPlaceholders.push({ 
          placeholder, 
          content: `\\begin{${env}}${content}\\end{${env}}`, 
          type: 'display' 
        });
        counter++;
        return placeholder;
      });
    });
    
    return text;
  }

  /**
   * Restore math expressions
   */
  restoreMath(text) {
    this.mathPlaceholders.forEach(item => {
      text = text.replace(item.placeholder, item.content);
    });
    return text;
  }

  /**
   * Convert text formatting commands
   */
  convertTextFormatting(text) {
    // Bold
    text = text.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
    text = text.replace(/\\bf\s+([^\s\\]+)/g, '<strong>$1</strong>');
    
    // Italic
    text = text.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
    text = text.replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>');
    text = text.replace(/\\it\s+([^\s\\]+)/g, '<em>$1</em>');
    
    // Underline
    text = text.replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');
    
    // Typewriter (monospace)
    text = text.replace(/\\texttt\{([^}]+)\}/g, '<code>$1</code>');
    
    // Small caps
    text = text.replace(/\\textsc\{([^}]+)\}/g, '<span style="font-variant: small-caps;">$1</span>');
    
    // URLs and links
    text = text.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, '<a href="$1" target="_blank">$2</a>');
    text = text.replace(/\\url\{([^}]+)\}/g, '<a href="$1" target="_blank">$1</a>');
    
    return text;
  }

  /**
   * Convert environments (itemize, enumerate, center, etc.)
   */
  convertEnvironments(text) {
    // Itemize (bullet lists)
    text = text.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (match, content) => {
      const items = content.split(/\\item/).filter(item => item.trim());
      const listItems = items.map(item => `<li>${item.trim()}</li>`).join('\n');
      return `<ul>\n${listItems}\n</ul>`;
    });
    
    // Enumerate (numbered lists)
    text = text.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (match, content) => {
      const items = content.split(/\\item/).filter(item => item.trim());
      const listItems = items.map(item => `<li>${item.trim()}</li>`).join('\n');
      return `<ol>\n${listItems}\n</ol>`;
    });
    
    // Center environment
    text = text.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g, 
      '<div style="text-align: center;">$1</div>');
    
    // Quote environment
    text = text.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, 
      '<blockquote>$1</blockquote>');
    
    // Verbatim
    text = text.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, 
      '<pre><code>$1</code></pre>');
    
    return text;
  }

  /**
   * Convert subsections to headings
   */
  convertSubsections(text) {
    // Already handled in extractSubsections, but convert any remaining
    text = text.replace(/\\subsubsection\*?\{([^}]+)\}/g, '<h5>$1</h5>');
    text = text.replace(/\\paragraph\{([^}]+)\}/g, '<h6>$1</h6>');
    
    return text;
  }

  /**
   * Clean whitespace and line breaks
   */
  cleanWhitespace(text) {
    // Remove multiple blank lines
    text = text.replace(/\n\n\n+/g, '\n\n');
    
    // Remove LaTeX comments
    text = text.replace(/%[^\n]*\n/g, '\n');
    
    // Convert double line breaks to paragraph breaks
    text = text.replace(/\n\n/g, '</p><p>');
    
    return text.trim();
  }

  /**
   * Wrap text in paragraphs
   */
  wrapInParagraphs(text) {
    // Split by existing HTML tags
    const parts = text.split(/(<[^>]+>.*?<\/[^>]+>|<[^>]+\/>)/);
    
    let result = '';
    let inParagraph = false;
    
    parts.forEach(part => {
      // Check if it's an HTML tag
      if (part.match(/^<(ul|ol|h[1-6]|blockquote|pre|div)/)) {
        // Close paragraph if open
        if (inParagraph) {
          result += '</p>\n';
          inParagraph = false;
        }
        result += part + '\n';
      } else if (part.trim()) {
        // Text content
        if (!inParagraph && !part.match(/^<\/p>/)) {
          result += '<p>';
          inParagraph = true;
        }
        result += part;
      }
    });
    
    // Close final paragraph
    if (inParagraph) {
      result += '</p>';
    }
    
    return result;
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
      statement: this.htmlToBlocks(this.sections.statement),
      solutions: this.sections.solutions.map(sol => ({
        title: sol.title,
        blocks: this.htmlToBlocks(sol.content)
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
   * Convert HTML to block format
   */
  htmlToBlocks(html) {
    if (!html) return [];
    
    const blocks = [];
    
    // Split by images (keep images separate)
    const imgPattern = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
    const parts = html.split(imgPattern);
    
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Text part
        const text = parts[i].trim();
        if (text) {
          blocks.push({
            type: 'text',
            content: text
          });
        }
      } else {
        // Image filename
        blocks.push({
          type: 'image',
          url: '',  // Will be filled after upload
          filename: parts[i],
          alignment: 'center',
          size: 'medium'
        });
      }
    }
    
    return blocks;
  }
}

// Export for use in other modules
window.LaTeXParser = LaTeXParser;
