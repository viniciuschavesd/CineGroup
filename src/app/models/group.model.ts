import type { MoviePost } from './movie-post.model';

/**
 * CineGroup created by a user and shared with invited members.
 */
export interface Group {
  id: string;
  name: string;
  description?: string;
  createdByUserId: string;
  memberUserIds: string[];
  createdAt: string;

}
