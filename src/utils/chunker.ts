export function chunkText(text: string, targetChars = 1500, overlapChars = 200): string[] {
  if (text.length <= targetChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + targetChars;
    
    // If we're not at the end of the text, try to find a good breaking point
    if (end < text.length) {
      // Look for sentence endings within the last 100 characters of the chunk
      const searchStart = Math.max(start + targetChars - 100, start);
      const searchText = text.substring(searchStart, end);
      const sentenceBreak = searchText.search(/[.!?]\s+/);
      
      if (sentenceBreak !== -1) {
        end = searchStart + sentenceBreak + 1;
      } else {
        // Fall back to word boundary
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }
    } else {
      end = text.length;
    }

    chunks.push(text.substring(start, end).trim());
    
    // Move start position, accounting for overlap
    start = Math.max(end - overlapChars, start + 1);
    
    if (start >= text.length) break;
  }

  return chunks.filter(chunk => chunk.length > 0);
}