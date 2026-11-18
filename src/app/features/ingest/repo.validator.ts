import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parseRepoInput } from '../../rag/github';

/** Validates the repo field with the same parser the ingestion uses, so they never disagree. */
export const repoValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  !control.value || parseRepoInput(String(control.value)) ? null : { repo: true };
