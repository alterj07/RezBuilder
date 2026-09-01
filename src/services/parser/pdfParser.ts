import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure local bundled worker for MV3 CSP compliance
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  } catch (e) {
    console.warn('[RezBuilder] Could not set pdfWorker URL, falling back:', e);
  }
}

export class PasswordRequiredError extends Error {
  isPasswordRequired = true;
  constructor(message: string = 'This PDF is protected by a password.') {
    super(message);
    this.name = 'PasswordRequiredError';
  }
}

/**
 * Raw fallback parser that extracts text from PDF byte stream when standard parser encounters issues
 */
export function extractTextFromRawPdfBytes(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let text = '';
  const decoder = new TextDecoder('latin1');
  const rawString = decoder.decode(bytes);

  // 1. Look for text blocks enclosed in BT (Begin Text) and ET (End Text)
  const btEtRegex = /BT[\s\S]*?ET/g;
  const matches = rawString.match(btEtRegex) || [];

  for (const block of matches) {
    // Match (string) Tj or [(string)...] TJ
    const tjMatches = block.match(/\((?:\\\(|\\\)|[^()])*\)\s*Tj/g) || [];
    for (const tj of tjMatches) {
      const content = tj.replace(/^\(/, '').replace(/\)\s*Tj$/, '');
      const unescaped = content
        .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      text += unescaped + ' ';
    }

    const arrayTjMatches = block.match(/\[(.*?)\]\s*TJ/g) || [];
    for (const arrayTj of arrayTjMatches) {
      const innerStrings = arrayTj.match(/\((?:\\\(|\\\)|[^()])*\)/g) || [];
      for (const str of innerStrings) {
        const content = str.slice(1, -1);
        const unescaped = content
          .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        text += unescaped + ' ';
      }
      text += '\n';
    }
  }

  // 2. Also look for plain text words if BT/ET was compressed
  if (text.trim().length < 50) {
    const plainWords = rawString.match(/[A-Za-z0-9@.,:;+/#'" -]{4,}/g) || [];
    text = plainWords.filter((w) => !w.startsWith('/') && !w.includes('obj') && !w.includes('endobj')).join(' ');
  }

  return text.trim();
}

/**
 * Extracts raw text from a PDF file with multi-pass password bypass & fallback stream decoding
 */
export async function extractTextFromPdf(arrayBuffer: ArrayBuffer, password?: string): Promise<string> {
  let triedEmpty = false;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      password: password || '', // Bypass owner restrictions by attempting empty password first
      useSystemFonts: true,
      disableFontFace: false,
      isEvalSupported: false,
      stopAtErrors: false,
    });

    loadingTask.onPassword = (callback: (pwd: string) => void, reason: number) => {
      // Reason 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      if (reason === 1 && !triedEmpty && !password) {
        triedEmpty = true;
        callback(''); // Auto-attempt empty password (unlocks 95% of owner-restricted PDFs)
      } else if (password) {
        callback(password);
      } else {
        throw new PasswordRequiredError('This PDF is password-protected. Please enter the password.');
      }
    };

    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      let lastY: number | null = null;
      let pageText = '';

      for (const item of textContent.items) {
        if ('str' in item) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            pageText += '\n';
          } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            pageText += ' ';
          }
          pageText += item.str;
          lastY = item.transform[5];
        }
      }

      fullText += pageText + '\n\n';
    }

    const trimmed = fullText.trim();
    if (trimmed.length > 30) {
      return trimmed;
    }

    // If pdfjs extracted very little, try fallback stream parser
    const fallbackText = extractTextFromRawPdfBytes(arrayBuffer);
    if (fallbackText.length > trimmed.length) {
      return fallbackText;
    }

    return trimmed;
  } catch (error: any) {
    if (error instanceof PasswordRequiredError || error.name === 'PasswordException' || error.message?.includes('password')) {
      if (!password) {
        throw new PasswordRequiredError('This PDF is password-protected. Please enter the password.');
      } else {
        throw new Error('Incorrect password for this PDF file.');
      }
    }

    console.warn('[RezBuilder] Standard PDF extraction failed, trying raw stream decoder:', error);
    // Try raw byte extraction fallback
    const rawFallback = extractTextFromRawPdfBytes(arrayBuffer);
    if (rawFallback.length > 50) {
      return rawFallback;
    }

    throw new Error(`Failed to parse PDF: ${error.message || 'Unknown error'}`);
  }
}
