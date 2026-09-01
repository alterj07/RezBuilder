import { Resume } from '../../types/resume';
import { extractTextFromPdf } from './pdfParser';
import { extractTextFromDocx } from './docxParser';
import { extractResumeSections } from './sectionExtractor';

export async function parseResumeFile(
  file: File,
  tag: string = 'General',
  password?: string
): Promise<Resume> {
  const fileName = file.name;
  const fileExt = fileName.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  let rawText = '';
  let fileType: Resume['fileType'] = 'text';

  if (fileExt === 'pdf') {
    fileType = 'pdf';
    rawText = await extractTextFromPdf(arrayBuffer, password);
  } else if (fileExt === 'docx') {
    fileType = 'docx';
    rawText = await extractTextFromDocx(arrayBuffer);
  } else if (fileExt === 'txt' || fileExt === 'md') {
    fileType = 'text';
    const decoder = new TextDecoder('utf-8');
    rawText = decoder.decode(arrayBuffer);
  } else {
    throw new Error(`Unsupported file format: .${fileExt}. Please upload a PDF or DOCX file.`);
  }

  if (!rawText || rawText.trim().length < 20) {
    throw new Error('The uploaded file appears to be empty or unreadable.');
  }

  const sections = extractResumeSections(rawText);
  const candidateName = sections.contact.name || fileName.replace(/\.[^/.]+$/, '');

  const resume: Resume = {
    id: 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: candidateName,
    tag: tag || 'General',
    fileName,
    fileType,
    uploadedAt: new Date().toISOString(),
    rawText,
    sections,
  };

  return resume;
}

export * from './pdfParser';
export * from './docxParser';
export * from './sectionExtractor';
