/**
 * Découpe un texte en chunks de taille maximale définie, en respectant autant que possible
 * les sauts de ligne pour éviter de couper les phrases au milieu
 */
export function chunkText(text: string, maxChunkSize: number = 3500): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let currentPosition = 0;

  while (currentPosition < text.length) {
    let endPosition = currentPosition + maxChunkSize;
    
    // Si on n'est pas à la fin du texte, essayons de trouver un point de coupure naturel
    if (endPosition < text.length) {
      // Chercher le dernier saut de ligne dans les 500 derniers caractères du chunk
      const searchStart = Math.max(currentPosition + maxChunkSize - 500, currentPosition);
      const searchText = text.substring(searchStart, endPosition);
      const lastNewlineIndex = searchText.lastIndexOf('\n');
      
      if (lastNewlineIndex !== -1) {
        endPosition = searchStart + lastNewlineIndex;
      } else {
        // Si pas de saut de ligne, chercher le dernier espace
        const lastSpaceIndex = searchText.lastIndexOf(' ');
        if (lastSpaceIndex !== -1) {
          endPosition = searchStart + lastSpaceIndex;
        }
      }
    }

    const chunk = text.substring(currentPosition, endPosition).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    currentPosition = endPosition + 1; // +1 pour ignorer le caractère de coupure
  }

  return chunks;
}