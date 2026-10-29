/**
 * Vietnamese words are space-separated syllables, so browsers happily wrap mid-word ("thực / tế").
 * Mark the allowed break points with `|`; spaces inside each phrase become non-breaking.
 * Keep phrases short so a single one still fits a 390px screen.
 */
export function phrases(text: string) {
  return text.split('|').map(part => part.trim().replace(/ +/g, ' ')).filter(Boolean).join(' ');
}
