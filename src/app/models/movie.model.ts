export interface Movie {
  id: string;
  tmdbId?: number;

  title: string;
  director: string;
  releaseYear: number;
  posterUrl?: string;
  genres: string[];
  synopsis?: string;
}