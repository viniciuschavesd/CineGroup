/**
 * Movie catalog entry shared by personal lists and group posts.
 */
export interface Movie {
  id: string;
  title: string;
  director: string;
  releaseYear: number;
  posterUrl?: string;
  genres: string[];
  synopsis?: string;
}
