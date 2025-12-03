// Simple ARASAAC search hook (optional). Not wired by default.
// API docs: https://arasaac.org/developers/api

export interface ArasaacPictogram {
  _id: number;
  created: string;
  lastUpdated: string;
  keywords: Array<{ keyword: string; meaning?: string }>;
  schematic?: boolean;
  sex?: string;
  skin?: string;
  hair?: string;
}

export interface ArasaacResult extends ArasaacPictogram {
  imageUrl: string;
}

const BASE = 'https://api.arasaac.org/api';

export async function searchArasaac(term: string, lang: string = 'en'): Promise<ArasaacResult[]> {
  const query = term.trim();
  if (!query) return [];
  // Search endpoint
  const url = `${BASE}/pictograms/${encodeURIComponent(lang)}/search/${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) return [];
  const data: ArasaacPictogram[] = await res.json();

  // Construct direct SVG URLs for display
  return data.slice(0, 30).map(p => ({
    ...p,
    imageUrl: `${BASE}/pictograms/${lang}/${p._id}`
  }));
}



