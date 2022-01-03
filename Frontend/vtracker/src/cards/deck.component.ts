import { Component, ElementRef, ViewChild } from '@angular/core';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { vtuberService } from 'src/api/service';
import { PageEvent  } from '@angular/material/paginator';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import * as tagJSON from '../assets/json/tags.json';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { sortAndDeduplicateDiagnostics } from 'typescript';


@Component({
  selector: 'pm-deck',
  templateUrl: './deck.component.html',
  styleUrls: ['./deck.component.css'],
  providers: [vtuberService, PageEvent]
})

export class DeckComponent {

  tagMap = new Map(Object.entries(tagJSON));

  placeholder = 'e.g. ';

  public favoritesArray = this.initStorage();
  public favoritesDict: any = [];

  separatorKeysCodes: number[] = [ENTER, COMMA];
  tagCtrl: FormControl = new FormControl();
  filteredtags: Observable<string[]>;
  public tags: string[] = [];
  alltags: string[] = Array.from(this.tagMap.values());

  public length: number = 0;
  public pageSize = 12;
  public pageSizeOptions: number[] = [12, 24, 48, 96];

  private live: any = [];
  private dead: any = [];
  public vtuberDict: any = [];

  public blurMature: boolean = this.initMature();
  public hideOffline: boolean = this.initOffline();

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

    // Set a new placeholder now that we've entered some text
    this.placeholder = this.randomTag();
  }

  manualAdd(input: string){ 
    console.log(this.tags);
    let temp =  this.tagMap.get(input);
    if (temp) {
      if (!this.tags.includes(temp)) {
        this.tags.push(temp);
      }
      else {        
        this.tags.splice(this.tags.indexOf(temp), 1);
      }
    }
    else {
      // If the tag is not in the map, but also is not simply an invalid GUID, then it is a pseudo-tag, likely a game title - add it.
      if (!input.match(/^[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}$/)) {
        if (!this.tags.includes(input)) {
          this.tags.push(input);
        }
        else {        
          this.tags.splice(this.tags.indexOf(input), 1);
        }
      }
    }
    
    // Once more, change up the placeholder text
    this.placeholder = this.randomTag();
  }

  remove(tag: string): void {
    const index = this.tags.indexOf(tag);

    if (index >= 0) {
      this.tags.splice(index, 1);
    }

    // As with add(), change up the placeholder text
    this.placeholder = this.randomTag();
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

  randomTag() {
    return 'e.g. ' + this.alltags[Math.floor(Math.random() * this.alltags.length)];
  }

  newTab(url: string){
    window.open(url, '_blank');
  }

  randomVtuber(vtubers: any) {
    let random = vtubers[Math.floor(Math.random() * vtubers.length)];
    while(random['twitch']['type'] != 'live'){
      random = vtubers[Math.floor(Math.random() * vtubers.length)];
    }
    return random['twitch']['user_login'];
  }

  noPipe(start: number | undefined, end: number, filter: Array<string>) {
    let result: any = [];
    if (filter.length == 0) {
      // Even if there is no filter, we still need to hide 18+ vtubers if the user has turned off mature content
      for (let vtuber of this.vtuberDict) {
        if (this.blurMature && vtuber['twitch']['is_mature'] === true) {
          continue;
        }
        else {
          result.push(vtuber);
        }
      }
      if (end == 0) {
        return result;
      }
      return result.slice(start, end);
    }
    
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

        // include current game as a pseudo-tag to allow users to filter by game
        if (vtuber['twitch']['game_name'] && vtuber['twitch']['type'] === 'live') {
          humanizedTags.push(vtuber['twitch']['game_name'].toLowerCase());
        }

        // if all tags in filter are in humanizedTags, match = true
        for (let tag of filter) {
          if (!humanizedTags.includes(tag.toLowerCase())) {
            match = false;
          } 
        }
        // if the 'tag' fuzzy matches the vtuber's name, force match = true
        if (vtuber['twitch']['user_login'].toLowerCase().includes(filter[0].toLowerCase()) || vtuber['twitch']['user_name'].toLowerCase().includes(filter[0].toLowerCase())) {
          match = true;
        }

        // Finally, override all matches if the vtuber is set to 'mature' and the user has not chosen to show mature, OR if they lack the hidden 'vtuber' tag
        if ( ( this.blurMature && vtuber['twitch']['is_mature'] === true ) || !humanizedTags.includes('vtuber') ) {
          match = false;
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

  nuke() {
    localStorage.clear();
  }

  parseFavorite(input: string, parameter: string){
    let match = false;
    for(let vtuber in this.vtuberDict){
      if(this.vtuberDict[vtuber]['twitch']['user_login'] == input){
        match = true;
        switch(parameter) {
          case 'exists':
            return true;
          case 'user_name':
            return this.vtuberDict[input]['twitch']['user_name'].toLowerCase() == 
              this.vtuberDict[input]['twitch']['user_login'] ? 
              this.vtuberDict[input]['twitch']['user_name'] : 
              this.vtuberDict[input]['twitch']['user_name'] +  ' (' + this.vtuberDict[input]['twitch']['user_login'] + ')'
          case 'viewer_string':
            return this.vtuberDict[input]['twitch']['viewer_count'] == 0 ? '' : 
              this.numberStringFormat(this.vtuberDict[input]['twitch']['viewer_count']) + ' viewers'
          default:
            return this.vtuberDict[input]['twitch'][parameter];
        }
      }
    }
  }

  initStorage(){
    let favorites = localStorage.getItem('favorites');
    if (favorites == null) {
      return [];
    }
    return JSON.parse(favorites);
  }

  initMature(){
    let mature = localStorage.getItem('mature');
    if (mature == null) {
      return true;
    }
    else {
      if (mature === 'true'){
        return true;
      }
      else {
        return false;
      }
    }
  }

  initOffline(){
    let offline = localStorage.getItem('offline');
    if (offline == null) {
      return true;
    }
    else {
      if (offline === 'true'){
        return true;
      }
      else {
        return false;
      }
    }
  }

  toggleMature(event: any){
    localStorage.setItem('mature', event.checked.toString());
  }

  toggleOffline(event: any){
    localStorage.setItem('offline', event.checked.toString());
    // Clear the cache when offline mode is toggled
    this.listStreamers();
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
    //let filtered = input.filter(e => e !== vGUID);
    return input;
  }
  
  listStreamers() {
    this.live = [];
    this.dead = [];
    let tempDict: any = [];
    let offline = this.initOffline();
    // If 'offline' is True, then we have elected to HIDE offline streamers, meaning we should grab data from live.json
    if(offline) {
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
          tempDict.push(this.live[streamer]);
        }
        for (let streamer in this.dead) {
          tempDict.push(this.dead[streamer]);
        }

        this.vtuberDict = tempDict;
  
      });
    }
    else {
      this.vtubers.getMaster().toPromise().then(data => {
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
          tempDict.push(this.live[streamer]);
        }
        for (let streamer in this.dead) {
          tempDict.push(this.dead[streamer]);
        }

        this.vtuberDict = tempDict;
  
      });
    }
  }

  numberStringFormat(input: string){
    let number = parseInt(input);
    if (number < 1e3) return number.toString();
    else return +(number / 1e3).toFixed(1) + "K";
  }

  ngOnInit() {
    this.listStreamers();
    this.placeholder = this.randomTag();
  }

}
