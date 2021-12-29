import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { DeckComponent } from './deck.component';
import { CardModule } from './card.module';
import { FooterModule } from 'src/footer/footer.module';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button'; 
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCardModule } from '@angular/material/card';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';

import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatPaginatorModule } from '@angular/material/paginator';
import { FlexLayoutModule } from '@angular/flex-layout';  

@NgModule({
  imports: [
    BrowserModule,
    HttpClientModule,
    CardModule,
    FooterModule,
    BrowserAnimationsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatCardModule,
    MatSlideToggleModule,
    MatToolbarModule,
    MatIconModule,
    MatExpansionModule,
    MatPaginatorModule,
    FlexLayoutModule,
  ],
  exports: [
    DeckComponent,
  ],
  declarations: [DeckComponent],
  providers: [],
})

export class DeckModule { }
