export interface NotebookEntry {
  id: string;
  name: string;
  content: string;
  categories: string[];
  contextKey?: string;
  contextLabel?: string;
  lastPathname?: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotebookContextSnapshot {
  key: string;
  label: string;
  suggestedName: string;
  categories: string[];
  pathname: string;
}