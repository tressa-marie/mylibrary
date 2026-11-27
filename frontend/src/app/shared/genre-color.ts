import { computed, Directive, input } from '@angular/core';

const GENRE_COLORS = new Map<string, string>([
  ['romance', '#B6468F'],
  ['fantasy', '#7c23a0'],
  ['science fiction', '#828C23'],
  ['literary', '#5c4412'],
  ['young adult', '#203b8b'],
  ['thriller', '#af3b0d'],
  ['horror', '#7c1418'],
  ['historical', '#E09F3E'],
  ['magical realism', '#0C6B6E'],
  ['mystery', '#297227'],
  ['lgbt', '#7449bb'],
  ['poetry', '#2D5A51'],
  ['non-fiction', '#7e7e7e'],
]);

export function genreColor(genre: string): string {
  return GENRE_COLORS.get(genre.trim().toLowerCase()) ?? '#959595';
}

@Directive({
  selector: '[appGenreColor]',
  host: {
    '[style.--genre-background]': 'background()',
    '[style.--genre-text]': 'textColor()',
  },
})
export class GenreColor {
  readonly appGenreColor = input.required<string>();
  protected readonly background = computed(() => genreColor(this.appGenreColor()));
  protected readonly textColor = computed(() =>
    ['#E09F3E', '#959595'].includes(this.background()) ? '#000000' : '#FFFFFF',
  );
}
