export function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function shuffledOptionIndices(options?: readonly string[], previous?: readonly number[]): number[] {
  if (previous && previous.length === options?.length && previous.length > 1) {
    // A non-zero rotation moves every choice away from its previous letter.
    const shift = 1 + Math.floor(Math.random() * (previous.length - 1));
    return [...previous.slice(shift), ...previous.slice(0, shift)];
  }
  return shuffled((options ?? []).map((_, index) => index));
}
