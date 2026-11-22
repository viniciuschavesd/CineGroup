export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  genres: TmdbGenre[];
  runtime: number | null;

  credits: {
    crew: TmdbCrewMember[];
  };
}