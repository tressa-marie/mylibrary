import { computed, Directive, input } from '@angular/core';

const GENRE_COLORS = new Map<string, string>([
  ['romance', '#B6468F'],
  ['fantasy', '#66335F'],
  ['science fiction', '#828C23'],
  ['literary', '#6E360C'],
  ['young adult', '#222B47'],
  ['thriller', '#9E2A2B'],
  ['horror', '#540B0E'],
  ['historical', '#E09F3E'],
  ['magical realism', '#0C6B6E'],
  ['mystery', '#2E5A2D'],
  ['lgbt', '#3E2D5A'],
  ['poetry', '#2D5A51'],
  ['non-fiction', '#5F5F5F'],
]);

@Directive({
  selector: '[appGenreColor]',
  host: {
    '[style.--genre-background]': 'background()',
    '[style.--genre-text]': 'textColor()',
  },
})
export class GenreColor {
  readonly appGenreColor = input.required<string>();
  protected readonly background = computed(
    () => GENRE_COLORS.get(this.appGenreColor().trim().toLowerCase()) ?? '#959595',
  );
  protected readonly textColor = computed(() =>
    ['#E09F3E', '#959595'].includes(this.background())
      ? '#000000'
      : '#FFFFFF',
  );
}
