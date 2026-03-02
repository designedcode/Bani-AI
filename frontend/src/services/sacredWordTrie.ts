/**
 * Word-level Trie implementation for efficient sacred word detection.
 * Optimized for streaming audio transcripts.
 */

export interface TrieNode {
  children: Map<string, TrieNode>;
  phrase: string | null; // Stores the full phrase if this node completes a sacred word/phrase
}

export class SacredWordTrie {
  private root: TrieNode = { children: new Map(), phrase: null };

  constructor(phrases: string[]) {
    phrases.forEach(phrase => this.insert(phrase));
  }

  private insert(phrase: string) {
    const normalized = phrase.normalize('NFC').trim();
    const words = normalized.split(/\s+/);
    let current = this.root;

    for (const word of words) {
      if (!current.children.has(word)) {
        current.children.set(word, { children: new Map(), phrase: null });
      }
      current = current.children.get(word)!;
    }
    current.phrase = normalized;
  }

  public getRoot(): TrieNode {
    return this.root;
  }

  /**
   * Helper for one-off full text detection.
   * Returns all matches found in the text.
   */
  public findAllMatches(text: string): { phrase: string; startIndex: number; endIndex: number }[] {
    const words = text.normalize('NFC').trim().split(/\s+/);
    const matches: { phrase: string; startIndex: number; endIndex: number }[] = [];

    for (let i = 0; i < words.length; i++) {
      let current = this.root;
      let lastMatch: string | null = null;
      let lastMatchWords = 0;

      for (let j = i; j < words.length; j++) {
        const word = words[j];
        if (current.children.has(word)) {
          current = current.children.get(word)!;
          if (current.phrase) {
            lastMatch = current.phrase;
            lastMatchWords = j - i + 1;
          }
        } else {
          break;
        }
      }

      if (lastMatch) {
        matches.push({
          phrase: lastMatch,
          startIndex: i,
          endIndex: i + lastMatchWords - 1
        });
        // Skip matched words to avoid overlapping partial matches
        i += lastMatchWords - 1;
      }
    }

    return matches;
  }
}

export interface DetectionResult {
  fullMatch: string | null;
  isPartialMatch: boolean;
  consumedWordCount: number;
}

/**
 * Maintains state for incremental processing of transcript tokens.
 */
export class StreamingTrieDetector {
  private root: TrieNode;
  private currentNode: TrieNode;
  private matchBuffer: string[] = []; // Words currently being tracked as a potential match

  constructor(trie: SacredWordTrie) {
    this.root = trie.getRoot();
    this.currentNode = this.root;
  }

  /**
   * Processes a single new word.
   * @returns DetectionResult containing whether a full match was found.
   */
  public processWord(word: string): DetectionResult {
    const normalizedWord = word.normalize('NFC');

    if (this.currentNode.children.has(normalizedWord)) {
      this.currentNode = this.currentNode.children.get(normalizedWord)!;
      this.matchBuffer.push(normalizedWord);

      const isTerminal = this.currentNode.phrase !== null;

      if (isTerminal) {
        const found = this.currentNode.phrase!;
        const count = this.matchBuffer.length;
        this.reset();
        return { fullMatch: found, isPartialMatch: false, consumedWordCount: count };
      }

      return { fullMatch: null, isPartialMatch: true, consumedWordCount: 0 };
    } else {
      // Current word doesn't match child of current node.
      // 1. Check if the PREVIOUS state was a terminal match.
      if (this.currentNode.phrase) {
        const found = this.currentNode.phrase;
        const count = this.matchBuffer.length;
        this.reset();
        // Re-process the current word starting from root in case it's the start of a NEW phrase
        const retryResult = this.processWord(word);
        return {
          fullMatch: found,
          isPartialMatch: retryResult.isPartialMatch,
          consumedWordCount: count
        };
      }

      // 2. It wasn't a match. Reset and check if this word alone starts a phrase.
      this.reset();
      if (this.root.children.has(normalizedWord)) {
        return this.processWord(word);
      }

      return { fullMatch: null, isPartialMatch: false, consumedWordCount: 0 };
    }
  }

  /**
   * Resets the matching state.
   */
  public reset() {
    this.currentNode = this.root;
    this.matchBuffer = [];
  }

  /**
   * Returns current phrase if the detector is sitting on a valid terminal node.
   * Useful when speech ends and we want to see if we were in a match.
   */
  public finalize(): string | null {
    const match = this.currentNode.phrase;
    this.reset();
    return match;
  }
}
