import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CHART } from '../shared/charts/chart';
import { LibraryBookSummary } from '../owned-books/models/owned-book-api';
import { Goal } from './goal.service';
import { goalProgress } from './goal-progress';

@Component({
  selector: 'app-goal-progress-card',
  template: `
    <article [attr.aria-labelledby]="'goal-' + goal().id">
      <header>
        <div class="goal-title">
          <h2 [id]="'goal-' + goal().id">{{ progress().title }}</h2>
          <button
            #editButton
            class="edit-button"
            type="button"
            [attr.aria-label]="'Edit ' + progress().title"
            (click)="edit.emit(editButton)"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
              <path d="m14 5 5 5" />
            </svg>
          </button>
        </div>
        @if (goal().goalType !== 'ReadBookPercentage') {
          <span class="goal-count">{{ progress().completed }}/{{ goal().num }}</span>
        } @else {
          <span class="goal-count" [attr.aria-label]="'Goal: ' + goal().num + '%'"
            >{{ goal().num }}%</span
          >
        }
      </header>
      <div
        class="progress"
        role="progressbar"
        [attr.aria-label]="progress().title"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="progress().fill"
        [attr.aria-valuetext]="
          goal().goalType === 'ReadBookPercentage'
            ? progress().percentage + '% read; goal ' + goal().num + '%'
            : progress().percentage + '% of target'
        "
      >
        <canvas #canvas aria-hidden="true"></canvas>
        @if (goal().goalType === 'ReadBookPercentage') {
          <span
            class="goal-marker"
            [style.left.%]="goal().num"
            [title]="'Goal: ' + goal().num + '%'"
            aria-hidden="true"
          ></span>
        }
        <span class="percentage">{{ progress().percentage }}%</span>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    article {
      padding: 1.5rem;
      border: 1px solid #dedbd1;
      border-radius: 0.75rem;
      background: #fffdf8;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    h2 {
      margin: 0;
      font:
        500 clamp(1.4rem, 3vw, 2rem)/1.2 'Playfair Display',
        Georgia,
        serif;
    }
    .goal-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .edit-button {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: 0;
      border-radius: 0.4rem;
      background: transparent;
      color: #254d3c;
      cursor: pointer;
    }
    .edit-button:hover {
      background: #eae5da;
    }
    .goal-count {
      flex-shrink: 0;
      font-size: clamp(1.25rem, 3vw, 1.75rem);
      font-variant-numeric: tabular-nums;
    }
    .progress {
      position: relative;
      height: 2.5rem;
      overflow: hidden;
      border-radius: 0.35rem;
      background: #625f57;
    }
    .percentage {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #fffdf8;
      font-weight: 600;
      text-shadow: 0 1px 2px #0008;
      pointer-events: none;
      z-index: 2;
    }
    .goal-marker {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3px;
      transform: translateX(-50%);
      background: #d32626;
      box-shadow: 0 0 0 1px #fffdf8;
      z-index: 1;
    }
  `,
})
export class GoalProgressCard {
  readonly goal = input.required<Goal>();
  readonly books = input.required<LibraryBookSummary[]>();
  readonly edit = output<HTMLButtonElement>();
  protected readonly progress = computed(() => goalProgress(this.goal(), this.books()));
  private readonly Chart = inject(CHART);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    effect((onCleanup) => {
      const canvas = this.canvas()?.nativeElement;
      if (!canvas) return;
      const progress = this.progress();
      const chart = new this.Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['Progress'],
          datasets: [
            {
              data: [progress.fill],
              backgroundColor: progress.color,
              borderWidth: 0,
              barPercentage: 1,
              categoryPercentage: 1,
            },
            {
              data: [100 - progress.fill],
              backgroundColor: '#a7a294',
              borderWidth: 0,
              barPercentage: 1,
              categoryPercentage: 1,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          events: [],
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false, stacked: true, min: 0, max: 100 },
            y: { display: false, stacked: true },
          },
        },
      });
      onCleanup(() => chart.destroy());
    });
  }
}
