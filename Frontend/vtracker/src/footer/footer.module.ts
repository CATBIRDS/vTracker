import { NgModule } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { FooterComponent, FooterDialog } from './footer.component';

@NgModule({
  imports: [
    MatDialogModule
  ],
  exports: [
    FooterComponent
  ],
  declarations: [FooterComponent, FooterDialog],
  providers: [],
})

export class FooterModule {}

