import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Data, RouterLink } from '@angular/router';
import { of } from 'rxjs';

@Component({
  selector: 'app-coming-soon',
  imports: [RouterLink],
  templateUrl: './coming-soon.html',
  styleUrl: './coming-soon.scss',
})
export class ComingSoon {
  readonly title = input<string>();
  readonly message = input<string>();
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly routeData = toSignal(this.route?.data ?? of<Data>({}), {
    initialValue: {} as Data,
  });
  protected readonly heading = computed(
    () => this.title() || this.routeData()['comingSoonTitle'] || 'Coming Soon',
  );
  protected readonly helperText = computed(
    () =>
      this.message() ||
      this.routeData()['comingSoonMessage'] ||
      'This feature is on its way. Check back soon for updates.',
  );
}
