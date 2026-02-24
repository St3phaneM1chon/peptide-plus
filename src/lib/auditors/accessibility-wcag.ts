/**
 * ACCESSIBILITY-WCAG Auditor
 * Checks WCAG accessibility: alt text, interactive elements, aria labels, color contrast, focus management.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class AccessibilityWcagAuditor extends BaseAuditor {
  auditTypeCode = 'ACCESSIBILITY-WCAG';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkImageAltText());
    results.push(...this.checkInteractiveElements());
    results.push(...this.checkIconButtonAriaLabels());
    results.push(...this.checkInlineColorContrast());
    results.push(...this.checkFocusManagement());

    return results;
  }

  /**
   * a11y-01: Check <img> and <Image> elements have alt attribute.
   * WCAG 1.1.1 requires all non-decorative images to have text alternatives.
   */
  private checkImageAltText(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsxFiles = this.findFiles(this.srcDir, /\.tsx$/);

    const missingAlt: { file: string; line: number; tag: string; snippet: string }[] = [];
    let totalImages = 0;

    for (const file of tsxFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for <img or <Image tags
        const imgMatch = line.match(/<(?:img|Image)\s/i);
        if (!imgMatch) continue;

        totalImages++;

        // Look for alt attribute in this line and subsequent lines (for multi-line tags)
        // Gather the full tag content
        let tagContent = '';
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
          tagContent += lines[j];
          if (/>/.test(lines[j])) break;
        }

        // Check for alt attribute
        const hasAlt = /\balt\s*=/.test(tagContent);
        // alt="" is valid for decorative images
        const hasEmptyAlt = /\balt\s*=\s*["'][\s]*["']/.test(tagContent);

        if (!hasAlt) {
          missingAlt.push({
            file,
            line: i + 1,
            tag: imgMatch[0].includes('Image') ? '<Image>' : '<img>',
            snippet: this.getSnippet(content, i + 1),
          });
        } else if (hasEmptyAlt) {
          // alt="" is acceptable for decorative images but should be noted
          // Only flag if it's not explicitly marked as decorative
          if (!/decorative|presentation|aria-hidden/.test(tagContent)) {
            // This is a soft warning, not an error
          }
        }
      }
    }

    if (missingAlt.length === 0) {
      results.push(this.pass('a11y-01', `All ${totalImages} image elements have alt attributes`));
    } else {
      for (const item of missingAlt.slice(0, 10)) {
        results.push(
          this.fail(
            'a11y-01',
            'HIGH',
            `${item.tag} missing alt attribute`,
            `WCAG 1.1.1: Image element lacks alt text. Screen readers cannot describe this image to visually impaired users.`,
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              codeSnippet: item.snippet,
              recommendation:
                'Add a descriptive alt attribute. For decorative images, use alt="" and role="presentation".',
            }
          )
        );
      }

      if (missingAlt.length > 10) {
        results.push(
          this.fail(
            'a11y-01',
            'INFO',
            'Missing alt text summary',
            `${missingAlt.length} of ${totalImages} images are missing alt attributes. Showing first 10.`,
            {
              recommendation: 'Audit all images and add meaningful alt text for content images, or alt="" for decorative ones',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * a11y-02: Check interactive elements (button, a, input) have accessible attributes.
   * Buttons need accessible names, links need href, inputs need labels.
   */
  private checkInteractiveElements(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsxFiles = this.findFiles(this.srcDir, /\.tsx$/);

    const issues: { file: string; line: number; element: string; issue: string }[] = [];

    for (const file of tsxFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comment lines
        if (/^\s*\/\//.test(line) || /^\s*\*/.test(line) || /^\s*{\/\*/.test(line)) continue;

        // Check <input> elements for associated labels
        if (/<input\s/.test(line)) {
          // Gather multi-line tag (handle JSX with arrow functions and expressions containing >)
          let tagContent = '';
          let braceDepth = 0;
          for (let j = i; j < Math.min(i + 8, lines.length); j++) {
            const ln = lines[j];
            for (let c = 0; c < ln.length; c++) {
              if (ln[c] === '{') braceDepth++;
              if (ln[c] === '}') braceDepth--;
            }
            tagContent += ln + ' ';
            // Only consider tag closed when braces are balanced and we find /> or >
            if (braceDepth <= 0 && (/\/>\s*$/.test(ln.trim()) || />\s*$/.test(ln.trim()))) break;
          }

          const hasLabel =
            /aria-label\s*=/.test(tagContent) ||
            /aria-labelledby\s*=/.test(tagContent) ||
            /id\s*=/.test(tagContent) || // May be linked via <label htmlFor>
            /placeholder\s*=/.test(tagContent); // Placeholder is not ideal but provides some context

          // Check if a <label> element exists in the 1-3 lines before the input (visual association)
          const prevLines = lines.slice(Math.max(0, i - 3), i).join(' ');
          const hasAdjacentLabel = /<label[\s>]/.test(prevLines);

          // Check if input is inside a wrapping <label> element
          const hasWrappingLabel = /<label[\s>]/.test(lines.slice(Math.max(0, i - 5), i).join(' ')) &&
            !/<\/label>/.test(lines.slice(Math.max(0, i - 5), i).join(' '));

          const hasType = /type\s*=\s*["']hidden["']/.test(tagContent);

          if (!hasLabel && !hasType && !hasAdjacentLabel && !hasWrappingLabel) {
            issues.push({
              file,
              line: i + 1,
              element: '<input>',
              issue: 'Input lacks aria-label, aria-labelledby, or associated label',
            });
          }
        }

        // Check <a> elements have href and accessible text
        if (/<a\s/.test(line) && !/<a\s[^>]*href/.test(line)) {
          // Gather multi-line tag
          let tagContent = '';
          for (let j = i; j < Math.min(i + 3, lines.length); j++) {
            tagContent += lines[j];
            if (/>/.test(lines[j])) break;
          }

          if (!/href\s*=/.test(tagContent) && !/onClick/.test(tagContent)) {
            issues.push({
              file,
              line: i + 1,
              element: '<a>',
              issue: 'Anchor element without href (not keyboard accessible)',
            });
          }
        }

        // Check <select> elements have associated labels
        if (/<select\s/.test(line)) {
          let tagContent = '';
          let braceDepth2 = 0;
          for (let j = i; j < Math.min(i + 8, lines.length); j++) {
            const ln = lines[j];
            for (let c = 0; c < ln.length; c++) {
              if (ln[c] === '{') braceDepth2++;
              if (ln[c] === '}') braceDepth2--;
            }
            tagContent += ln + ' ';
            if (braceDepth2 <= 0 && />\s*$/.test(ln.trim())) break;
          }

          const hasLabel =
            /aria-label\s*=/.test(tagContent) ||
            /aria-labelledby\s*=/.test(tagContent) ||
            /id\s*=/.test(tagContent);

          if (!hasLabel) {
            issues.push({
              file,
              line: i + 1,
              element: '<select>',
              issue: 'Select element lacks accessible label',
            });
          }
        }
      }
    }

    if (issues.length === 0) {
      results.push(this.pass('a11y-02', 'All interactive elements have proper accessible attributes'));
    } else {
      for (const item of issues.slice(0, 10)) {
        const content = this.readFile(item.file);
        results.push(
          this.fail(
            'a11y-02',
            'MEDIUM',
            `Accessibility issue on ${item.element}`,
            `WCAG 4.1.2: ${item.issue}`,
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              codeSnippet: content ? this.getSnippet(content, item.line) : undefined,
              recommendation:
                'Add aria-label, aria-labelledby, or ensure a <label htmlFor="..."> is associated with the element',
            }
          )
        );
      }

      if (issues.length > 10) {
        results.push(
          this.fail(
            'a11y-02',
            'INFO',
            'Interactive element accessibility summary',
            `${issues.length} interactive elements have accessibility issues. Showing first 10.`,
            {
              recommendation: 'Run axe-core or Lighthouse accessibility audit for comprehensive results',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * a11y-03: Check for aria-label on icon-only buttons.
   * Buttons containing only icons (SVG, icon classes) need aria-label for screen readers.
   */
  private checkIconButtonAriaLabels(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsxFiles = this.findFiles(this.srcDir, /\.tsx$/);

    const iconButtonsWithoutLabel: { file: string; line: number; snippet: string }[] = [];

    for (const file of tsxFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for button elements
        if (!/<button\s|<Button\s/.test(line)) continue;

        // Gather the full button tag and its content
        let buttonContent = '';
        let braceDepth = 0;
        let foundOpen = false;

        for (let j = i; j < Math.min(i + 15, lines.length); j++) {
          buttonContent += lines[j] + '\n';
          for (const ch of lines[j]) {
            if (ch === '<' && !foundOpen) foundOpen = true;
            if (ch === '>') braceDepth++;
          }
          // Only break on actual closing </button> or </Button>, NOT on child self-closing tags
          // (e.g., <path />, <svg />, <span />) which appear inside the button
          if (/<\/[bB]utton>/.test(lines[j])) break;
          // Self-closing button (no children): <Button ... /> or <button ... />
          if (/^[^<]*<[bB]utton\b[^>]*\/>/.test(lines[j]) && j === i) break;
        }

        // Check if button contains only icon content (SVG, icon components, or icon classes)
        const iconPatterns = [
          /<svg[\s>]/i,
          /Icon\s*\/>/,
          /Icon\s*>/,
          /className\s*=\s*["'][^"']*icon[^"']*["']/i,
          /lucide-react/,
          /heroicons/,
          /react-icons/,
          /<(?:FiMenu|FiX|FiSearch|FiChevron|HiMenu|BiMenu|AiOutline|MdClose|MdMenu)\s/,
        ];

        const hasIcon = iconPatterns.some((p) => p.test(buttonContent));

        // Check if button has text content (not just icons)
        // t() calls and string literals inside JSX expressions are visible text
        const hasTranslationText = /\{.*?\bt\s*\(/.test(buttonContent);
        const hasStringLiteral = /\{.*?['"][A-Za-z]/.test(buttonContent);

        // Remove all JSX tags and check if there's remaining text
        const textContent = buttonContent
          .replace(/<[^>]*>/g, '') // Remove tags
          .replace(/\{[^}]*\}/g, '') // Remove JSX expressions
          .replace(/\s+/g, '')
          .trim();

        const isIconOnly = hasIcon && textContent.length < 3 && !hasTranslationText && !hasStringLiteral;

        if (isIconOnly) {
          // Check for accessible labels
          const hasAriaLabel =
            /aria-label\s*=/.test(buttonContent) ||
            /aria-labelledby\s*=/.test(buttonContent) ||
            /title\s*=/.test(buttonContent) ||
            /sr-only/.test(buttonContent) || // Tailwind screen reader only class
            /visually-hidden/.test(buttonContent);

          if (!hasAriaLabel) {
            iconButtonsWithoutLabel.push({
              file,
              line: i + 1,
              snippet: this.getSnippet(content, i + 1, 3),
            });
          }
        }
      }
    }

    if (iconButtonsWithoutLabel.length === 0) {
      results.push(this.pass('a11y-03', 'All detected icon-only buttons have accessible labels'));
    } else {
      for (const item of iconButtonsWithoutLabel.slice(0, 10)) {
        results.push(
          this.fail(
            'a11y-03',
            'HIGH',
            'Icon-only button missing aria-label',
            'WCAG 1.1.1/4.1.2: Button appears to contain only an icon with no accessible text. Screen readers will announce it as "button" with no description.',
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              codeSnippet: item.snippet,
              recommendation:
                'Add aria-label="Description" to the button, or include a <span className="sr-only">Description</span> inside it',
            }
          )
        );
      }

      if (iconButtonsWithoutLabel.length > 10) {
        results.push(
          this.fail(
            'a11y-03',
            'INFO',
            'Icon button summary',
            `${iconButtonsWithoutLabel.length} icon-only buttons lack accessible labels. Showing first 10.`,
            {
              recommendation: 'Audit all icon buttons and add aria-label describing the action',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * a11y-04: Check for color contrast issues in inline styles (basic check).
   * WCAG 1.4.3 requires minimum contrast ratios for text.
   */
  private checkInlineColorContrast(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsxFiles = this.findFiles(this.srcDir, /\.tsx$/);

    // Light colors that may have contrast issues on white backgrounds
    const lightColors = [
      '#fff',
      '#ffffff',
      '#fafafa',
      '#f5f5f5',
      '#eee',
      '#eeeeee',
      '#ddd',
      '#dddddd',
      '#ccc',
      '#cccccc',
      '#bbb',
      '#bbbbbb',
      '#aaa',
      '#aaaaaa',
      '#999',
      '#999999',
      'lightgray',
      'lightgrey',
      'silver',
      'gainsboro',
      'whitesmoke',
    ];

    const potentialIssues: { file: string; line: number; color: string; property: string }[] = [];

    for (const file of tsxFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Look for inline style color properties
        const colorMatch = line.match(/color\s*:\s*['"]?(#[0-9a-fA-F]{3,6}|[a-zA-Z]+)['"]?/);
        if (colorMatch) {
          const color = colorMatch[1].toLowerCase();

          // Check if it's a potentially low-contrast color
          if (lightColors.includes(color)) {
            potentialIssues.push({
              file,
              line: i + 1,
              color: colorMatch[1],
              property: 'color',
            });
          }
        }

        // Check for opacity that might reduce contrast
        if (/opacity\s*:\s*(0\.[0-4]\d*|0\.[0-5])/.test(line)) {
          // Low opacity on text can cause contrast issues
          if (/color|text|font/.test(line) || /Color|Text/.test(lines[Math.max(0, i - 2)] + lines[Math.max(0, i - 1)])) {
            potentialIssues.push({
              file,
              line: i + 1,
              color: 'low opacity',
              property: 'opacity',
            });
          }
        }
      }
    }

    if (potentialIssues.length === 0) {
      results.push(
        this.pass('a11y-04', 'No obvious inline style color contrast issues detected (basic check)')
      );
    } else {
      results.push(
        this.fail(
          'a11y-04',
          'LOW',
          'Potential color contrast issues in inline styles',
          `${potentialIssues.length} inline style(s) use light colors or low opacity that may fail WCAG 1.4.3 contrast requirements`,
          {
            recommendation:
              'Run a full contrast checker (e.g., axe-core, Lighthouse). Ensure text color has at least 4.5:1 contrast ratio against its background.',
          }
        )
      );

      for (const item of potentialIssues.slice(0, 5)) {
        const content = this.readFile(item.file);
        results.push(
          this.fail(
            'a11y-04',
            'LOW',
            `Potential low-contrast ${item.property}`,
            `Inline style uses "${item.color}" which may not meet WCAG contrast requirements`,
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              codeSnippet: content ? this.getSnippet(content, item.line) : undefined,
              recommendation:
                'Verify the color contrast ratio meets WCAG AA (4.5:1 for normal text, 3:1 for large text)',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * a11y-05: Check for focus management (tabIndex, focus traps in modals).
   * WCAG 2.4.3 requires logical focus order and 2.4.7 requires visible focus.
   */
  private checkFocusManagement(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const tsxFiles = this.findFiles(this.srcDir, /\.tsx$/);

    const positiveTabIndexFiles: { file: string; line: number }[] = [];
    let modalCount = 0;
    let modalsWithFocusTrap = 0;
    const modalsWithoutFocusTrap: { file: string; line: number }[] = [];

    for (const file of tsxFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for positive tabIndex (anti-pattern)
        const tabIndexMatch = line.match(/tabIndex\s*=\s*\{?\s*(\d+)\s*\}?/);
        if (tabIndexMatch) {
          const value = parseInt(tabIndexMatch[1], 10);
          if (value > 0) {
            positiveTabIndexFiles.push({ file, line: i + 1 });
          }
        }

        // Check for modals/dialogs
        if (/[Mm]odal|[Dd]ialog|[Dd]rawer|[Pp]opover|[Oo]verlay/.test(line) && /</.test(line)) {
          // Check if this is a modal component definition
          if (/function\s+\w*(Modal|Dialog|Drawer)/.test(content) || /role\s*=\s*["']dialog["']/.test(content)) {
            modalCount++;

            // Check for focus trap patterns
            const hasFocusTrap =
              /focus-trap|FocusTrap|useFocusTrap|trapFocus|focusTrap/.test(content) ||
              /role\s*=\s*["']dialog["']/.test(content) ||
              /aria-modal\s*=\s*["']true["']/.test(content) ||
              /onKeyDown.*(?:Escape|Tab)/.test(content) ||
              /handleKeyDown.*(?:Escape|Tab)/.test(content) ||
              /useEffect.*focus/.test(content) ||
              // File uses a shared Modal component that already handles focus trapping
              /import.*Modal.*from\s+['"]@\/components\/(admin\/)?Modal['"]/.test(content) ||
              /import.*\{[^}]*Modal[^}]*\}.*from/.test(content);

            if (hasFocusTrap) {
              modalsWithFocusTrap++;
            } else {
              modalsWithoutFocusTrap.push({ file, line: i + 1 });
            }

            break; // Only count once per file
          }
        }
      }
    }

    // Report positive tabIndex
    if (positiveTabIndexFiles.length === 0) {
      results.push(this.pass('a11y-05', 'No positive tabIndex values found (good practice)'));
    } else {
      for (const item of positiveTabIndexFiles.slice(0, 5)) {
        const content = this.readFile(item.file);
        results.push(
          this.fail(
            'a11y-05',
            'MEDIUM',
            'Positive tabIndex value used',
            'WCAG 2.4.3: Using positive tabIndex values (>0) disrupts the natural tab order. Use tabIndex={0} or tabIndex={-1} instead.',
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              codeSnippet: content ? this.getSnippet(content, item.line) : undefined,
              recommendation:
                'Replace tabIndex={N} (where N>0) with tabIndex={0} for focusable elements, or restructure DOM order to match logical reading order',
            }
          )
        );
      }
    }

    // Report modal focus traps
    if (modalCount === 0) {
      results.push(this.pass('a11y-05', 'No modal/dialog components detected'));
    } else if (modalsWithoutFocusTrap.length === 0) {
      results.push(
        this.pass('a11y-05', `All ${modalCount} modal/dialog components have focus management`)
      );
    } else {
      for (const item of modalsWithoutFocusTrap.slice(0, 5)) {
        results.push(
          this.fail(
            'a11y-05',
            'HIGH',
            'Modal without focus trap',
            `WCAG 2.4.3: Modal/dialog component lacks focus trapping. Users can tab to elements behind the modal.`,
            {
              filePath: this.relativePath(item.file),
              lineNumber: item.line,
              recommendation:
                'Add focus trap: use a library like focus-trap-react, or add role="dialog", aria-modal="true", and keyboard event handlers for Tab/Escape',
            }
          )
        );
      }
    }

    // Check for skip navigation link (WCAG 2.4.1)
    const layoutFiles = this.findFiles(this.srcDir, /layout\.tsx$/);
    let hasSkipNav = false;
    for (const file of layoutFiles) {
      const content = this.readFile(file);
      if (content && /skip.*nav|skip.*content|skip.*main/i.test(content)) {
        hasSkipNav = true;
        break;
      }
    }

    if (hasSkipNav) {
      results.push(this.pass('a11y-05', 'Skip navigation link detected'));
    } else {
      results.push(
        this.fail(
          'a11y-05',
          'LOW',
          'No skip navigation link found',
          'WCAG 2.4.1: No "skip to main content" link detected in layout files. Keyboard users must tab through all navigation on every page.',
          {
            recommendation:
              'Add a "Skip to main content" link as the first focusable element in the root layout: <a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a>',
          }
        )
      );
    }

    return results;
  }
}
