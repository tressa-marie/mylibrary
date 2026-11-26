export class OwnedBook {
  title = '';
  description = '';
  coverUrl: string | null = null;
  author = '';
  isbn = '';
  format = '';
  authorGender = '';
  rating: number | null = null;
  purchaseLocation = '';
  shelfId: string | null = null;
  genres: string[] = [];
  publicationYear: number | null = null;
  publisher = '';
  edition = '';
  pageCount: number | null = null;
}
