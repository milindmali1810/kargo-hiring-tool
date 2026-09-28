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
    return sanitize(result.text);
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: file });
    return sanitize(result.value);
  }

  throw new Error(`Unsupported file type: .${ext}. Only .pdf and .docx are supported.`);
}

/**
 * PDF extraction occasionally leaks raw control characters (observed: NUL
 * bytes from a malformed embedded font/encoding) that Postgres text columns
 * reject outright. Strip anything that isn't printable text or ordinary
 * whitespace before this ever reaches normalize() or the database.
 */
function sanitize(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
