export interface UodoDate {
  date: string;
  use: string;
  type: string;
  status: string;
}

export interface UodoEntity {
  title?: { pl?: string };
  name?: { pl?: string };
  function: string;
  date?: string;
}

export interface UodoTerm {
  label: string;
  name?: { pl?: string; en?: string };
  base?: string;
}

export interface UodoRef {
  refid: string;
  name?: string;
  relation?: string;
  type?: string;
  source?: string;
  dest?: string;
}

export interface UodoDocument {
  id: string;
  name?: { pl?: string };
  title?: { pl?: string };
  refid?: string;
  refname?: string;
  kind?: string;
  publication?: { status?: string; inforce?: boolean; version?: string };
  publicator?: { type?: string; subtype?: string; name?: { pl?: string }; country?: string; year?: string };
  dates?: UodoDate[];
  entities?: UodoEntity[];
  terms?: UodoTerm[];
  refs?: UodoRef[];
  resources?: Record<string, { ref?: string; lang?: string; kind?: string; mimetype?: string; size?: number }>;
}

export interface UodoSearchItem {
  id: string;
  refid?: string;
  refname?: string;
  title_pl?: string | null;
  keywords?: string | null;
  dates?: UodoDate[];
}
