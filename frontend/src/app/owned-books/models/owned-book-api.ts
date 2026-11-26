export interface CreateOwnedBookRequest {
  sourceBookId: string | null;
  title: string;
  author: string;
  isbn: string | null;
  description: string | null;
  coverUrl: string | null;
  format: string | null;
  authorGender: string | null;
  isRead: boolean;
  isDnf?: boolean | null;
  wantToSell?: boolean | null;
  bookCost?: number | null;
  dateAcquired?: string | null;
  dateRead?: string | null;
  rating: number | null;
  purchaseLocation: string | null;
  shelfLocation: string | null;
  shelfId: string | null;
  genres: string[];
  publicationYear: number | null;
  publisher: string | null;
  edition: string | null;
  pageCount: number | null;
}

export interface SavedOwnedBook extends CreateOwnedBookRequest {
  id: string;
  editionId: string;
  createdAtUtc: string;
}

export type LibraryBookSummary = Pick<
  SavedOwnedBook,
  | 'id'
  | 'title'
  | 'author'
  | 'genres'
  | 'isRead'
  | 'isDnf'
  | 'rating'
  | 'shelfId'
  | 'shelfLocation'
  | 'authorGender'
>;
