import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function parseDocument(fileBuffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase();

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    const data = await pdfParse(fileBuffer);
    return data.text.trim();
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value.trim();
  }

  // Default text formats (txt, md, json, csv)
  return fileBuffer.toString('utf-8').trim();
}
