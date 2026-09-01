import mammoth from 'mammoth';

/**
 * Extracts raw text from a DOCX file/ArrayBuffer
 */
export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (error) {
    console.error('[RezBuilder] Error extracting text from DOCX:', error);
    throw new Error('Failed to parse DOCX file.');
  }
}
