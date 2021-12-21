import { Component, ElementRef, ViewChild } from '@angular/core';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import { vtuberService } from 'src/api/service';
import {PageEvent} from '@angular/material/paginator';
import {Form, FormControl} from '@angular/forms';
import {MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {MatChipInputEvent} from '@angular/material/chips';
import * as tagJSON from '../assets/json/tags.json';
import {Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';


@Component({
  selector: 'pm-deck',
  templateUrl: './deck.component.html',
  styleUrls: ['./deck.component.css'],
  providers: [vtuberService, PageEvent]
})

export class DeckComponent {

  tagMap = new Map(Object.entries(tagJSON));

  private dataurl = 'https://vtrackerbucket.s3.us-east-2.amazonaws.com/vtubers.json';
  private histurl = 'https://vtrackerbucket.s3.us-east-2.amazonaws.com/history.json';

  public favoritesArray = this.initStorage();
  public favoritesDict: any = [];

  separatorKeysCodes: number[] = [ENTER, COMMA];
  tagCtrl: FormControl = new FormControl();
  filteredtags: Observable<string[]>;
  public tags: string[] = [];
  alltags: string[] = Array.from(this.tagMap.values());

  public length: number = 0;
  public pageSize = 10;
  public pageSizeOptions: number[] = [5, 10, 25, 100];

  private live: any = [];
  private dead: any = [];
  public vtuberDict: any = [];

  constructor(private vtubers: vtuberService, public pageEvent: PageEvent, public tagInput: ElementRef<HTMLInputElement>) {
    

    this.filteredtags = this.tagCtrl.valueChanges.pipe(
      startWith(null),
      map((tag: string | null) => (tag ? this._filter(tag) : this.alltags.slice())),
    );
  }

  // Chip Functions

  add(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    // Add our tag
    if (value) {
      this.tags.push(value);
    }

    // Clear the input value
    event.chipInput!.clear();

    this.tagCtrl.setValue(null);
  }

  manualAdd(input: string){ 
    console.log(this.tags);
    let temp =  this.tagMap.get(input);
    if (temp) {
      this.tags.push(temp);
    }
  }

  remove(tag: string): void {
    const index = this.tags.indexOf(tag);

    if (index >= 0) {
      this.tags.splice(index, 1);
    }
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    this.tags.push(event.option.viewValue);
    this.tagInput.nativeElement.value = '';
    this.tagCtrl.setValue(null);
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    
    return this.alltags.filter(tag => tag.toLowerCase().includes(filterValue));
  }

  tagMatch(input: Array<string>){
    if(this.tags.length == 0) {
      return true;
    }
    let humanizedTags: Array<string> = [];
    for (let tag of input) {
      let temp = this.tagMap.get(tag);
      if (temp) {
        humanizedTags.push(temp);
      }
    }
    for (let tag of this.tags) {
      if (!humanizedTags.includes(tag)) {
        return false
      }
    }
    return true;
  }

  noPipe(start: number | undefined, end: number, filter: Array<string>) {
    if (filter.length == 0) {
      if (end == 0) {
        return this.vtuberDict;
      }
      return this.vtuberDict.slice(start, end);
    }
    let result: any = [];

    // if any tag in vtuber['twitch']['tag_ids'] does not match any tag in filter, skip
    for (let vtuber of this.vtuberDict) {
      let match = true;
      // if not iterable
      if (!Array.isArray(vtuber['twitch']['tag_ids'])) {
        match = false;
      }
      else {
        // make new array of tags by mapping tag_ids to tagMap
        let humanizedTags: Array<string> = [];
        for (let tag of vtuber['twitch']['tag_ids']) {
          let temp = this.tagMap.get(tag);
          if (temp) {
            humanizedTags.push(temp.toLowerCase());
          }
        }
        // if all tags in filter are in humanizedTags, match = true
        for (let tag of filter) {
          if (!humanizedTags.includes(tag.toLowerCase())) {
            match = false;
          } 
        }
        if (match) {
          result.push(vtuber);
        }
      }
      
    }
    if (end == 0) {
      return result;
    }
    return result.slice(start, end);
  }

  // LocalStorage Functions

  parseFavorite(input: string, parameter: string){
    for (let vtuber in this.vtuberDict) {
      if (this.vtuberDict[vtuber]['twitch']['user_login'] == input) {
        switch(parameter) {
          case 'user_name':
            return this.vtuberDict[vtuber]['twitch']['user_name'].toLowerCase() == 
              this.vtuberDict[vtuber]['twitch']['user_login'] ? 
              this.vtuberDict[vtuber]['twitch']['user_name'] : 
              this.vtuberDict[vtuber]['twitch']['user_name'] +  ' (' + this.vtuberDict[vtuber]['twitch']['user_login'] + ')'
          case 'viewer_string':
            return this.vtuberDict[vtuber]['twitch']['viewer_count'] == 0 ? '' : 
              this.numberStringFormat(this.vtuberDict[vtuber]['twitch']['viewer_count']) + ' viewers'
          default:
            return this.vtuberDict[vtuber]['twitch'][parameter];
        }
      }
    }
    return "error";
  }

  initStorage(){
    let favorites = localStorage.getItem('favorites');
    if (favorites == null) {
      return [];
    }
    else {
      return JSON.parse(favorites);
    }
  }

  checkFavorite(input: string){
    let favorites = localStorage.getItem('favorites');
    if (favorites == null) return false;
    else {
      let favoritesArray = JSON.parse(favorites);
      return favoritesArray.includes(input);
    }
  }

  addFavorite(input: string){
    let favorites = localStorage.getItem('favorites');
    if (favorites == null) {
      let favoritesArray = [];
      favoritesArray.push(input);
      localStorage.setItem('favorites', JSON.stringify(favoritesArray));
    }
    else {
      let favoritesArray = JSON.parse(favorites);
      favoritesArray.push(input);
      localStorage.setItem('favorites', JSON.stringify(favoritesArray));
    }
  }

  // Misc. Functions

  tagStrip(input: Array<string>){
    let vGUID = '52d7e4cc-633d-46f5-818c-bb59102d9549'; // Manually added GUID for Vtuber Tag
    let filtered = input.filter(e => e !== vGUID);
    return filtered;
  }
  
  listStreamers() {
    this.vtubers.getData().toPromise().then(data => {
      let temp: any = data;
      for (let streamer in temp) {

        // Push Live Streamers
        if (temp[streamer]['twitch']['type'] == 'live') {
          if (temp[0] != undefined && temp[streamer]['twitch']['viewer_count'] > temp[0]['twitch']['viewer_count']) {
            this.live.ushift(temp[streamer]);
          }
          else {
            this.live.push(temp[streamer]);
          }
        }   
        
        // Push Offline Streamers (TODO)
        else this.dead.push(temp[streamer])
      }

      // Sort live by Viewer Count
      this.live.sort((a: any, b: any) => {
        return b.twitch.viewer_count - a.twitch.viewer_count;
      });

      // Add live to vtuberDict, then add dead to vtuberDict
      for (let streamer in this.live) {
        this.vtuberDict.push(this.live[streamer]);
      }
      for (let streamer in this.dead) {
        this.vtuberDict.push(this.dead[streamer]);
      }

    });
    
  }

  numberStringFormat(input: string){
    let number = parseInt(input);
    if (number < 1e3) return number.toString();
    else return +(number / 1e3).toFixed(1) + "K";
  }

  ngOnInit() {
    this.listStreamers();
    
  }

}
