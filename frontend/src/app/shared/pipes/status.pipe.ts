import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';


@Pipe({
  name: 'appStatus',
  standalone: true,
  pure: false 
})
export class StatusPipe implements PipeTransform {
  private translateService = inject(TranslateService);

  transform(status: string): string {
    if (!status) return '';
    return this.translateService.instant(`orders.status.${status}`);
  }
}
