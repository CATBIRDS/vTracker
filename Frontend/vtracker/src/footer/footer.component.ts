import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'pm-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  providers: []
})

export class FooterComponent {

  constructor(public dialog: MatDialog) {}
  public github: string = 'https://github.com/CATBIRDS/vTracker';
  public catbird: string = "https://catbird.club";
  
  openDialog() {
    this.dialog.open(FooterDialog);
  }

}

@Component({
  selector: 'FooterDialog',
  templateUrl: 'dialog.html',
  styleUrls: ['./footer.component.css'],
})

export class FooterDialog {}