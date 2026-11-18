import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CiteClickDirective } from '../../shared/cite-click.directive';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { ChatMessageVm } from './chat.store';

@Component({
  selector: 'app-message',
  imports: [TranslatePipe, MarkdownPipe, CiteClickDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message.component.html',
  styleUrl: './message.component.scss',
})
export class MessageComponent {
  readonly message = input.required<ChatMessageVm>();
  readonly cite = output<number>();
  readonly followUp = output<string>();

  protected readonly copied = signal(false);

  protected readonly isAssistant = computed(() => this.message().role === 'assistant');
  protected readonly waiting = computed(
    () => this.isAssistant() && !this.message().text && this.message().status === 'streaming',
  );
  protected readonly confidenceKey = computed<TranslationKey | null>(() => {
    const c = this.message().confidence;
    return c ? (`chat.confidence.${c}` as TranslationKey) : null;
  });
  protected readonly showConfidence = computed(() => {
    const m = this.message();
    return this.confidenceKey() !== null && (m.confidence === 'low' || m.confidence === 'none');
  });

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.message().text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard can be blocked; the button just does nothing.
    }
  }
}
