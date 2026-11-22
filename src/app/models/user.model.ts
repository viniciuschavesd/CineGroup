/**
 * Status of a movie in a user's personal list.
 */
export type MovieListStatus = 'want-to-watch' | 'watched';

/**
 * One movie saved in the user's personal list.
 * Stores the movie ID instead of duplicating the full Movie object.
 */
export interface UserMovieEntry {
  movieId: string;
  status: MovieListStatus;
  addedAt: string;
  watchedAt?: string;
  personalRating?: number; // 0 to 10
}

/**
 * Public/domain data for a CineGroup user.
 * Password is deliberately not part of this interface.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  avatarUrl?: string;
  movieList: UserMovieEntry[];
}

/**
 * Temporary data submitted by the registration form.
 * Do not persist the raw password as part of the User profile.
 */
export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

/**
 * Data entered in the login form.
 */
export interface LoginCredentials {
  email: string;
  password: string;
}
