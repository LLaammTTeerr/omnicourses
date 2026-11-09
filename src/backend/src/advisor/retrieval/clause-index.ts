import type { Clause, RegulationDocument } from '../regulations/regulation.js';
import { expandSynonyms } from './synonyms.js';
import { type Term, termsOf, tokens } from './text.js';

// In-memory BM25 over the regulation clauses (ADR 0015). A few hundred clauses fit in memory and
// index in milliseconds at boot: no vector store, no extra service, and the same input always gives
// the same ranking, so retrieval is unit-tested like any other code.

const K1 = 1.2;
const B = 0.75;

/** A clause with the document it belongs to, as retrieval returns it. */
export interface IndexedClause extends Clause {
  documentId: string;
  documentShortName: string;
}

export interface ClauseHit {
  clause: IndexedClause;
  score: number;
}

export interface SearchResult {
  hits: ClauseHit[];
  /**
   * How much of the question the best clauses explain, from 0 to 1: the IDF weight of the question's
   * terms found in the top three hits, over the weight of all its terms. A word the regulation never
   * uses weighs as much as its rarest word, so an off-topic question scores low however long it is.
   */
  coverage: number;
}

interface Doc {
  clause: IndexedClause;
  tf: Map<string, number>;
  length: number;
}

/** A question's terms: folded words, synonyms replaced by the regulation's wording, pairs added. */
export function queryTerms(question: string): Term[] {
  return termsOf(expandSynonyms(tokens(question)), 'query');
}

export class ClauseIndex {
  private readonly docs: Doc[];
  private readonly byId: Map<string, IndexedClause>;
  private readonly df = new Map<string, number>();
  private readonly averageLength: number;
  private readonly maxIdf: number;

  constructor(documents: RegulationDocument[]) {
    const clauses: IndexedClause[] = documents.flatMap((d) => d.clauses.map((c) => ({ ...c, documentId: d.id, documentShortName: d.shortName })));
    this.byId = new Map(clauses.map((c) => [c.id, c]));
    this.docs = clauses.map((clause) => {
      const terms = termsOf(tokens(indexText(clause, this.byId)), 'index').map((t) => t.term);
      const tf = new Map<string, number>();
      for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
      return { clause, tf, length: terms.length };
    });
    for (const doc of this.docs) for (const t of doc.tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.averageLength = this.docs.reduce((sum, d) => sum + d.length, 0) / Math.max(1, this.docs.length);
    this.maxIdf = this.idfOf(1);
  }

  get size(): number {
    return this.docs.length;
  }

  /** The clause with this exact id, or undefined. */
  get(id: string): IndexedClause | undefined {
    return this.byId.get(id);
  }

  /** The article numbers of a document, to tell a real "Điều 7" from an invented "Điều 99". */
  hasArticle(documentId: string, article: number): boolean {
    return this.docs.some((d) => d.clause.documentId === documentId && d.clause.article.number === article);
  }

  search(question: string, limit = 5): SearchResult {
    // A pair the index never saw adds nothing; a pair of two stopwords counts only where the index
    // knows it ("toi da" typed for tối đa). An unknown single word stays: it is what makes an
    // off-topic question score low.
    const all = new Map<string, Term>();
    for (const t of queryTerms(question)) if (!t.pair || this.df.has(t.term)) all.set(t.term, t);
    const terms = [...all.keys()];
    if (terms.length === 0) return { hits: [], coverage: 0 };
    const scored: ClauseHit[] = [];
    for (const doc of this.docs) {
      let score = 0;
      for (const t of terms) {
        const f = doc.tf.get(t);
        if (!f) continue;
        score += this.idf(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / this.averageLength)));
      }
      if (score > 0) scored.push({ clause: doc.clause, score });
    }
    // Ties keep source order, so the ranking is stable.
    scored.sort((a, b) => b.score - a.score);
    const hits = scored.slice(0, limit);
    const top = new Set(hits.slice(0, 3).map((h) => h.clause.id));
    const topDocs = this.docs.filter((d) => top.has(d.clause.id));
    const weight = (t: string) => (this.df.has(t) ? this.idf(t) : this.maxIdf);
    const total = terms.reduce((sum, t) => sum + weight(t), 0);
    const found = terms.filter((t) => topDocs.some((d) => d.tf.has(t))).reduce((sum, t) => sum + weight(t), 0);
    return { hits, coverage: total ? found / total : 0 };
  }

  private idf(term: string): number {
    return this.idfOf(this.df.get(term) ?? 0);
  }

  private idfOf(df: number): number {
    return Math.log(1 + (this.docs.length - df + 0.5) / (df + 0.5));
  }
}

/**
 * What a clause is indexed by: its label, its article's title, its text, and for a khoản or điểm its
 * parent's lead-in ("3. Sinh viên được xếp trình độ năm học…" above "a) Trình độ năm thứ nhất: N < 38").
 */
function indexText(clause: Clause, byId: Map<string, Clause>): string {
  const parts = [clause.label, clause.article.title, clause.article.title, clause.text];
  const parentId = clause.id.split('/').slice(0, -1).join('/');
  const parent = clause.level === 'article' ? undefined : byId.get(parentId);
  if (parent) parts.push(parent.text);
  return parts.join('\n');
}
