import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { FeatureRequestService } from '../core/feature-request.service';
import { errorMessage } from '../core/http-error';
import { FeatureRequest, VoteResult } from '../core/models';

// Not optimistic: the count shown is always the server's, so it can't drift from the real total.
@Component({
  selector: 'app-vote-button',
  template: `
    <button
      type="button"
      class="vote"
      [class.voted]="request().hasVoted"
      [attr.aria-pressed]="request().hasVoted"
      [attr.aria-label]="label()"
      [title]="request().canVote ? '' : 'Voting is closed for this request'"
      [disabled]="busy() || !request().canVote"
      (click)="toggle()"
    >
      <span aria-hidden="true">▲</span>
      <span>{{ request().voteCount }}</span>
    </button>
    @if (error()) {
      <p class="vote-error" role="alert">{{ error() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .vote {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 3.5rem;
      padding: 0.4rem;
      font-weight: 700;
    }
    .vote.voted {
      background: var(--primary);
      border-color: var(--primary);
      color: var(--primary-text);
    }
    .vote-error {
      max-width: 8rem;
      margin: 0.25rem 0 0;
      font-size: 0.75rem;
      color: var(--danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoteButton {
  private readonly service = inject(FeatureRequestService);

  readonly request =
    input.required<Pick<FeatureRequest, 'id' | 'title' | 'voteCount' | 'hasVoted' | 'canVote'>>();
  readonly voted = output<VoteResult>();

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly label = computed(() => {
    const { title, voteCount, hasVoted } = this.request();
    return `${hasVoted ? 'Remove vote from' : 'Vote for'} ${title}, ${voteCount} votes`;
  });

  /**
   * Votes or removes the vote, then reports the server's result to the parent.
   * @returns Nothing.
   */
  protected toggle(): void {
    const { id, hasVoted } = this.request();
    this.busy.set(true);
    this.error.set('');
    (hasVoted ? this.service.unvote(id) : this.service.vote(id))
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (result) => this.voted.emit(result),
        error: (err) => this.error.set(errorMessage(err)),
      });
  }
}
