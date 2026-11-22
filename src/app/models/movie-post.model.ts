/**
 * A movie publication shared inside a group.
 * References the movie and author by ID to avoid duplicating their data.
 */
export interface MoviePost {
  id: string;
  groupId: string;
  movieId: string;
  authorUserId: string;
  postedAt: string;
  comment: string;
  rating?: number; // 0 to 10

  
  /** User IDs that liked this post. The like count is likedByUserIds.length. */
  likedByUserIds: string[];

  /** User IDs that disliked this post. The dislike count is dislikedByUserIds.length. */
  dislikedByUserIds: string[];

  /** User IDs who marked that they watched this movie. */
  watchedByUserIds: string[];
}
