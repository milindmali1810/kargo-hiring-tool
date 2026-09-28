import mammoth from "mammoth";

/**
 * Format-agnostic CV text extraction. PDF and DOCX are the two formats seen in
 * the application pool; anything else is rejected explicitly rather than
 * silently producing empty text.
 */
export async function extractText(file: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: file });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: file });
    return result.value;
  }

  throw new Error(`Unsupported file type: .${ext}. Only .pdf and .docx are supported.`);
}
