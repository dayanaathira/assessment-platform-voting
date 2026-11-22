import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';
import { FeatureRequestService } from '../core/feature-request.service';
import { VoteResult } from '../core/models';
import { VoteButton } from './vote-button';

describe('VoteButton', () => {
  let service: { vote: ReturnType<typeof vi.fn>; unvote: ReturnType<typeof vi.fn> };
  let response: Subject<VoteResult>;
  let fixture: ComponentFixture<VoteButton>;

  beforeEach(() => {
    response = new Subject<VoteResult>();
    service = { vote: vi.fn(() => response), unvote: vi.fn(() => response) };
    TestBed.configureTestingModule({
      imports: [VoteButton],
      providers: [{ provide: FeatureRequestService, useValue: service }],
    });
    fixture = TestBed.createComponent(VoteButton);
  });

  /**
   * Renders the button for a request.
   * @param overrides - Fields to change from an open, not-yet-voted request.
   * @returns The rendered button element.
   */
  async function render(overrides: Record<string, unknown> = {}): Promise<HTMLButtonElement> {
    fixture.componentRef.setInput('request', {
      id: 'r1',
      title: 'Dark mode',
      voteCount: 4,
      hasVoted: false,
      canVote: true,
      ...overrides,
    });
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('button');
  }

  it('describes its state to screen readers', async () => {
    const button = await render({ hasVoted: true });

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Remove vote from Dark mode, 4 votes');
  });

  it('is disabled when voting is closed', async () => {
    const button = await render({ canVote: false });

    expect(button.disabled).toBe(true);
  });

  it('votes, stays disabled while waiting, then emits the server result', async () => {
    const emitted: VoteResult[] = [];
    fixture.componentInstance.voted.subscribe((r) => emitted.push(r));
    const button = await render();

    button.click();
    await fixture.whenStable();
    expect(service.vote).toHaveBeenCalledWith('r1');
    expect(button.disabled).toBe(true);

    response.next({ voteCount: 5, hasVoted: true });
    response.complete();
    await fixture.whenStable();

    expect(emitted).toEqual([{ voteCount: 5, hasVoted: true }]);
    expect(button.disabled).toBe(false);
  });

  it('removes the vote when already voted', async () => {
    const button = await render({ hasVoted: true });

    button.click();

    expect(service.unvote).toHaveBeenCalledWith('r1');
    expect(service.vote).not.toHaveBeenCalled();
  });

  it("shows the server's message when the vote is rejected", async () => {
    service.vote.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'You have already voted for this request' },
          }),
      ),
    );
    const button = await render();

    button.click();
    await fixture.whenStable();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent.trim()).toBe('You have already voted for this request');
    expect(button.disabled).toBe(false);
  });
});
